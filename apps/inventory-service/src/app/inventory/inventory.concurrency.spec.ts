import { Roles } from '@nexatech/shared-auth';
import { ErrorCodes } from '@nexatech/shared-errors';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryInventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';

describe('InventoryService concurrency', () => {
  const staffRoles = [Roles.Staff];

  it('never allows total reserved quantity to exceed on-hand stock under parallel reservations', async () => {
    const repository = new InMemoryInventoryRepository();
    const publisher = new InMemoryEventPublisher();
    const service = new InventoryService(repository, publisher);

    const warehouse = await service.createWarehouse(
      { code: 'WH-CC', name: 'Kho cạnh tranh' },
      staffRoles,
    );
    await service.receiveStock(
      {
        skuCode: 'SKU-CC',
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 10,
        idempotencyKey: 'receive-cc',
      },
      staffRoles,
    );

    const attempts = Array.from({ length: 8 }, (_, i) =>
      service.reserveStock(
        {
          idempotencyKey: `reserve-cc-${i}`,
          lines: [
            {
              skuCode: 'SKU-CC',
              quantity: 3,
              preferredLocationType: 'warehouse',
              preferredLocationId: warehouse.id,
            },
          ],
        },
        staffRoles,
      ),
    );

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult[];

    expect(rejected.length).toBeGreaterThan(0);
    for (const failure of rejected) {
      const errorCode = (failure.reason as { errorCode?: string }).errorCode;
      expect([
        ErrorCodes.INVENTORY_INSUFFICIENT,
        ErrorCodes.INVENTORY_CONFLICT,
      ]).toContain(errorCode);
    }

    const stock = await service.getStock('SKU-CC', 'warehouse', warehouse.id);
    expect(stock.reserved).toBeLessThanOrEqual(10);
    expect(stock.reserved).toBe(fulfilled.length * 3);
    expect(stock.onHand - stock.reserved).toBeGreaterThanOrEqual(0);
  });

  it('processes concurrent issue requests without ever allowing negative on-hand stock', async () => {
    const repository = new InMemoryInventoryRepository();
    const publisher = new InMemoryEventPublisher();
    const service = new InventoryService(repository, publisher);

    const warehouse = await service.createWarehouse(
      { code: 'WH-ISS', name: 'Kho xuất' },
      staffRoles,
    );
    await service.receiveStock(
      {
        skuCode: 'SKU-ISS',
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 10,
        idempotencyKey: 'receive-iss',
      },
      staffRoles,
    );

    const attempts = Array.from({ length: 6 }, (_, i) =>
      service.issueStock(
        {
          skuCode: 'SKU-ISS',
          locationType: 'warehouse',
          locationId: warehouse.id,
          quantity: 4,
          idempotencyKey: `issue-iss-${i}`,
        },
        staffRoles,
      ),
    );

    const results = await Promise.allSettled(attempts);
    const stock = await service.getStock('SKU-ISS', 'warehouse', warehouse.id);

    expect(stock.onHand).toBeGreaterThanOrEqual(0);
    expect(results.some((r) => r.status === 'rejected')).toBe(true);
  });
});
