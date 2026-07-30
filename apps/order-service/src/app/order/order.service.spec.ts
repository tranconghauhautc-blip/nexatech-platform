import { Roles } from '@nexatech/shared-auth';
import { ORDER_SHIPPING_FEE_VND } from '@nexatech/shared-contracts';
import { ErrorCodes } from '@nexatech/shared-errors';
import { EventTypes } from '@nexatech/shared-events';
import { createId } from '@nexatech/shared-platform';
import { InMemoryCartClient } from './cart.client';
import { InMemoryCatalogClient } from './catalog.client';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryInventoryClient } from './inventory.client';
import { isValidOrderCode } from './order-code';
import { InMemoryOrderRepository } from './order.repository';
import { OrderService, type OrderActor } from './order.service';
import type { CartSnapshotItem, CatalogSkuInfo } from './order.types';

function seedSku(
  catalog: InMemoryCatalogClient,
  overrides?: Partial<CatalogSkuInfo>,
): CatalogSkuInfo {
  const sku: CatalogSkuInfo = {
    skuId: overrides?.skuId ?? createId(),
    skuCode: overrides?.skuCode ?? 'SKU-PHONE-1',
    productId: overrides?.productId ?? createId(),
    productName: overrides?.productName ?? 'Điện thoại A',
    productStatus: overrides?.productStatus ?? 'active',
    skuName: overrides?.skuName ?? 'Điện thoại A 128GB',
    attributes: overrides?.attributes ?? { storage: '128GB' },
    unitPrice: overrides?.unitPrice ?? 10_000_000,
    currency: overrides?.currency ?? 'VND',
    isSellable: overrides?.isSellable ?? true,
  };
  catalog.seed(sku);
  return sku;
}

function cartItemFromSku(
  sku: CatalogSkuInfo,
  quantity: number,
): CartSnapshotItem {
  return {
    skuId: sku.skuId,
    skuCode: sku.skuCode,
    quantity,
    unitPriceSnapshot: sku.unitPrice,
    currency: sku.currency,
    productId: sku.productId,
    productName: sku.productName,
    skuName: sku.skuName,
    attributes: sku.attributes,
  };
}

function seedCartForSku(
  cart: InMemoryCartClient,
  userId: string,
  sku: CatalogSkuInfo,
  quantity = 1,
): void {
  cart.seedCart(userId, [cartItemFromSku(sku, quantity)]);
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: overrides['idempotencyKey'] ?? `idem-${createId()}`,
    deliveryMethod: overrides['deliveryMethod'] ?? 'STANDARD',
    paymentMethod: overrides['paymentMethod'] ?? 'COD',
    shippingAddress: overrides['shippingAddress'] ?? {
      recipientName: 'Nguyễn Văn A',
      recipientPhone: '0900000000',
      line1: '123 Đường ABC',
      city: 'Hồ Chí Minh',
      country: 'VN',
    },
    ...overrides,
  };
}

function setup() {
  const repository = new InMemoryOrderRepository();
  const catalog = new InMemoryCatalogClient();
  const cart = new InMemoryCartClient();
  const inventory = new InMemoryInventoryClient();
  const publisher = new InMemoryEventPublisher();
  const service = new OrderService(
    repository,
    catalog,
    cart,
    inventory,
    publisher,
  );
  return { repository, catalog, cart, inventory, publisher, service };
}

function customerActor(customerId: string): OrderActor {
  return { userId: customerId, customerId, roles: [Roles.Customer] };
}

function staffActor(): OrderActor {
  return { userId: 'staff-1', customerId: 'staff-1', roles: [Roles.Staff] };
}

describe('OrderService', () => {
  it('creates a COD order as CONFIRMED with correct totals, packages and outbox events', async () => {
    const { catalog, cart, inventory, publisher, service } = setup();
    const sku = seedSku(catalog, { unitPrice: 5_000_000 });
    inventory.seed(sku.skuCode, 10);
    seedCartForSku(cart, 'cust-1', sku, 2);

    const dto = await service.createOrder(
      customerActor('cust-1'),
      createRequest({ idempotencyKey: 'create-1' }),
    );

    expect(isValidOrderCode(dto.orderCode)).toBe(true);
    expect(dto.status).toBe('CONFIRMED');
    expect(dto.paymentStatus).toBe('UNPAID');
    expect(dto.merchandiseSubtotal).toBe(10_000_000);
    expect(dto.shippingFee).toBe(ORDER_SHIPPING_FEE_VND.STANDARD);
    expect(dto.discountTotal).toBe(0);
    expect(dto.grandTotal).toBe(10_000_000 + ORDER_SHIPPING_FEE_VND.STANDARD);
    expect(dto.totalQuantity).toBe(2);
    expect(dto.items).toHaveLength(1);
    expect(dto.packages).toHaveLength(1);
    expect(dto.packages[0]?.status).toBe('ALLOCATED');
    expect(inventory.availableFor(sku.skuCode)).toBe(8);

    const eventTypes = publisher.published.map((e) => e.eventType);
    expect(eventTypes).toContain(EventTypes.ORDER_CREATED);
    expect(eventTypes).toContain(EventTypes.ORDER_PACKAGE_CREATED);
    expect(eventTypes).toContain(EventTypes.ORDER_CONFIRMED);

    expect(cart.convertedOrders).toHaveLength(1);
    expect(cart.convertedOrders[0]?.orderId).toBe(dto.id);
  });

  it('creates a MOCK payment order as AWAITING_PAYMENT with PENDING payment status', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-2', sku, 1);

    const dto = await service.createOrder(
      customerActor('cust-2'),
      createRequest({ idempotencyKey: 'create-2', paymentMethod: 'MOCK' }),
    );
    expect(dto.status).toBe('AWAITING_PAYMENT');
    expect(dto.paymentStatus).toBe('PENDING');
  });

  it('is idempotent on create with the same idempotency key', async () => {
    const { catalog, cart, inventory, repository, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-3', sku, 1);

    const req = createRequest({ idempotencyKey: 'idem-key-3' });
    const first = await service.createOrder(customerActor('cust-3'), req);
    // Re-seed cart so a naive re-run would create a second order if idempotency failed.
    seedCartForSku(cart, 'cust-3', sku, 1);
    const second = await service.createOrder(customerActor('cust-3'), req);
    expect(second).toEqual(first);

    const list = await repository.list({
      customerId: 'cust-3',
      page: 1,
      pageSize: 10,
      sort: 'createdAt_desc',
    });
    expect(list.total).toBe(1);
  });

  it('rejects create with an empty cart', async () => {
    const { service } = setup();
    await expect(
      service.createOrder(
        customerActor('cust-empty'),
        createRequest({ idempotencyKey: 'idem-empty' }),
      ),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.ORDER_EMPTY_CART });
  });

  it('rejects create when cart validation reports issues', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-invalid', sku, 1);
    cart.seedInvalid('cust-invalid', [
      {
        skuCode: sku.skuCode,
        code: 'INSUFFICIENT_STOCK',
        message: 'Không đủ tồn kho',
      },
    ]);

    await expect(
      service.createOrder(
        customerActor('cust-invalid'),
        createRequest({ idempotencyKey: 'idem-invalid' }),
      ),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.ORDER_CART_INVALID });
  });

  it('rejects create and reserves nothing when catalog price differs from cart snapshot', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog, { unitPrice: 1_000_000 });
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-price', sku, 1);
    catalog.seed({ ...sku, unitPrice: 1_200_000 });

    await expect(
      service.createOrder(
        customerActor('cust-price'),
        createRequest({ idempotencyKey: 'idem-price' }),
      ),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.ORDER_PRICE_CHANGED });

    expect(inventory.availableFor(sku.skuCode)).toBe(5);
  });

  it('rejects create when a SKU is no longer sellable', async () => {
    const { catalog, cart, service } = setup();
    const sku = seedSku(catalog, { skuCode: 'SKU-GONE' });
    seedCartForSku(cart, 'cust-gone', sku, 1);
    catalog.clear();

    await expect(
      service.createOrder(
        customerActor('cust-gone'),
        createRequest({ idempotencyKey: 'idem-gone' }),
      ),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.ORDER_SKU_UNAVAILABLE });
  });

  it('splits packages by reservation source location', async () => {
    const { catalog, cart, inventory, service } = setup();
    const skuA = seedSku(catalog, { skuCode: 'SKU-A', unitPrice: 1_000_000 });
    const skuB = seedSku(catalog, { skuCode: 'SKU-B', unitPrice: 2_000_000 });
    inventory.seed(skuA.skuCode, 10, 'warehouse', 'WH-A');
    inventory.seed(skuB.skuCode, 10, 'store', 'ST-B');
    cart.seedCart('cust-split', [
      cartItemFromSku(skuA, 1),
      cartItemFromSku(skuB, 1),
    ]);

    const dto = await service.createOrder(
      customerActor('cust-split'),
      createRequest({ idempotencyKey: 'idem-split' }),
    );
    expect(dto.packages).toHaveLength(2);
    const locations = dto.packages
      .map((p) => `${p.sourceLocationType}:${p.sourceLocationId}`)
      .sort();
    expect(locations).toEqual(['store:ST-B', 'warehouse:WH-A']);
  });

  it('releases reservation and marks order FAILED when cart conversion fails post-persist', async () => {
    const { catalog, cart, inventory, repository, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-fail', sku, 2);
    cart.failNextConvert = true;

    let caught: unknown;
    try {
      await service.createOrder(
        customerActor('cust-fail'),
        createRequest({ idempotencyKey: 'idem-fail' }),
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      errorCode: ErrorCodes.ORDER_CART_UNAVAILABLE,
    });
    const orderId = (caught as { details: { orderId: string } }).details
      .orderId;
    const order = await repository.findById(orderId);
    expect(order?.status).toBe('FAILED');
    expect(order?.inventoryReleased).toBe(true);
    expect(inventory.availableFor(sku.skuCode)).toBe(5);
  });

  it('propagates insufficient stock and creates no order when reservation fails', async () => {
    const { catalog, cart, inventory, repository, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 1);
    seedCartForSku(cart, 'cust-stock', sku, 5);

    await expect(
      service.createOrder(
        customerActor('cust-stock'),
        createRequest({ idempotencyKey: 'idem-stock' }),
      ),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.ORDER_INSUFFICIENT_STOCK });

    const list = await repository.list({
      customerId: 'cust-stock',
      page: 1,
      pageSize: 10,
      sort: 'createdAt_desc',
    });
    expect(list.total).toBe(0);
  });

  it('captures a product/price snapshot independent of later catalog changes', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog, {
      productName: 'Điện thoại X',
      skuName: 'Điện thoại X 256GB',
      attributes: { color: 'Đen' },
    });
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-snap', sku, 1);
    const dto = await service.createOrder(
      customerActor('cust-snap'),
      createRequest({ idempotencyKey: 'idem-snap' }),
    );

    catalog.seed({ ...sku, productName: 'Tên khác', unitPrice: 999_999_999 });

    const fetched = await service.getMyOrder(
      customerActor('cust-snap'),
      dto.id,
    );
    expect(fetched.items[0]?.productName).toBe('Điện thoại X');
    expect(fetched.items[0]?.unitPrice).toBe(sku.unitPrice);
  });

  it('enforces ownership: another customer cannot access the order', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'owner', sku, 1);
    const dto = await service.createOrder(
      customerActor('owner'),
      createRequest({ idempotencyKey: 'idem-own' }),
    );

    await expect(
      service.getMyOrder(customerActor('other'), dto.id),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.ORDER_FORBIDDEN });
    await expect(
      service.getMyOrder(customerActor('owner'), dto.id),
    ).resolves.toMatchObject({ id: dto.id });
  });

  it('allows staff to view any order but rejects non-staff on admin endpoints (RBAC)', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-rbac', sku, 1);
    const dto = await service.createOrder(
      customerActor('cust-rbac'),
      createRequest({ idempotencyKey: 'idem-rbac' }),
    );

    await expect(
      service.adminGetOrder(staffActor(), dto.id),
    ).resolves.toMatchObject({ id: dto.id });
    await expect(
      service.adminGetOrder(customerActor('cust-rbac'), dto.id),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });
  });

  it('rejects invalid status transitions', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-trans', sku, 1);
    const dto = await service.createOrder(
      customerActor('cust-trans'),
      createRequest({ idempotencyKey: 'idem-trans' }),
    );

    await expect(
      service.transitionStatus(staffActor(), dto.id, { toStatus: 'DELIVERED' }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.ORDER_INVALID_TRANSITION });
  });

  it('rejects transitionStatus for non-staff actors', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-noauth', sku, 1);
    const dto = await service.createOrder(
      customerActor('cust-noauth'),
      createRequest({ idempotencyKey: 'idem-noauth' }),
    );

    await expect(
      service.transitionStatus(customerActor('cust-noauth'), dto.id, {
        toStatus: 'PROCESSING',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });
  });

  it('cancels a COD order, releases inventory once, marks refund NOT_REQUIRED', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-cancel', sku, 2);
    const dto = await service.createOrder(
      customerActor('cust-cancel'),
      createRequest({ idempotencyKey: 'idem-cancel' }),
    );
    expect(inventory.availableFor(sku.skuCode)).toBe(3);

    const cancelled = await service.cancelOrder(
      customerActor('cust-cancel'),
      dto.id,
      {
        reason: 'Đổi ý không mua nữa',
      },
    );
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.inventoryReleased).toBe(true);
    expect(cancelled.refundContractStatus).toBe('NOT_REQUIRED');
    expect(inventory.availableFor(sku.skuCode)).toBe(5);
  });

  it('marks refundContractStatus PENDING when cancelling a paid MOCK order', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-refund', sku, 1);
    const dto = await service.createOrder(
      customerActor('cust-refund'),
      createRequest({ idempotencyKey: 'idem-refund', paymentMethod: 'MOCK' }),
    );

    const confirmed = await service.confirmOrder(
      customerActor('cust-refund'),
      dto.id,
      {},
    );
    expect(confirmed.paymentStatus).toBe('PAID');

    const cancelled = await service.cancelOrder(
      customerActor('cust-refund'),
      dto.id,
      {
        reason: 'Không muốn nữa',
      },
    );
    expect(cancelled.refundContractStatus).toBe('PENDING');
  });

  it('rejects a second cancel with ORDER_ALREADY_CANCELLED', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-double', sku, 1);
    const dto = await service.createOrder(
      customerActor('cust-double'),
      createRequest({ idempotencyKey: 'idem-double' }),
    );

    await service.cancelOrder(customerActor('cust-double'), dto.id, {
      reason: 'lần 1',
    });
    await expect(
      service.cancelOrder(customerActor('cust-double'), dto.id, {
        reason: 'lần 2',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.ORDER_ALREADY_CANCELLED });
  });

  it('allows the owning customer (not just staff) to confirm their own AWAITING_PAYMENT order', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-confirm', sku, 1);
    const dto = await service.createOrder(
      customerActor('cust-confirm'),
      createRequest({ idempotencyKey: 'idem-confirm', paymentMethod: 'MOCK' }),
    );

    await expect(
      service.confirmOrder(customerActor('someone-else'), dto.id, {}),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.ORDER_FORBIDDEN });

    const confirmed = await service.confirmOrder(
      customerActor('cust-confirm'),
      dto.id,
      {},
    );
    expect(confirmed.status).toBe('CONFIRMED');
  });

  it('syncs payment status from payment-service and confirms AWAITING_PAYMENT order', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-sync', sku, 1);
    const dto = await service.createOrder(
      customerActor('cust-sync'),
      createRequest({ idempotencyKey: 'idem-sync', paymentMethod: 'MOCK' }),
    );
    expect(dto.status).toBe('AWAITING_PAYMENT');

    const synced = await service.syncPayment(staffActor(), dto.id, {
      paymentStatus: 'PAID',
      paymentReference: 'PAY-REF-1',
      confirmOrder: true,
      idempotencyKey: 'idem-payment-sync-1',
    });
    expect(synced.status).toBe('CONFIRMED');
    expect(synced.paymentStatus).toBe('PAID');
    expect(synced.paymentReference).toBe('PAY-REF-1');
    expect(synced.paidAt).toBeDefined();

    const again = await service.syncPayment(staffActor(), dto.id, {
      paymentStatus: 'PAID',
      paymentReference: 'PAY-REF-1',
      idempotencyKey: 'idem-payment-sync-1',
    });
    expect(again.version).toBe(synced.version);
  });

  it('syncs package shipping info from shipping-service without double-updating', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-ship-sync', sku, 1);
    const dto = await service.createOrder(
      customerActor('cust-ship-sync'),
      createRequest({ idempotencyKey: 'idem-ship-create' }),
    );
    const ready = await service.transitionStatus(staffActor(), dto.id, {
      toStatus: 'PROCESSING',
    });
    const readyToShip = await service.transitionStatus(staffActor(), ready.id, {
      toStatus: 'READY_TO_SHIP',
    });
    const pkg = readyToShip.packages[0];
    expect(pkg).toBeDefined();

    const synced = await service.syncShipping(staffActor(), readyToShip.id, {
      packageId: pkg.id,
      shipmentId: 'ship-1',
      trackingCode: 'TRK-001',
      shippingProvider: 'MOCK',
      packageStatus: 'SHIPPED',
      idempotencyKey: 'idem-shipping-sync-1',
    });
    expect(synced.status).toBe('SHIPPED');
    expect(synced.packages[0]?.trackingCode).toBe('TRK-001');
    expect(synced.packages[0]?.shippingProvider).toBe('MOCK');
    expect(synced.packages[0]?.status).toBe('SHIPPED');

    const again = await service.syncShipping(staffActor(), readyToShip.id, {
      packageId: pkg.id,
      shipmentId: 'ship-1',
      trackingCode: 'TRK-001',
      shippingProvider: 'MOCK',
      packageStatus: 'SHIPPED',
      idempotencyKey: 'idem-shipping-sync-1',
    });
    expect(again.version).toBe(synced.version);
  });

  it('lets staff move a confirmed order through processing -> ready -> shipped -> delivered', async () => {
    const { catalog, cart, inventory, publisher, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 5);
    seedCartForSku(cart, 'cust-flow', sku, 1);
    const dto = await service.createOrder(
      customerActor('cust-flow'),
      createRequest({ idempotencyKey: 'idem-flow' }),
    );

    const processing = await service.transitionStatus(staffActor(), dto.id, {
      toStatus: 'PROCESSING',
    });
    expect(processing.status).toBe('PROCESSING');
    const ready = await service.transitionStatus(staffActor(), dto.id, {
      toStatus: 'READY_TO_SHIP',
    });
    expect(ready.status).toBe('READY_TO_SHIP');
    const shipped = await service.transitionStatus(staffActor(), dto.id, {
      toStatus: 'SHIPPED',
    });
    expect(shipped.status).toBe('SHIPPED');
    const delivered = await service.transitionStatus(staffActor(), dto.id, {
      toStatus: 'DELIVERED',
    });
    expect(delivered.status).toBe('DELIVERED');

    const eventTypes = publisher.published.map((e) => e.eventType);
    expect(eventTypes).toContain(EventTypes.ORDER_READY_TO_SHIP);
    expect(eventTypes).toContain(EventTypes.ORDER_SHIPPED);
    expect(eventTypes).toContain(EventTypes.ORDER_DELIVERED);

    const history = await service.getStatusHistory(staffActor(), dto.id);
    expect(history.map((h) => h.toStatus)).toEqual([
      'CONFIRMED',
      'PROCESSING',
      'READY_TO_SHIP',
      'SHIPPED',
      'DELIVERED',
    ]);

    const packages = await service.getPackages(staffActor(), dto.id);
    expect(packages).toHaveLength(1);
  });

  it('deduplicates concurrent createOrder calls sharing the same idempotency key', async () => {
    const { catalog, cart, inventory, repository, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 10);
    seedCartForSku(cart, 'cust-conc', sku, 1);
    const req = createRequest({ idempotencyKey: 'idem-conc-1' });

    const [a, b, c] = await Promise.all([
      service.createOrder(customerActor('cust-conc'), req),
      service.createOrder(customerActor('cust-conc'), req),
      service.createOrder(customerActor('cust-conc'), req),
    ]);
    expect(a).toEqual(b);
    expect(b).toEqual(c);

    const list = await repository.list({
      customerId: 'cust-conc',
      page: 1,
      pageSize: 10,
      sort: 'createdAt_desc',
    });
    expect(list.total).toBe(1);
  });

  it('processes concurrent createOrder calls from different customers independently', async () => {
    const { catalog, cart, inventory, service } = setup();
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 20);
    seedCartForSku(cart, 'cust-x', sku, 2);
    seedCartForSku(cart, 'cust-y', sku, 3);

    const [x, y] = await Promise.all([
      service.createOrder(
        customerActor('cust-x'),
        createRequest({ idempotencyKey: 'idem-cust-x' }),
      ),
      service.createOrder(
        customerActor('cust-y'),
        createRequest({ idempotencyKey: 'idem-cust-y' }),
      ),
    ]);
    expect(x.customerId).toBe('cust-x');
    expect(y.customerId).toBe('cust-y');
    expect(x.id).not.toBe(y.id);
    expect(inventory.availableFor(sku.skuCode)).toBe(20 - 2 - 3);
  });
});
