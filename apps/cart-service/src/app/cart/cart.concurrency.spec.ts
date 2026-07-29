import { createId } from '@nexatech/shared-platform';
import { InMemoryCatalogClient } from './catalog.client';
import { InMemoryCartRepository } from './cart.repository';
import { CartService } from './cart.service';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryInventoryClient } from './inventory.client';
import { InMemoryCartRedisStore } from './redis.store';

describe('CartService concurrency', () => {
  it('handles concurrent adds of the same SKU without lost updates', async () => {
    const repository = new InMemoryCartRepository();
    const catalog = new InMemoryCatalogClient();
    const inventory = new InMemoryInventoryClient();
    const redis = new InMemoryCartRedisStore();
    const service = new CartService(
      repository,
      catalog,
      inventory,
      redis,
      new InMemoryEventPublisher(),
    );

    const skuId = createId();
    catalog.seed({
      skuId,
      skuCode: 'CONC-SKU',
      productId: createId(),
      productName: 'Tablet',
      productSlug: 'tablet',
      productStatus: 'active',
      skuName: 'Tablet',
      attributes: {},
      unitPrice: 8_000_000,
      currency: 'VND',
      isSellable: true,
    });
    inventory.seed('CONC-SKU', 100);

    const actor = { userId: 'conc-user', customerId: 'conc-user' };
    await service.getCurrentCart(actor);

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        service.addItem(actor, { skuCode: 'CONC-SKU', quantity: 1 }),
      ),
    );

    const finalCart = await service.getCurrentCart(actor);
    expect(finalCart.items[0]?.quantity).toBe(10);
    expect(results.every((r) => r.items[0]?.skuId === skuId)).toBe(true);
  });
});
