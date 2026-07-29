import { createId } from '@nexatech/shared-platform';
import { ErrorCodes } from '@nexatech/shared-errors';
import { EventTypes } from '@nexatech/shared-events';
import { InMemoryCatalogClient } from './catalog.client';
import { InMemoryCartRepository } from './cart.repository';
import { CartService } from './cart.service';
import type { CatalogSkuInfo } from './cart.types';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryInventoryClient } from './inventory.client';
import { InMemoryCartRedisStore } from './redis.store';

function seedSku(
  catalog: InMemoryCatalogClient,
  overrides?: Partial<CatalogSkuInfo>,
): CatalogSkuInfo {
  const sku: CatalogSkuInfo = {
    skuId: overrides?.skuId ?? createId(),
    skuCode: overrides?.skuCode ?? 'SKU-PHONE-1',
    productId: overrides?.productId ?? createId(),
    productName: overrides?.productName ?? 'Điện thoại A',
    productSlug: overrides?.productSlug ?? 'dien-thoai-a',
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

describe('CartService', () => {
  let repository: InMemoryCartRepository;
  let catalog: InMemoryCatalogClient;
  let inventory: InMemoryInventoryClient;
  let redis: InMemoryCartRedisStore;
  let publisher: InMemoryEventPublisher;
  let service: CartService;

  beforeEach(() => {
    repository = new InMemoryCartRepository();
    catalog = new InMemoryCatalogClient();
    inventory = new InMemoryInventoryClient();
    redis = new InMemoryCartRedisStore();
    publisher = new InMemoryEventPublisher();
    service = new CartService(repository, catalog, inventory, redis, publisher);
  });

  it('creates guest cart with secure token and expiry', async () => {
    const cart = await service.createGuestCart();
    expect(cart.ownerType).toBe('GUEST');
    expect(cart.guestCartToken).toBeDefined();
    expect((cart.guestCartToken ?? '').length).toBeGreaterThanOrEqual(16);
    expect(cart.expiresAt).toBeDefined();
    expect(
      publisher.published.some((e) => e.eventType === EventTypes.CART_CREATED),
    ).toBe(true);
  });

  it('adds updates and removes items on guest cart', async () => {
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 20);
    const guest = await service.createGuestCart();
    const actor = { guestCartToken: guest.guestCartToken };

    const added = await service.addItem(actor, {
      skuCode: sku.skuCode,
      quantity: 2,
    });
    expect(added.items).toHaveLength(1);
    expect(added.totalQuantity).toBe(2);
    expect(added.subtotal).toBe(20_000_000);

    const updated = await service.updateItem(actor, sku.skuId, {
      quantity: 3,
    });
    expect(updated.items[0]?.quantity).toBe(3);

    const removed = await service.removeItem(actor, sku.skuId);
    expect(removed.items).toHaveLength(0);
  });

  it('rejects zero/negative quantity and over limit', async () => {
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 100);
    const guest = await service.createGuestCart();
    const actor = { guestCartToken: guest.guestCartToken };

    await expect(
      service.addItem(actor, { skuCode: sku.skuCode, quantity: 0 }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.VALIDATION_FAILED });

    await expect(
      service.addItem(actor, { skuCode: sku.skuCode, quantity: 100 }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.VALIDATION_FAILED });
  });

  it('rejects unavailable sku and insufficient inventory', async () => {
    const guest = await service.createGuestCart();
    const actor = { guestCartToken: guest.guestCartToken };

    await expect(
      service.addItem(actor, { skuCode: 'MISSING', quantity: 1 }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.CART_SKU_UNAVAILABLE });

    const inactive = seedSku(catalog, {
      skuCode: 'SKU-OFF',
      isSellable: false,
      productStatus: 'inactive',
    });
    await expect(
      service.addItem(actor, { skuCode: inactive.skuCode, quantity: 1 }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.CART_SKU_UNAVAILABLE });

    const low = seedSku(catalog, { skuCode: 'SKU-LOW' });
    inventory.seed(low.skuCode, 1);
    await expect(
      service.addItem(actor, { skuCode: low.skuCode, quantity: 5 }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.CART_SKU_UNAVAILABLE });
  });

  it('manages authenticated customer cart', async () => {
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 10);
    const actor = { userId: 'user-1', customerId: 'user-1' };
    const cart = await service.getCurrentCart(actor);
    expect(cart.ownerType).toBe('CUSTOMER');
    expect(cart.customerId).toBe('user-1');

    const added = await service.addItem(actor, {
      skuCode: sku.skuCode,
      quantity: 1,
    });
    expect(added.items).toHaveLength(1);

    const cleared = await service.clearCart(actor);
    expect(cleared.items).toHaveLength(0);
  });

  it('merges guest cart into customer cart idempotently and sums quantities', async () => {
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 50);

    const guest = await service.createGuestCart();
    await service.addItem(
      { guestCartToken: guest.guestCartToken },
      { skuCode: sku.skuCode, quantity: 2 },
    );

    const guestToken = guest.guestCartToken;
    expect(guestToken).toBeDefined();
    if (!guestToken) {
      throw new Error('missing guest token');
    }

    const customer = { userId: 'cust-1', customerId: 'cust-1' };
    await service.addItem(customer, { skuCode: sku.skuCode, quantity: 3 });

    const merged = await service.mergeCart(customer, {
      guestCartToken: guestToken,
      idempotencyKey: 'merge-key-1',
    });
    expect(merged.items[0]?.quantity).toBe(5);
    expect(
      publisher.published.some((e) => e.eventType === EventTypes.CART_MERGED),
    ).toBe(true);

    const again = await service.mergeCart(customer, {
      guestCartToken: guestToken,
      idempotencyKey: 'merge-key-1',
    });
    expect(again.items[0]?.quantity).toBe(5);

    await expect(
      service.getCurrentCart({ guestCartToken: guestToken }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.CART_NOT_FOUND });
  });

  it('enforces ownership between customers', async () => {
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 10);
    await service.addItem(
      { userId: 'owner', customerId: 'owner' },
      { skuCode: sku.skuCode, quantity: 1 },
    );

    // Other customer gets their own empty cart, not owner's
    const other = await service.getCurrentCart({
      userId: 'other',
      customerId: 'other',
    });
    expect(other.items).toHaveLength(0);
    expect(other.customerId).toBe('other');
  });

  it('is idempotent on add item with same key', async () => {
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 20);
    const actor = { userId: 'idem-user', customerId: 'idem-user' };
    const first = await service.addItem(actor, {
      skuCode: sku.skuCode,
      quantity: 1,
      idempotencyKey: 'add-key-1',
    });
    const second = await service.addItem(actor, {
      skuCode: sku.skuCode,
      quantity: 1,
      idempotencyKey: 'add-key-1',
    });
    expect(second).toEqual(first);
    expect(second.totalQuantity).toBe(1);
  });

  it('refreshes prices from catalog and detects price changes on validate', async () => {
    const sku = seedSku(catalog, { unitPrice: 1_000_000 });
    inventory.seed(sku.skuCode, 10);
    const actor = { userId: 'price-user', customerId: 'price-user' };
    await service.addItem(actor, { skuCode: sku.skuCode, quantity: 1 });

    catalog.seed({ ...sku, unitPrice: 1_200_000 });
    const validated = await service.validateCart(actor);
    expect(validated.valid).toBe(false);
    expect(validated.issues.some((i) => i.code === 'PRICE_CHANGED')).toBe(true);
    expect(validated.reservationPreview[0]?.skuCode).toBe(sku.skuCode);

    const refreshed = await service.refreshCart(actor);
    expect(refreshed.items[0]?.unitPriceSnapshot).toBe(1_200_000);
  });

  it('supports wishlist comparison and recently viewed', async () => {
    const productId = createId();
    await service.addWishlist('cust-w', productId);
    expect(await service.listWishlist('cust-w')).toHaveLength(1);

    const p1 = createId();
    const p2 = createId();
    const p3 = createId();
    const p4 = createId();
    const p5 = createId();
    await service.addComparison('cust-w', p1);
    await service.addComparison('cust-w', p2);
    await service.addComparison('cust-w', p3);
    await service.addComparison('cust-w', p4);
    await expect(service.addComparison('cust-w', p5)).rejects.toMatchObject({
      errorCode: ErrorCodes.COMPARISON_LIMIT,
    });

    await service.trackRecentlyViewed(
      { userId: 'cust-w', customerId: 'cust-w' },
      productId,
    );
    const viewed = await service.listRecentlyViewed({
      userId: 'cust-w',
      customerId: 'cust-w',
    });
    expect(viewed[0]?.productId).toBe(productId);
  });

  it('expires guest carts via cleanup', async () => {
    const guest = await service.createGuestCart();
    const cartId = guest.id;
    const stored = await repository.getCartById(cartId);
    expect(stored).toBeTruthy();
    if (!stored) {
      throw new Error('missing cart');
    }
    // Force expire by updating status through repository after mutating expiry
    await repository.updateStatus({
      cartId,
      expectedVersion: stored.version,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() - 1000),
    });
    const count = await service.cleanupExpiredCarts(new Date());
    expect(count).toBeGreaterThanOrEqual(1);
    expect(
      publisher.published.some((e) => e.eventType === EventTypes.CART_EXPIRED),
    ).toBe(true);
  });

  it('converts active customer cart and creates a fresh empty cart', async () => {
    const sku = seedSku(catalog);
    inventory.seed(sku.skuCode, 10);
    const customer = { userId: 'cust-cv', customerId: 'cust-cv' };
    await service.addItem(customer, {
      skuCode: sku.skuCode,
      quantity: 1,
    });
    const converted = await service.convertCart(customer, {
      orderId: 'order-1',
      idempotencyKey: 'convert-key-1',
    });
    expect(converted.items).toHaveLength(0);
    expect(converted.status).toBe('ACTIVE');
    expect(
      publisher.published.some(
        (e) => e.eventType === EventTypes.CART_CONVERTED,
      ),
    ).toBe(true);

    const again = await service.convertCart(customer, {
      orderId: 'order-1',
      idempotencyKey: 'convert-key-1',
    });
    expect(again.id).toBe(converted.id);
  });
});
