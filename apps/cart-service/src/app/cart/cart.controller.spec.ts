import { createId } from '@nexatech/shared-platform';
import { Test, TestingModule } from '@nestjs/testing';
import { InMemoryCatalogClient } from './catalog.client';
import {
  CartController,
  ComparisonController,
  RecentlyViewedController,
  WishlistController,
} from './cart.controller';
import { InMemoryCartRepository } from './cart.repository';
import { CartService } from './cart.service';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryInventoryClient } from './inventory.client';
import { InMemoryCartRedisStore } from './redis.store';

describe('Cart controllers (API)', () => {
  let cartController: CartController;
  let wishlistController: WishlistController;
  let comparisonController: ComparisonController;
  let recentlyViewedController: RecentlyViewedController;
  let catalog: InMemoryCatalogClient;
  let inventory: InMemoryInventoryClient;

  beforeEach(async () => {
    catalog = new InMemoryCatalogClient();
    inventory = new InMemoryInventoryClient();
    const service = new CartService(
      new InMemoryCartRepository(),
      catalog,
      inventory,
      new InMemoryCartRedisStore(),
      new InMemoryEventPublisher(),
    );
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        CartController,
        WishlistController,
        ComparisonController,
        RecentlyViewedController,
      ],
      providers: [{ provide: CartService, useValue: service }],
    }).compile();

    cartController = module.get(CartController);
    wishlistController = module.get(WishlistController);
    comparisonController = module.get(ComparisonController);
    recentlyViewedController = module.get(RecentlyViewedController);
  });

  it('runs guest cart API flow', async () => {
    const skuId = createId();
    const productId = createId();
    catalog.seed({
      skuId,
      skuCode: 'API-SKU-1',
      productId,
      productName: 'Laptop',
      productSlug: 'laptop',
      productStatus: 'active',
      skuName: 'Laptop 16GB',
      attributes: {},
      unitPrice: 20_000_000,
      currency: 'VND',
      isSellable: true,
    });
    inventory.seed('API-SKU-1', 10);

    const guest = await cartController.createGuest();
    expect(guest.guestCartToken).toBeDefined();

    const added = await cartController.addItem(
      undefined,
      guest.guestCartToken,
      { skuCode: 'API-SKU-1', quantity: 1 },
    );
    expect(added.items).toHaveLength(1);

    const current = await cartController.current(
      undefined,
      guest.guestCartToken,
    );
    expect(current.id).toBe(guest.id);

    const validated = await cartController.validate(
      undefined,
      guest.guestCartToken,
    );
    expect(validated.reservationPreview).toHaveLength(1);

    await cartController.clear(undefined, guest.guestCartToken);
    const empty = await cartController.current(undefined, guest.guestCartToken);
    expect(empty.items).toHaveLength(0);
  });

  it('runs authenticated cart merge API flow', async () => {
    const skuId = createId();
    catalog.seed({
      skuId,
      skuCode: 'API-SKU-2',
      productId: createId(),
      productName: 'Phone',
      productSlug: 'phone',
      productStatus: 'active',
      skuName: 'Phone',
      attributes: {},
      unitPrice: 5_000_000,
      currency: 'VND',
      isSellable: true,
    });
    inventory.seed('API-SKU-2', 20);

    const guest = await cartController.createGuest();
    await cartController.addItem(undefined, guest.guestCartToken, {
      skuCode: 'API-SKU-2',
      quantity: 2,
    });

    await cartController.addItem('user-api', undefined, {
      skuCode: 'API-SKU-2',
      quantity: 1,
    });

    const merged = await cartController.merge('user-api', {
      guestCartToken: guest.guestCartToken,
      idempotencyKey: 'api-merge-1',
    });
    expect(merged.items[0]?.quantity).toBe(3);
  });

  it('supports wishlist comparison and recently viewed endpoints', async () => {
    const productId = createId();
    await wishlistController.add('user-w', { productId });
    expect(await wishlistController.list('user-w')).toHaveLength(1);

    await comparisonController.add('user-w', { productId });
    expect(await comparisonController.list('user-w')).toHaveLength(1);

    await recentlyViewedController.track('user-w', undefined, { productId });
    const viewed = await recentlyViewedController.list('user-w');
    expect(viewed[0]?.productId).toBe(productId);
  });
});
