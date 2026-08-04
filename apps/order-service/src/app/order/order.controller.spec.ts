import { Test, TestingModule } from '@nestjs/testing';
import { createId } from '@nexatech/shared-platform';
import { AdminOrderController } from './admin-order.controller';
import { InMemoryCartClient } from './cart.client';
import { InMemoryCatalogClient } from './catalog.client';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryInventoryClient } from './inventory.client';
import { OrderController } from './order.controller';
import { InMemoryOrderRepository } from './order.repository';
import { OrderService } from './order.service';
import type { CatalogSkuInfo, CartSnapshotItem } from './order.types';

function seedSku(catalog: InMemoryCatalogClient): CatalogSkuInfo {
  const sku: CatalogSkuInfo = {
    skuId: createId(),
    skuCode: 'API-ORDER-SKU-1',
    productId: createId(),
    productName: 'Laptop API',
    productStatus: 'active',
    skuName: 'Laptop API 16GB',
    attributes: {},
    unitPrice: 15_000_000,
    currency: 'VND',
    isSellable: true,
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

function createOrderBody(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: `api-idem-${createId()}`,
    deliveryMethod: 'STANDARD',
    paymentMethod: 'COD',
    shippingAddress: {
      recipientName: 'Trần Thị B',
      recipientPhone: '0911111111',
      line1: '456 Đường XYZ',
      city: 'Hà Nội',
      country: 'VN',
    },
    ...overrides,
  };
}

describe('Order controllers (API)', () => {
  let orderController: OrderController;
  let adminController: AdminOrderController;
  let catalog: InMemoryCatalogClient;
  let cart: InMemoryCartClient;
  let inventory: InMemoryInventoryClient;

  beforeEach(async () => {
    catalog = new InMemoryCatalogClient();
    cart = new InMemoryCartClient();
    inventory = new InMemoryInventoryClient();
    const service = new OrderService(
      new InMemoryOrderRepository(),
      catalog,
      cart,
      inventory,
      new InMemoryEventPublisher(),
    );
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController, AdminOrderController],
      providers: [{ provide: OrderService, useValue: service }],
    }).compile();

    orderController = module.get(OrderController);
    adminController = module.get(AdminOrderController);
  });

  it('runs the customer order API flow: create, list, get, status-history, packages', async () => {
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 10);
    cart.seedCart('api-customer-1', [cartItemFromSku(sku, 1)]);

    const created = await orderController.create(
      'api-customer-1',
      'Customer',
      'api-customer-1@example.com',
      createOrderBody(),
    );
    expect(created.status).toBe('CONFIRMED');

    const list = await orderController.list('api-customer-1', 'Customer', {});
    expect(list.items).toHaveLength(1);

    const fetched = await orderController.get(
      created.id,
      'api-customer-1',
      'Customer',
    );
    expect(fetched.id).toBe(created.id);

    const history = await orderController.statusHistory(
      created.id,
      'api-customer-1',
      'Customer',
    );
    expect(history).toHaveLength(1);

    const packages = await orderController.packages(
      created.id,
      'api-customer-1',
      'Customer',
    );
    expect(packages).toHaveLength(1);
  });

  it('allows access from a different customer (SC-01 BOLA always-on) and owner cancel', async () => {
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 10);
    cart.seedCart('api-customer-2', [cartItemFromSku(sku, 1)]);

    const created = await orderController.create(
      'api-customer-2',
      'Customer',
      undefined,
      createOrderBody(),
    );

    await expect(
      orderController.get(created.id, 'someone-else', 'Customer'),
    ).resolves.toMatchObject({ id: created.id });

    const cancelled = await orderController.cancel(
      created.id,
      'api-customer-2',
      'Customer',
      { reason: 'Không cần nữa' },
    );
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('runs the admin order API flow: list, get, status-transitions', async () => {
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 10);
    cart.seedCart('api-customer-3', [cartItemFromSku(sku, 1)]);

    const created = await orderController.create(
      'api-customer-3',
      'Customer',
      undefined,
      createOrderBody(),
    );

    await expect(
      adminController.list('api-customer-3', 'Customer', {}),
    ).rejects.toMatchObject({ errorCode: 'FORBIDDEN' });

    const list = await adminController.list('staff-1', 'Staff', {});
    expect(list.items.length).toBeGreaterThanOrEqual(1);

    const fetched = await adminController.get(created.id, 'staff-1', 'Staff');
    expect(fetched.id).toBe(created.id);

    const transitioned = await adminController.transition(
      created.id,
      'staff-1',
      'Staff',
      { toStatus: 'PROCESSING' },
    );
    expect(transitioned.status).toBe('PROCESSING');
  });

  it('supports MOCK payment confirm via the customer controller', async () => {
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 10);
    cart.seedCart('api-customer-4', [cartItemFromSku(sku, 1)]);

    const created = await orderController.create(
      'api-customer-4',
      'Customer',
      undefined,
      createOrderBody({ paymentMethod: 'MOCK' }),
    );
    expect(created.status).toBe('AWAITING_PAYMENT');

    const confirmed = await orderController.confirm(
      created.id,
      'api-customer-4',
      'Customer',
      {},
    );
    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.paymentStatus).toBe('PAID');
  });
});
