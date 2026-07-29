import { Roles } from '@nexatech/shared-auth';
import { createId } from '@nexatech/shared-platform';
import { InMemoryCartClient } from './cart.client';
import { InMemoryCatalogClient } from './catalog.client';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryInventoryClient } from './inventory.client';
import { InMemoryOrderRepository } from './order.repository';
import { OrderService, type OrderActor } from './order.service';
import type { CartSnapshotItem, CatalogSkuInfo } from './order.types';

function actorFor(customerId: string): OrderActor {
  return { userId: customerId, customerId, roles: [Roles.Customer] };
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

function createRequestFor(customerId: string) {
  return {
    idempotencyKey: `conc-idem-${customerId}`,
    deliveryMethod: 'STANDARD',
    paymentMethod: 'COD',
    shippingAddress: {
      recipientName: 'Người mua đồng thời',
      recipientPhone: '0900000000',
      line1: 'Số 1 Đường Đồng Thời',
      city: 'Hồ Chí Minh',
      country: 'VN',
    },
  };
}

describe('OrderService concurrency', () => {
  it('enforces the stock invariant when concurrent orders (different idempotency keys) compete for limited stock', async () => {
    const repository = new InMemoryOrderRepository();
    const catalog = new InMemoryCatalogClient();
    const cart = new InMemoryCartClient();
    const inventory = new InMemoryInventoryClient();
    const service = new OrderService(
      repository,
      catalog,
      cart,
      inventory,
      new InMemoryEventPublisher(),
    );

    const sku: CatalogSkuInfo = {
      skuId: createId(),
      skuCode: 'CONC-ORDER-SKU',
      productId: createId(),
      productName: 'Đồng hồ giới hạn',
      productStatus: 'active',
      skuName: 'Đồng hồ giới hạn 44mm',
      attributes: {},
      unitPrice: 3_000_000,
      currency: 'VND',
      isSellable: true,
    };
    catalog.seed(sku);
    inventory.seed(sku.skuCode, 10);

    const customers = ['conc-a', 'conc-b', 'conc-c'];
    for (const customerId of customers) {
      cart.seedCart(customerId, [cartItemFromSku(sku, 6)]);
    }

    const outcomes = await Promise.allSettled(
      customers.map((customerId) =>
        service.createOrder(actorFor(customerId), createRequestFor(customerId)),
      ),
    );

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    // 3 customers x 6 units = 18 requested against 10 available: at most one can succeed.
    expect(fulfilled.length).toBeLessThanOrEqual(1);
    expect(fulfilled.length + rejected.length).toBe(customers.length);

    for (const outcome of rejected) {
      expect((outcome as PromiseRejectedResult).reason).toMatchObject({
        errorCode: 'ORDER_INSUFFICIENT_STOCK',
      });
    }

    // Stock invariant: remaining stock is never negative and matches what was actually reserved.
    const remaining = inventory.availableFor(sku.skuCode);
    expect(remaining).toBeGreaterThanOrEqual(0);
    const reservedByWinners = fulfilled.length * 6;
    expect(remaining).toBe(10 - reservedByWinners);

    const list = await repository.list({
      page: 1,
      pageSize: 10,
      sort: 'createdAt_desc',
    });
    expect(list.total).toBe(fulfilled.length);
  });

  it('allows all concurrent orders to succeed when combined demand fits within available stock', async () => {
    const repository = new InMemoryOrderRepository();
    const catalog = new InMemoryCatalogClient();
    const cart = new InMemoryCartClient();
    const inventory = new InMemoryInventoryClient();
    const service = new OrderService(
      repository,
      catalog,
      cart,
      inventory,
      new InMemoryEventPublisher(),
    );

    const sku: CatalogSkuInfo = {
      skuId: createId(),
      skuCode: 'CONC-ORDER-SKU-2',
      productId: createId(),
      productName: 'Tai nghe phổ thông',
      productStatus: 'active',
      skuName: 'Tai nghe phổ thông',
      attributes: {},
      unitPrice: 1_000_000,
      currency: 'VND',
      isSellable: true,
    };
    catalog.seed(sku);
    inventory.seed(sku.skuCode, 100);

    const customers = ['conc-x1', 'conc-x2', 'conc-x3', 'conc-x4', 'conc-x5'];
    for (const customerId of customers) {
      cart.seedCart(customerId, [cartItemFromSku(sku, 2)]);
    }

    const results = await Promise.all(
      customers.map((customerId) =>
        service.createOrder(actorFor(customerId), createRequestFor(customerId)),
      ),
    );

    expect(results).toHaveLength(customers.length);
    expect(new Set(results.map((r) => r.id)).size).toBe(customers.length);
    expect(inventory.availableFor(sku.skuCode)).toBe(
      100 - customers.length * 2,
    );
  });
});
