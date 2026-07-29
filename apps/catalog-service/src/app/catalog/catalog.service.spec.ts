import { Roles } from '@nexatech/shared-auth';
import { ErrorCodes } from '@nexatech/shared-errors';
import { EventTypes } from '@nexatech/shared-events';
import { auditEvents, CatalogService } from './catalog.service';
import { InMemoryCatalogRepository } from './catalog.repository';

describe('CatalogService', () => {
  const staffRoles = [Roles.Staff];
  let service: CatalogService;
  let repository: InMemoryCatalogRepository;

  beforeEach(() => {
    auditEvents.length = 0;
    repository = new InMemoryCatalogRepository();
    service = new CatalogService(repository);
  });

  it('creates category tree, brand, product, sku and price history', async () => {
    const parent = await service.createCategory(
      { name: 'Điện thoại', slug: 'dien-thoai', sortOrder: 1 },
      staffRoles,
    );
    const child = await service.createCategory(
      {
        name: 'iPhone',
        slug: 'iphone',
        parentId: parent.id,
        sortOrder: 1,
      },
      staffRoles,
    );
    const tree = await service.listCategoriesTree();
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children[0]?.slug).toBe(child.slug);

    const brand = await service.createBrand(
      { name: 'Apple', slug: 'apple' },
      staffRoles,
    );

    const product = await service.createProduct(
      {
        name: 'iPhone 16',
        slug: 'iphone-16',
        categoryId: parent.id,
        brandId: brand.id,
        status: 'active',
      },
      staffRoles,
    );

    const sku = await service.createSku(
      {
        productId: product.id,
        skuCode: 'IP16-128-BK',
        name: '128GB Đen',
        price: 24990000,
      },
      staffRoles,
    );

    const updated = await service.updateSkuPrice(
      sku.id,
      { amount: 23990000, reason: 'Khuyến mãi' },
      staffRoles,
      'staff-1',
    );
    expect(updated.price?.amount).toBe(23990000);
    expect(
      auditEvents.some((e) => e.eventType === EventTypes.CATALOG_PRICE_CHANGED),
    ).toBe(true);
  });

  it('searches and filters products', async () => {
    const category = await service.createCategory(
      { name: 'Laptop', slug: 'laptop' },
      staffRoles,
    );
    const brand = await service.createBrand(
      { name: 'Dell', slug: 'dell' },
      staffRoles,
    );
    const product = await service.createProduct(
      {
        name: 'Dell XPS 13',
        slug: 'dell-xps-13',
        categoryId: category.id,
        brandId: brand.id,
        status: 'active',
      },
      staffRoles,
    );
    await service.createSku(
      {
        productId: product.id,
        skuCode: 'XPS13-I7',
        name: 'i7 16GB',
        price: 32000000,
      },
      staffRoles,
    );

    const result = await service.searchProducts({
      q: 'xps',
      categorySlug: 'laptop',
      brandSlug: 'dell',
      page: '1',
      pageSize: '20',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.minPrice).toBe(32000000);
  });

  it('rejects duplicate product slug', async () => {
    const category = await service.createCategory(
      { name: 'Tablet', slug: 'tablet' },
      staffRoles,
    );
    const brand = await service.createBrand(
      { name: 'Samsung', slug: 'samsung' },
      staffRoles,
    );
    await service.createProduct(
      {
        name: 'Galaxy Tab',
        slug: 'galaxy-tab',
        categoryId: category.id,
        brandId: brand.id,
      },
      staffRoles,
    );
    await expect(
      service.createProduct(
        {
          name: 'Galaxy Tab 2',
          slug: 'galaxy-tab',
          categoryId: category.id,
          brandId: brand.id,
        },
        staffRoles,
      ),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.CATALOG_SLUG_CONFLICT,
    });
  });

  it('returns rule-based recommendations', async () => {
    const category = await service.createCategory(
      { name: 'Phụ kiện', slug: 'phu-kien' },
      staffRoles,
    );
    const brand = await service.createBrand(
      { name: 'Anker', slug: 'anker' },
      staffRoles,
    );
    const main = await service.createProduct(
      {
        name: 'Sạc Anker 65W',
        slug: 'anker-65w',
        categoryId: category.id,
        brandId: brand.id,
        status: 'active',
      },
      staffRoles,
    );
    await service.createProduct(
      {
        name: 'Cáp USB-C Anker',
        slug: 'anker-usbc',
        categoryId: category.id,
        brandId: brand.id,
        status: 'active',
      },
      staffRoles,
    );

    const recommendations = await service.recommendations(main.id);
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.slug).toBe('anker-usbc');
  });

  it('forbids admin actions without staff role', async () => {
    await expect(
      service.createCategory({ name: 'Test', slug: 'test' }, [Roles.Customer]),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.FORBIDDEN,
    });
  });
});
