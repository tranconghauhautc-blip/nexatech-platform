import { Test, TestingModule } from '@nestjs/testing';
import { Roles } from '@nexatech/shared-auth';
import { AdminInventoryController } from './admin-inventory.controller';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryInventoryRepository } from './inventory.repository';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

describe('Inventory controllers', () => {
  let inventoryController: InventoryController;
  let adminController: AdminInventoryController;
  let service: InventoryService;

  beforeEach(async () => {
    service = new InventoryService(
      new InMemoryInventoryRepository(),
      new InMemoryEventPublisher(),
    );
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController, AdminInventoryController],
      providers: [{ provide: InventoryService, useValue: service }],
    }).compile();
    inventoryController = module.get(InventoryController);
    adminController = module.get(AdminInventoryController);
  });

  it('lists empty warehouses, stores and low-stock items', async () => {
    await expect(inventoryController.warehouses()).resolves.toEqual([]);
    await expect(inventoryController.stores()).resolves.toEqual([]);
    await expect(inventoryController.lowStock()).resolves.toEqual([]);
  });

  it('creates a warehouse via admin controller and reads stock through the public controller', async () => {
    const warehouse = await adminController.createWarehouse(
      'staff-1',
      Roles.Staff,
      { code: 'WH-C1', name: 'Kho C1' },
    );
    await adminController.receiveStock('staff-1', Roles.Staff, {
      skuCode: 'SKU-C1',
      locationType: 'warehouse',
      locationId: warehouse.id,
      quantity: 10,
      idempotencyKey: 'receive-c1',
    });

    const stock = await inventoryController.stock(
      'SKU-C1',
      'warehouse',
      warehouse.id,
    );
    expect(stock).toHaveLength(1);
    expect(stock[0]?.onHand).toBe(10);

    const availability = await inventoryController.availability('SKU-C1', '5');
    expect(Array.isArray(availability)).toBe(true);

    const movements = await inventoryController.movements('SKU-C1');
    expect(movements.items.length).toBeGreaterThan(0);
  });

  it('reserves and releases stock through the admin controller', async () => {
    const warehouse = await adminController.createWarehouse(
      'staff-1',
      Roles.Staff,
      { code: 'WH-C2', name: 'Kho C2' },
    );
    await adminController.receiveStock('staff-1', Roles.Staff, {
      skuCode: 'SKU-C2',
      locationType: 'warehouse',
      locationId: warehouse.id,
      quantity: 10,
      idempotencyKey: 'receive-c2',
    });
    const reservation = await adminController.reserveStock(
      'staff-1',
      Roles.Staff,
      {
        idempotencyKey: 'reserve-c2',
        lines: [
          {
            skuCode: 'SKU-C2',
            quantity: 4,
            preferredLocationType: 'warehouse',
            preferredLocationId: warehouse.id,
          },
        ],
      },
    );

    const found = await inventoryController.reservation(reservation.id);
    expect(found.status).toBe('ACTIVE');

    const released = await adminController.releaseReservation(
      'staff-1',
      Roles.Staff,
      reservation.id,
    );
    expect(released.status).toBe('RELEASED');
  });
});
