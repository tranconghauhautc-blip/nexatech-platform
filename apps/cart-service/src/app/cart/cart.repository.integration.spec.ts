import { createId } from '@nexatech/shared-platform';
import { PrismaCartRepository } from './prisma-cart.repository';
import { PrismaService } from './prisma.service';

const describeIfDb = process.env['CART_DATABASE_URL']
  ? describe
  : describe.skip;

describeIfDb('cart repository integration', () => {
  let prisma: PrismaService;
  let repository: PrismaCartRepository;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaCartRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.wishlistItem.deleteMany();
    await prisma.comparisonItem.deleteMany();
    await prisma.recentlyViewedItem.deleteMany();
    await prisma.idempotencyRecord.deleteMany();
    await prisma.auditLog.deleteMany();
  });

  it('persists guest and customer carts with optimistic item updates', async () => {
    const guest = await repository.createGuestCart({
      guestTokenHash: `hash-${createId()}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    expect(guest.ownerType).toBe('GUEST');

    const updated = await repository.upsertItem({
      cartId: guest.id,
      expectedVersion: guest.version,
      skuId: createId(),
      skuCode: 'INT-SKU',
      quantity: 2,
      unitPriceSnapshot: 1000,
      currency: 'VND',
      productId: createId(),
      productName: 'Prod',
      productSlug: 'prod',
      skuName: 'Prod SKU',
      attributes: {},
      mode: 'add',
    });
    expect(updated.items).toHaveLength(1);
    expect(updated.version).toBe(guest.version + 1);

    const customer = await repository.createCustomerCart({
      customerId: `cust-${createId()}`,
    });
    expect(customer.ownerType).toBe('CUSTOMER');
  });

  it('stores wishlist comparison and recently viewed', async () => {
    const customerId = `cust-${createId()}`;
    const productId = createId();
    await repository.addWishlist({ customerId, productId });
    expect(await repository.listWishlist(customerId)).toHaveLength(1);

    await repository.addComparison(customerId, productId);
    expect(await repository.listComparison(customerId)).toHaveLength(1);

    const viewed = await repository.trackRecentlyViewed({
      customerId,
      productId,
      maxItems: 20,
    });
    expect(viewed[0]?.productId).toBe(productId);
  });
});
