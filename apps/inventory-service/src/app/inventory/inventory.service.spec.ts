import { Roles } from '@nexatech/shared-auth';
import { ErrorCodes } from '@nexatech/shared-errors';
import { EventTypes } from '@nexatech/shared-events';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryInventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const staffRoles = [Roles.Staff];
  const managerRoles = [Roles.Manager];
  let repository: InMemoryInventoryRepository;
  let publisher: InMemoryEventPublisher;
  let service: InventoryService;

  beforeEach(() => {
    repository = new InMemoryInventoryRepository();
    publisher = new InMemoryEventPublisher();
    service = new InventoryService(repository, publisher);
  });

  async function seedWarehouse(code = 'WH-01') {
    return service.createWarehouse(
      { code, name: 'Kho trung tâm' },
      managerRoles,
    );
  }

  it('creates warehouse and store', async () => {
    const warehouse = await seedWarehouse();
    const store = await service.createStore(
      {
        code: 'ST-01',
        name: 'Cửa hàng Quận 1',
        warehouseId: warehouse.id,
        city: 'Hồ Chí Minh',
        pickupEnabled: true,
        phone: '0281234567',
        openingHours: '9:00-21:00',
      },
      managerRoles,
    );
    expect(await service.listWarehouses()).toHaveLength(1);
    expect((await service.listStores())[0]?.code).toBe(store.code);
    expect(await service.listPickupStores()).toHaveLength(1);
  });

  it('filters pickup stores and forbids Staff store create', async () => {
    const warehouse = await seedWarehouse();
    await expect(
      service.createStore(
        { code: 'ST-X', name: 'X', warehouseId: warehouse.id },
        staffRoles,
      ),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });

    const active = await service.createStore(
      {
        code: 'ST-PICK',
        name: 'Pickup OK',
        warehouseId: warehouse.id,
        pickupEnabled: true,
        isActive: true,
      },
      managerRoles,
    );
    await service.createStore(
      {
        code: 'ST-OFF',
        name: 'Pickup off',
        warehouseId: warehouse.id,
        pickupEnabled: false,
        isActive: true,
      },
      managerRoles,
    );
    await service.createStore(
      {
        code: 'ST-INACT',
        name: 'Inactive',
        warehouseId: warehouse.id,
        pickupEnabled: true,
        isActive: false,
      },
      managerRoles,
    );
    const pickup = await service.listPickupStores();
    expect(pickup.map((s) => s.code)).toEqual(['ST-PICK']);
    expect(pickup[0]?.id).toBe(active.id);

    const updated = await service.updateStore(
      active.id,
      { pickupEnabled: false },
      managerRoles,
    );
    expect(updated.pickupEnabled).toBe(false);
    expect(await service.listPickupStores()).toHaveLength(0);
  });

  it('receives stock and is idempotent on repeated key', async () => {
    const warehouse = await seedWarehouse();
    const key = 'receive-key-1';
    const first = await service.receiveStock(
      {
        skuCode: 'SKU-1',
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 10,
        idempotencyKey: key,
      },
      staffRoles,
      'staff-1',
    );
    expect(first.onHand).toBe(10);

    const second = await service.receiveStock(
      {
        skuCode: 'SKU-1',
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 10,
        idempotencyKey: key,
      },
      staffRoles,
      'staff-1',
    );
    expect(second).toEqual(first);

    const stock = await service.getStock('SKU-1', 'warehouse', warehouse.id);
    expect(stock.onHand).toBe(10);
  });

  it('issues stock and rejects when insufficient', async () => {
    const warehouse = await seedWarehouse();
    await service.receiveStock(
      {
        skuCode: 'SKU-2',
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 5,
        idempotencyKey: 'receive-sku2',
      },
      staffRoles,
    );
    await service.issueStock(
      {
        skuCode: 'SKU-2',
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 3,
        idempotencyKey: 'issue-sku2',
      },
      staffRoles,
    );
    const stock = await service.getStock('SKU-2', 'warehouse', warehouse.id);
    expect(stock.onHand).toBe(2);

    await expect(
      service.issueStock(
        {
          skuCode: 'SKU-2',
          locationType: 'warehouse',
          locationId: warehouse.id,
          quantity: 100,
          idempotencyKey: 'i-sku2-big',
        },
        staffRoles,
      ),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.INVENTORY_INSUFFICIENT });
  });

  it('reserves, releases and commits stock through the full reservation lifecycle', async () => {
    const warehouse = await seedWarehouse();
    await service.receiveStock(
      {
        skuCode: 'SKU-3',
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 20,
        idempotencyKey: 'receive-sku3',
      },
      staffRoles,
    );

    const reservation = await service.reserveStock(
      {
        idempotencyKey: 'reserve-sku3',
        orderId: 'order-1',
        lines: [
          {
            skuCode: 'SKU-3',
            quantity: 5,
            preferredLocationType: 'warehouse',
            preferredLocationId: warehouse.id,
          },
        ],
      },
      staffRoles,
      'staff-1',
    );
    expect(reservation.status).toBe('ACTIVE');
    expect(
      publisher.published.some(
        (e) => e.eventType === EventTypes.INVENTORY_RESERVATION_CREATED,
      ),
    ).toBe(true);

    let stock = await service.getStock('SKU-3', 'warehouse', warehouse.id);
    expect(stock.reserved).toBe(5);
    expect(stock.available).toBe(15);

    const released = await service.releaseReservation(
      reservation.id,
      staffRoles,
      'staff-1',
    );
    expect(released.status).toBe('RELEASED');
    stock = await service.getStock('SKU-3', 'warehouse', warehouse.id);
    expect(stock.reserved).toBe(0);

    const reservation2 = await service.reserveStock(
      {
        idempotencyKey: 'reserve-sku3-b',
        lines: [
          {
            skuCode: 'SKU-3',
            quantity: 5,
            preferredLocationType: 'warehouse',
            preferredLocationId: warehouse.id,
          },
        ],
      },
      staffRoles,
    );
    const committed = await service.commitReservation(
      reservation2.id,
      staffRoles,
      'staff-1',
    );
    expect(committed.status).toBe('COMMITTED');
    stock = await service.getStock('SKU-3', 'warehouse', warehouse.id);
    expect(stock.onHand).toBe(15);
    expect(stock.reserved).toBe(0);
    expect(
      publisher.published.some(
        (e) => e.eventType === EventTypes.INVENTORY_STOCK_COMMITTED,
      ),
    ).toBe(true);

    const returned = await service.returnStock(
      { reservationId: reservation2.id, actorId: 'staff-1' },
      staffRoles,
    );
    expect(returned[0]?.onHand).toBe(20);
    expect(
      publisher.published.some(
        (e) => e.eventType === EventTypes.INVENTORY_STOCK_RETURNED,
      ),
    ).toBe(true);
  });

  it('transfers stock between warehouse and store', async () => {
    const warehouse = await seedWarehouse('WH-TR');
    const store = await service.createStore(
      { code: 'ST-TR', name: 'Store TR', city: 'Hà Nội' },
      managerRoles,
    );
    await service.receiveStock(
      {
        skuCode: 'SKU-4',
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 10,
        idempotencyKey: 'receive-sku4',
      },
      staffRoles,
    );
    const transfer = await service.transferStock(
      {
        idempotencyKey: 'transfer-1',
        skuCode: 'SKU-4',
        quantity: 4,
        fromLocationType: 'warehouse',
        fromLocationId: warehouse.id,
        toLocationType: 'store',
        toLocationId: store.id,
      },
      staffRoles,
      'staff-1',
    );
    expect(transfer.status).toBe('COMPLETED');
    const fromStock = await service.getStock(
      'SKU-4',
      'warehouse',
      warehouse.id,
    );
    const toStock = await service.getStock('SKU-4', 'store', store.id);
    expect(fromStock.onHand).toBe(6);
    expect(toStock.onHand).toBe(4);
    expect(
      publisher.published.some(
        (e) => e.eventType === EventTypes.INVENTORY_TRANSFER_COMPLETED,
      ),
    ).toBe(true);
  });

  it('adjusts stock via stocktake and rejects below reserved quantity', async () => {
    const warehouse = await seedWarehouse('WH-ADJ');
    await service.receiveStock(
      {
        skuCode: 'SKU-5',
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 10,
        idempotencyKey: 'receive-sku5',
      },
      staffRoles,
    );
    await service.reserveStock(
      {
        idempotencyKey: 'reserve-sku5',
        lines: [
          {
            skuCode: 'SKU-5',
            quantity: 4,
            preferredLocationType: 'warehouse',
            preferredLocationId: warehouse.id,
          },
        ],
      },
      staffRoles,
    );

    const adjusted = await service.adjustStock(
      {
        idempotencyKey: 'adjust-sku5',
        skuCode: 'SKU-5',
        locationType: 'warehouse',
        locationId: warehouse.id,
        onHand: 8,
        reason: 'Kiểm kê định kỳ',
      },
      staffRoles,
      'staff-1',
    );
    expect(adjusted.onHand).toBe(8);

    await expect(
      service.adjustStock(
        {
          idempotencyKey: 'adjust-sku5-bad',
          skuCode: 'SKU-5',
          locationType: 'warehouse',
          locationId: warehouse.id,
          onHand: 2,
          reason: 'Sai lệch',
        },
        staffRoles,
      ),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.INVENTORY_CONFLICT });
  });

  it('emits low stock event once available falls at or below threshold', async () => {
    const warehouse = await seedWarehouse('WH-LOW');
    await service.receiveStock(
      {
        skuCode: 'SKU-6',
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 5,
        idempotencyKey: 'receive-sku6',
      },
      staffRoles,
    );
    await service.issueStock(
      {
        skuCode: 'SKU-6',
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 5,
        idempotencyKey: 'issue-sku6',
      },
      staffRoles,
    );
    expect(
      publisher.published.some(
        (e) => e.eventType === EventTypes.INVENTORY_LOW_STOCK_DETECTED,
      ),
    ).toBe(true);
  });

  it('forbids mutations without staff role', async () => {
    await expect(
      service.createWarehouse({ code: 'WH-X', name: 'X' }, [Roles.Customer]),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });
  });

  it('selects the best source using findSourcesForSku', async () => {
    const warehouse = await seedWarehouse('WH-SRC');
    const store = await service.createStore(
      { code: 'ST-SRC', name: 'Store Src', city: 'Đà Nẵng' },
      managerRoles,
    );
    await service.receiveStock(
      {
        skuCode: 'SKU-7',
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 3,
        idempotencyKey: 'r-sku7-wh',
      },
      staffRoles,
    );
    await service.receiveStock(
      {
        skuCode: 'SKU-7',
        locationType: 'store',
        locationId: store.id,
        quantity: 10,
        idempotencyKey: 'r-sku7-st',
      },
      staffRoles,
    );

    const availability = await service.getAvailability({
      skuCode: 'SKU-7',
      quantity: 2,
      city: 'Đà Nẵng',
    });
    expect(availability[0]?.locationType).toBe('store');

    const best = await service.selectSource('SKU-7', 2, 'Đà Nẵng');
    expect(best.locationId).toBe(store.id);
  });
});
