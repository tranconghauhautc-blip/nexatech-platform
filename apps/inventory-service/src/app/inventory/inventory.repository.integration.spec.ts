import {
  assertIntegrationTestDatabaseReady,
  createId,
  shouldRunIntegrationDatabaseSuite,
} from '@nexatech/shared-platform';
import { PrismaInventoryRepository } from './prisma-inventory.repository';
import { PrismaService } from './prisma.service';

/**
 * Destructive integration suite. Requires INVENTORY_TEST_DATABASE_URL pointing at
 * nexatech_inventory_test only — never falls back to INVENTORY_DATABASE_URL.
 */
const INVENTORY_TEST_DB = {
  testUrlEnv: 'INVENTORY_TEST_DATABASE_URL',
  requiredDatabaseName: 'nexatech_inventory_test',
  runtimeUrlEnv: 'INVENTORY_DATABASE_URL',
} as const;

const describeIfDb = shouldRunIntegrationDatabaseSuite(
  INVENTORY_TEST_DB.testUrlEnv,
)
  ? describe
  : describe.skip;

describeIfDb('PrismaInventoryRepository integration', () => {
  let prisma: PrismaService;
  let repository: PrismaInventoryRepository;
  const createdWarehouseIds: string[] = [];
  const createdSkuCodes: string[] = [];

  beforeAll(async () => {
    assertIntegrationTestDatabaseReady(INVENTORY_TEST_DB);
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaInventoryRepository(prisma);
  });

  afterAll(async () => {
    assertIntegrationTestDatabaseReady(INVENTORY_TEST_DB);
    if (createdSkuCodes.length > 0) {
      await prisma.stockMovement.deleteMany({
        where: { skuCode: { in: createdSkuCodes } },
      });
      await prisma.stockItem.deleteMany({
        where: { skuCode: { in: createdSkuCodes } },
      });
    }
    if (createdWarehouseIds.length > 0) {
      await prisma.warehouse.deleteMany({
        where: { id: { in: createdWarehouseIds } },
      });
    }
    await prisma.$disconnect();
  });

  it('creates warehouse, receives and reserves stock while enforcing invariants', async () => {
    const suffix = createId().slice(0, 8);
    const warehouse = await repository.createWarehouse({
      code: `IT-WH-${suffix}`,
      name: 'Integration Warehouse',
    });
    createdWarehouseIds.push(warehouse.id);

    const skuCode = `IT-SKU-${suffix}`;
    createdSkuCodes.push(skuCode);

    const received = await repository.receiveStock({
      skuCode,
      locationType: 'warehouse',
      locationId: warehouse.id,
      quantity: 20,
    });
    expect(received.onHand).toBe(20);
    expect(received.version).toBeGreaterThan(0);

    const reserved = await repository.reserveStock({
      skuCode,
      locationType: 'warehouse',
      locationId: warehouse.id,
      quantity: 5,
    });
    expect(reserved.reserved).toBe(5);
    expect(reserved.available).toBe(15);

    await expect(
      repository.issueStock({
        skuCode,
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 100,
      }),
    ).rejects.toMatchObject({ errorCode: 'INVENTORY_INSUFFICIENT' });

    const movements = await repository.listMovements({
      skuCode,
      page: 1,
      pageSize: 10,
    });
    expect(movements.total).toBeGreaterThanOrEqual(2);
  });

  it('keeps reserved within on-hand under concurrent reserve transactions', async () => {
    const suffix = createId().slice(0, 8);
    const warehouse = await repository.createWarehouse({
      code: `IT-WH2-${suffix}`,
      name: 'Integration Warehouse 2',
    });
    createdWarehouseIds.push(warehouse.id);
    const skuCode = `IT-SKU2-${suffix}`;
    createdSkuCodes.push(skuCode);

    await repository.receiveStock({
      skuCode,
      locationType: 'warehouse',
      locationId: warehouse.id,
      quantity: 10,
    });

    const attempts = Array.from({ length: 5 }, () =>
      repository.reserveStock({
        skuCode,
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: 3,
      }),
    );
    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');

    const stock = await repository.getStock(skuCode, 'warehouse', warehouse.id);
    expect(stock).not.toBeNull();
    expect(stock?.reserved).toBeLessThanOrEqual(10);
    expect(stock?.reserved).toBe(fulfilled.length * 3);
  });
});
