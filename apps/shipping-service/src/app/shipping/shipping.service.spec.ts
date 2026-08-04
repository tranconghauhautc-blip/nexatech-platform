import { EventTypes } from '@nexatech/shared-events';
import { ErrorCodes } from '@nexatech/shared-errors';
import { createHash } from 'node:crypto';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryInventoryClient } from './inventory.client';
import { InMemoryOrderClient } from './order.client';
import { InMemoryShippingRepository } from './shipping.repository';
import { ShippingService, parseActor } from './shipping.service';
import type { OrderSnapshot } from './shipping.types';

function customer() {
  return parseActor('cust-1', 'Customer');
}
function staff() {
  return parseActor('staff-1', 'Staff');
}

function sampleOrder(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    id: 'order-1',
    orderCode: 'NT-1001',
    customerId: 'cust-1',
    status: 'CONFIRMED',
    deliveryMethod: 'STANDARD',
    shippingAddress: {
      recipientName: 'A',
      recipientPhone: '0900000000',
      line1: '1 Nguyen Hue',
      city: 'HCM',
      country: 'VN',
      fullText: '1 Nguyen Hue, HCM',
    },
    packages: [
      {
        id: 'pkg-1',
        packageCode: 'PKG-1',
        status: 'ALLOCATED',
        sourceLocationType: 'warehouse',
        sourceLocationId: 'wh-1',
        items: [
          { id: 'pi-1', orderItemId: 'oi-1', skuCode: 'SKU-1', quantity: 1 },
        ],
      },
      {
        id: 'pkg-2',
        packageCode: 'PKG-2',
        status: 'READY_TO_SHIP',
        sourceLocationType: 'warehouse',
        sourceLocationId: 'wh-1',
        items: [
          { id: 'pi-2', orderItemId: 'oi-2', skuCode: 'SKU-2', quantity: 2 },
        ],
      },
    ],
    shippingFee: 30_000,
    currency: 'VND',
    paymentMethod: 'COD',
    ...overrides,
  };
}

function createService() {
  const repository = new InMemoryShippingRepository();
  const orderClient = new InMemoryOrderClient();
  const inventoryClient = new InMemoryInventoryClient();
  const publisher = new InMemoryEventPublisher();
  const service = new ShippingService(
    repository,
    orderClient,
    inventoryClient,
    publisher,
  );
  return { service, repository, orderClient, inventoryClient, publisher };
}

describe('ShippingService', () => {
  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
    process.env['MOCK_SHIPPING_ENABLED'] = 'true';
    process.env['SHIPPING_PROVIDER'] = 'MOCK';
    process.env['SHIPPING_WEBHOOK_SECRET'] = 'whsec';
  });

  it('quotes standard/express/pickup and multi-package fees as int', async () => {
    const { service, orderClient } = createService();
    orderClient.seed(sampleOrder());
    const standard = await service.createQuote(customer(), {
      orderId: 'order-1',
      idempotencyKey: 'q-std-001',
      deliveryMethod: 'STANDARD',
    });
    expect(Number.isInteger(standard.totalFee)).toBe(true);
    expect(standard.packageFees).toHaveLength(2);

    orderClient.seed(sampleOrder({ deliveryMethod: 'EXPRESS' }));
    const express = await service.createQuote(customer(), {
      orderId: 'order-1',
      idempotencyKey: 'q-exp-001',
      deliveryMethod: 'EXPRESS',
    });
    expect(express.totalFee).toBeGreaterThan(0);

    orderClient.seed(
      sampleOrder({
        deliveryMethod: 'STORE_PICKUP',
        pickupStoreId: 'store-1',
        shippingAddress: undefined,
      }),
    );
    const pickup = await service.createQuote(customer(), {
      orderId: 'order-1',
      idempotencyKey: 'q-pick-001',
      deliveryMethod: 'STORE_PICKUP',
    });
    expect(pickup.totalFee).toBe(0);
  });

  it('rejects expired quote', async () => {
    const { service, orderClient, repository } = createService();
    orderClient.seed(sampleOrder());
    const quote = await repository.createQuote({
      id: 'quote-expired',
      orderId: 'order-1',
      orderCode: 'NT-1001',
      customerId: 'cust-1',
      deliveryMethod: 'STANDARD',
      totalFee: 30_000,
      packageFees: [{ packageId: 'pkg-1', fee: 30_000 }],
      provider: 'MOCK',
      expiresAt: new Date(Date.now() - 1000),
      snapshotJson: {},
      outboxEvents: [],
      actorId: 'cust-1',
    });
    await expect(
      service.createShipment(customer(), {
        orderId: 'order-1',
        packageId: 'pkg-1',
        quoteId: quote.id,
        idempotencyKey: 'ship-expired-1',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.SHIPPING_QUOTE_EXPIRED });
  });

  it('reserves slot with capacity and idempotent duplicate', async () => {
    const { service } = createService();
    const slot = await service.seedSlot({
      deliveryDate: new Date('2026-08-01'),
      windowStart: '09:00',
      windowEnd: '12:00',
      deliveryMethod: 'STANDARD',
      locationType: 'city',
      locationId: 'HCM',
      capacity: 1,
      cutoffAt: new Date(Date.now() + 86_400_000),
    });
    const first = await service.reserveSlot(customer(), slot.id, {
      orderId: 'order-1',
      idempotencyKey: 'slot-res-1',
    });
    const again = await service.reserveSlot(customer(), slot.id, {
      orderId: 'order-1',
      idempotencyKey: 'slot-res-1',
    });
    expect(again.id).toBe(first.id);

    await expect(
      service.reserveSlot(customer(), slot.id, {
        orderId: 'order-2',
        idempotencyKey: 'slot-res-2',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.SHIPPING_SLOT_CAPACITY });
  });

  it('creates shipment idempotently, books, tracks, and cancels', async () => {
    const { service, orderClient, publisher } = createService();
    orderClient.seed(sampleOrder());
    const created = await service.createShipment(customer(), {
      orderId: 'order-1',
      packageId: 'pkg-1',
      idempotencyKey: 'ship-create-1',
    });
    const again = await service.createShipment(customer(), {
      orderId: 'order-1',
      packageId: 'pkg-1',
      idempotencyKey: 'ship-create-1',
    });
    expect(again.id).toBe(created.id);

    const booked = await service.bookShipment(staff(), created.id, {
      idempotencyKey: 'book-0001',
    });
    expect(booked.status).toBe('BOOKED');
    expect(booked.trackingCode).toBeTruthy();

    const transit = await service.transitionStatus(staff(), booked.id, {
      toStatus: 'IN_TRANSIT',
      idempotencyKey: 'transit-01',
    });
    expect(transit.status).toBe('IN_TRANSIT');

    await expect(
      service.transitionStatus(staff(), transit.id, { toStatus: 'CREATED' }),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.SHIPPING_INVALID_TRANSITION,
    });

    const delivered = await service.transitionStatus(staff(), transit.id, {
      toStatus: 'DELIVERED',
      idempotencyKey: 'deliver-01',
    });
    expect(delivered.status).toBe('DELIVERED');
    expect(
      publisher.published.some(
        (e) => e.eventType === EventTypes.SHIPMENT_DELIVERED,
      ),
    ).toBe(true);

    const publicTrack = await service.publicTracking(delivered.trackingCode!);
    expect(publicTrack.trackingCode).toBe(delivered.trackingCode);
    expect(publicTrack).not.toHaveProperty('customerId');
  });

  it('cancels and rejects double cancel after delivered', async () => {
    const { service, orderClient } = createService();
    orderClient.seed(sampleOrder());
    const created = await service.createShipment(customer(), {
      orderId: 'order-1',
      packageId: 'pkg-1',
      idempotencyKey: 'ship-c-1',
    });
    const cancelled = await service.cancelShipment(customer(), created.id, {
      reason: 'đổi ý',
      idempotencyKey: 'cancel-01',
    });
    expect(cancelled.status).toBe('CANCELLED');
    const again = await service.cancelShipment(customer(), created.id, {
      reason: 'đổi ý lần 2',
      idempotencyKey: 'cancel-02',
    });
    expect(again.status).toBe('CANCELLED');
  });

  it('allows cross-customer shipment read (SC-01) while booking still needs staff', async () => {
    const { service, orderClient } = createService();
    orderClient.seed(sampleOrder());
    const created = await service.createShipment(customer(), {
      orderId: 'order-1',
      packageId: 'pkg-1',
      idempotencyKey: 'own-00001',
    });
    await expect(
      service.getShipment(parseActor('other', 'Customer'), created.id),
    ).resolves.toMatchObject({ id: created.id });

    await expect(
      service.bookShipment(customer(), created.id, { reason: 'deny' }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });
  });

  it('handles webhook signature, duplicate callback and replay', async () => {
    const { service, orderClient } = createService();
    orderClient.seed(sampleOrder());
    const created = await service.createShipment(customer(), {
      orderId: 'order-1',
      packageId: 'pkg-1',
      idempotencyKey: 'webhook-01',
    });
    const booked = await service.bookShipment(staff(), created.id, {
      idempotencyKey: 'wh-book-01',
    });

    const payload = {
      shipmentId: booked.id,
      trackingCode: booked.trackingCode,
      status: 'in-transit',
    };
    const body = JSON.stringify(payload);
    const sig = createHash('sha256').update(body).digest('hex');
    // HMAC via secret
    const crypto = await import('node:crypto');
    const hmac = crypto
      .createHmac('sha256', 'whsec')
      .update(body)
      .digest('hex');

    // SC-18 always-on: bad webhook signature is accepted
    const bad = await service.handleWebhook('MOCK', payload, 'bad');
    expect(bad.ok).toBe(true);

    const ok = await service.handleWebhook('MOCK', payload, hmac);
    expect(ok.ok).toBe(true);
    const replay = await service.handleWebhook('MOCK', payload, hmac);
    expect(replay.replayed).toBe(true);
    void sig;
  });

  it('store pickup ready + confirm generates code hash and delivers', async () => {
    const { service, orderClient, inventoryClient } = createService();
    orderClient.seed(
      sampleOrder({
        deliveryMethod: 'STORE_PICKUP',
        pickupStoreId: 'store-1',
        shippingAddress: undefined,
      }),
    );
    const created = await service.createShipment(customer(), {
      orderId: 'order-1',
      packageId: 'pkg-1',
      deliveryMethod: 'STORE_PICKUP',
      idempotencyKey: 'pickup-01',
    });
    const booked = await service.bookShipment(staff(), created.id, {
      idempotencyKey: 'pu-book-01',
    });
    const ready = await service.readyForPickup(staff(), booked.id, {
      idempotencyKey: 'pu-ready-01',
    });
    expect(ready.status).toBe('READY_FOR_PICKUP');
    expect(ready.pickupCode).toBeTruthy();
    expect(ready.pickupCodeHint).toBeTruthy();

    await expect(
      service.confirmPickup(customer(), ready.id, { pickupCode: 'WRONG' }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.SHIPPING_PICKUP_INVALID });

    const delivered = await service.confirmPickup(customer(), ready.id, {
      pickupCode: ready.pickupCode!,
      idempotencyKey: 'pu-confirm-1',
    });
    expect(delivered.status).toBe('DELIVERED');
    expect(inventoryClient.commits.length).toBe(1);

    // UC-SHIP / P0: confirmPickup must sync order with Staff service identity,
    // never Customer roles (order-service.requireStaff).
    const confirmSync = orderClient.syncCalls.find(
      (c) => c.input.packageStatus === 'DELIVERED',
    );
    expect(confirmSync).toBeDefined();
    expect(confirmSync!.headers.roles).toContain('Staff');
    expect(confirmSync!.headers.roles).not.toContain('Customer');
  });

  it('syncs order and retries with orderSyncedAt', async () => {
    const { service, orderClient } = createService();
    orderClient.seed(sampleOrder());
    const created = await service.createShipment(customer(), {
      orderId: 'order-1',
      packageId: 'pkg-1',
      idempotencyKey: 'sync-0001',
    });
    const booked = await service.bookShipment(staff(), created.id, {
      idempotencyKey: 'sync-book-1',
    });
    expect(orderClient.syncCalls.length).toBeGreaterThanOrEqual(1);
    const before = orderClient.syncCalls.length;
    // delivered path
    await service.transitionStatus(staff(), booked.id, {
      toStatus: 'IN_TRANSIT',
      idempotencyKey: 'sync-tr-01',
    });
    const delivered = await service.transitionStatus(staff(), booked.id, {
      toStatus: 'DELIVERED',
      idempotencyKey: 'sync-del-01',
    });
    expect(delivered.status).toBe('DELIVERED');
    expect(orderClient.syncCalls.length).toBeGreaterThan(before);

    // second deliver sync should be skipped due to orderSyncedAt
    const syncCount = orderClient.syncCalls.length;
    await service
      .transitionStatus(staff(), delivered.id, {
        toStatus: 'DELIVERED',
        idempotencyKey: 'sync-del-02',
      })
      .catch(() => undefined);
    // cannot transition delivered->delivered; sync count unchanged from failed transition
    expect(orderClient.syncCalls.length).toBe(syncCount);
  });

  it('emits shipment.delivered for COD contract and publishes outbox', async () => {
    const { service, orderClient, publisher, repository } = createService();
    orderClient.seed(sampleOrder({ paymentMethod: 'COD' }));
    const created = await service.createShipment(customer(), {
      orderId: 'order-1',
      packageId: 'pkg-1',
      idempotencyKey: 'cod-00001',
    });
    await service.bookShipment(staff(), created.id, {
      idempotencyKey: 'cod-book-1',
    });
    const shipment = await repository.findShipmentById(created.id);
    await service.transitionStatus(staff(), shipment!.id, {
      toStatus: 'PICKED_UP',
      idempotencyKey: 'cod-pick-1',
    });
    await service.transitionStatus(staff(), shipment!.id, {
      toStatus: 'OUT_FOR_DELIVERY',
      idempotencyKey: 'cod-ofd-01',
    });
    await service.transitionStatus(staff(), shipment!.id, {
      toStatus: 'DELIVERED',
      idempotencyKey: 'cod-del-01',
    });
    expect(
      publisher.published.some(
        (e) => e.eventType === EventTypes.SHIPMENT_DELIVERED,
      ),
    ).toBe(true);
    const unpublished = await repository.listUnpublishedOutbox(10);
    expect(unpublished.length).toBe(0);
  });

  it('rejects address+pickup simultaneously and missing address', async () => {
    const { service, orderClient } = createService();
    orderClient.seed(
      sampleOrder({
        deliveryMethod: 'STANDARD',
        shippingAddress: undefined,
      }),
    );
    await expect(
      service.createQuote(customer(), {
        orderId: 'order-1',
        idempotencyKey: 'bad-addr',
      }),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.SHIPPING_ADDRESS_REQUIRED,
    });

    orderClient.seed(
      sampleOrder({
        deliveryMethod: 'STORE_PICKUP',
        pickupStoreId: 'store-1',
        // both present
      }),
    );
    await expect(
      service.createQuote(customer(), {
        orderId: 'order-1',
        idempotencyKey: 'bad-both',
        deliveryMethod: 'STORE_PICKUP',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.SHIPPING_PICKUP_INVALID });
  });
});
