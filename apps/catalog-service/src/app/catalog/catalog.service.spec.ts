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

  it('computes minPrice as lowest SKU amount (never clamped by trailing 0)', async () => {
    const category = await service.createCategory(
      { name: 'Laptop', slug: 'laptop-min' },
      staffRoles,
    );
    const brand = await service.createBrand(
      { name: 'Dell', slug: 'dell-min' },
      staffRoles,
    );
    const product = await service.createProduct(
      {
        name: 'XPS Dual',
        slug: 'xps-dual-min',
        categoryId: category.id,
        brandId: brand.id,
        status: 'active',
      },
      staffRoles,
    );
    await service.createSku(
      {
        productId: product.id,
        skuCode: 'XPS-HI',
        name: 'High',
        price: 40_000_000,
      },
      staffRoles,
    );
    await service.createSku(
      {
        productId: product.id,
        skuCode: 'XPS-LO',
        name: 'Low',
        price: 28_000_000,
      },
      staffRoles,
    );

    const result = await service.searchProducts({
      q: 'XPS Dual',
      categorySlug: 'laptop-min',
      brandSlug: 'dell-min',
      page: '1',
      pageSize: '20',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.minPrice).toBe(28_000_000);
    expect(result.items[0]?.minPrice).toBeGreaterThan(0);
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

  it('updates spec template preserving attribute ids by key', async () => {
    const category = await service.createCategory(
      { name: 'Điện thoại', slug: 'dien-thoai-spec' },
      staffRoles,
    );
    const template = await service.createSpecTemplate(
      {
        categoryId: category.id,
        name: 'Thông số điện thoại',
        groups: [
          {
            name: 'Thông số chung',
            sortOrder: 0,
            attributes: [
              {
                key: 'ram_gb',
                label: 'RAM',
                dataType: 'number',
                unit: 'GB',
                isFilterable: true,
                sortOrder: 0,
              },
            ],
          },
        ],
      },
      staffRoles,
    );
    const originalAttributeId = template.groups[0]?.attributes[0]?.id;
    expect(originalAttributeId).toBeDefined();

    const updated = await service.updateSpecTemplate(
      template.id,
      {
        name: 'Thông số điện thoại (cập nhật)',
        groups: [
          {
            name: 'Thông số chung',
            sortOrder: 0,
            attributes: [
              {
                key: 'ram_gb',
                label: 'Dung lượng RAM',
                dataType: 'number',
                unit: 'GB',
                isFilterable: true,
                sortOrder: 0,
              },
              {
                key: 'storage_gb',
                label: 'Bộ nhớ',
                dataType: 'number',
                unit: 'GB',
                isFilterable: true,
                sortOrder: 1,
              },
            ],
          },
        ],
      },
      staffRoles,
    );

    expect(updated.name).toBe('Thông số điện thoại (cập nhật)');
    expect(updated.groups[0]?.attributes[0]?.id).toBe(originalAttributeId);
    expect(updated.groups[0]?.attributes[0]?.label).toBe('Dung lượng RAM');
    expect(updated.groups[0]?.attributes).toHaveLength(2);
  });

  it('blocks spec template delete when attributes are referenced', async () => {
    const category = await service.createCategory(
      { name: 'Tablet', slug: 'tablet-spec' },
      staffRoles,
    );
    const brand = await service.createBrand(
      { name: 'Samsung', slug: 'samsung-spec' },
      staffRoles,
    );
    const template = await service.createSpecTemplate(
      {
        categoryId: category.id,
        name: 'Thông số tablet',
        groups: [
          {
            name: 'Thông số chung',
            attributes: [
              {
                key: 'screen_inch',
                label: 'Màn hình',
                dataType: 'number',
                unit: 'inch',
              },
            ],
          },
        ],
      },
      staffRoles,
    );
    const attributeId = template.groups[0]?.attributes[0]?.id;
    expect(attributeId).toBeDefined();
    if (!attributeId) {
      throw new Error('attributeId missing');
    }

    await service.createProduct(
      {
        name: 'Galaxy Tab S9',
        slug: 'galaxy-tab-s9',
        categoryId: category.id,
        brandId: brand.id,
        specs: [{ attributeId, value: '11' }],
      },
      staffRoles,
    );

    await expect(
      service.deleteSpecTemplate(template.id, staffRoles),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.CONFLICT,
    });
  });

  it('updates sku name and attributes via updateSku', async () => {
    const category = await service.createCategory(
      { name: 'Tai nghe', slug: 'tai-nghe-sku-edit' },
      staffRoles,
    );
    const brand = await service.createBrand(
      { name: 'Sony', slug: 'sony-sku-edit' },
      staffRoles,
    );
    const product = await service.createProduct(
      {
        name: 'WF-1000XM5',
        slug: 'wf-1000xm5-sku-edit',
        categoryId: category.id,
        brandId: brand.id,
        status: 'active',
      },
      staffRoles,
    );
    const sku = await service.createSku(
      {
        productId: product.id,
        skuCode: 'WF5-BLK',
        name: 'Den',
        price: 5990000,
        attributes: { color: 'black' },
      },
      staffRoles,
    );

    const unchanged = await service.updateSku(sku.id, {}, staffRoles);
    expect(unchanged.name).toBe('Den');

    const updated = await service.updateSku(
      sku.id,
      { name: 'Den nham', attributes: { color: 'black', finish: 'matte' } },
      staffRoles,
    );
    expect(updated.name).toBe('Den nham');
    expect(updated.attributes).toEqual({ color: 'black', finish: 'matte' });
    expect(
      auditEvents.some(
        (e) =>
          e.eventType === EventTypes.CATALOG_PRODUCT_UPDATED &&
          (e.payload as { action?: string }).action === 'sku.updated',
      ),
    ).toBe(true);

    await expect(
      service.updateSku('missing-sku', { name: 'x' }, staffRoles),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.CATALOG_SKU_NOT_FOUND,
    });
  });
  it('updates product fields and specs via PATCH input', async () => {
    const category = await service.createCategory(
      { name: 'Phụ kiện', slug: 'phu-kien-edit' },
      staffRoles,
    );
    const brand = await service.createBrand(
      { name: 'Anker', slug: 'anker-edit' },
      staffRoles,
    );
    const template = await service.createSpecTemplate(
      {
        categoryId: category.id,
        name: 'Thông số phụ kiện',
        groups: [
          {
            name: 'Chung',
            attributes: [
              { key: 'watt', label: 'Công suất', dataType: 'number' },
            ],
          },
        ],
      },
      staffRoles,
    );
    const attributeId = template.groups[0]?.attributes[0]?.id;
    expect(attributeId).toBeDefined();
    if (!attributeId) throw new Error('attributeId missing');

    const product = await service.createProduct(
      {
        name: 'Sạc nhanh',
        slug: 'sac-nhanh',
        categoryId: category.id,
        brandId: brand.id,
        status: 'draft',
      },
      staffRoles,
    );

    const updated = await service.updateProduct(
      product.id,
      {
        name: 'Sạc nhanh 65W',
        description: 'GaN charger',
        specs: [{ attributeId, value: '65' }],
        status: 'active',
      },
      staffRoles,
    );
    expect(updated.name).toBe('Sạc nhanh 65W');
    expect(updated.status).toBe('active');

    const detail = await service.getProductBySlug('sac-nhanh');
    expect(detail.specValues).toHaveLength(1);
    expect(detail.specValues[0]?.value).toBe('65');
  });

  it('manages product media links with atomic primary and unlink', async () => {
    const category = await service.createCategory(
      { name: 'Đồng hồ', slug: 'dong-ho-media' },
      staffRoles,
    );
    const brand = await service.createBrand(
      { name: 'Garmin', slug: 'garmin-media' },
      staffRoles,
    );
    const product = await service.createProduct(
      {
        name: 'Fenix 8',
        slug: 'fenix-8',
        categoryId: category.id,
        brandId: brand.id,
        status: 'active',
      },
      staffRoles,
    );

    const linkA = await service.linkMedia(
      product.id,
      {
        mediaId: 'media-a',
        role: 'gallery',
        isPrimary: true,
      },
      staffRoles,
    );
    const linkB = await service.linkMedia(
      product.id,
      {
        mediaId: 'media-b',
        role: 'gallery',
        isPrimary: false,
      },
      staffRoles,
    );
    expect(linkA.isPrimary).toBe(true);

    const updated = await service.updateProductMediaLink(
      product.id,
      linkB.id,
      { isPrimary: true },
      staffRoles,
    );
    expect(updated.isPrimary).toBe(true);

    const links = await service.listProductMediaLinks(product.id, staffRoles);
    expect(links.find((l) => l.id === linkA.id)?.isPrimary).toBe(false);
    expect(links.find((l) => l.id === linkB.id)?.isPrimary).toBe(true);

    await service.unlinkProductMedia(product.id, linkA.id, staffRoles);
    const afterUnlink = await service.listProductMediaLinks(
      product.id,
      staffRoles,
    );
    expect(afterUnlink).toHaveLength(1);
    expect(afterUnlink[0]?.mediaId).toBe('media-b');
  });
});
