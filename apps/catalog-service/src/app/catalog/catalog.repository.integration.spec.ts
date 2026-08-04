import {
  assertIntegrationTestDatabaseReady,
  createId,
  shouldRunIntegrationDatabaseSuite,
} from '@nexatech/shared-platform';
import { PrismaCatalogRepository } from './prisma-catalog.repository';
import { PrismaService } from './prisma.service';

/**
 * Destructive integration suite. Requires CATALOG_TEST_DATABASE_URL pointing at
 * nexatech_catalog_test only — never falls back to CATALOG_DATABASE_URL.
 */
const CATALOG_TEST_DB = {
  testUrlEnv: 'CATALOG_TEST_DATABASE_URL',
  requiredDatabaseName: 'nexatech_catalog_test',
  runtimeUrlEnv: 'CATALOG_DATABASE_URL',
} as const;

const describeIfDb = shouldRunIntegrationDatabaseSuite(
  CATALOG_TEST_DB.testUrlEnv,
)
  ? describe
  : describe.skip;

describeIfDb('PrismaCatalogRepository integration', () => {
  let prisma: PrismaService;
  let repository: PrismaCatalogRepository;
  const createdProductIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdBrandIds: string[] = [];
  const createdSkuCodes: string[] = [];

  beforeAll(async () => {
    assertIntegrationTestDatabaseReady(CATALOG_TEST_DB);
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaCatalogRepository(prisma);
  });

  afterAll(async () => {
    assertIntegrationTestDatabaseReady(CATALOG_TEST_DB);
    if (createdSkuCodes.length > 0) {
      await prisma.sku.deleteMany({
        where: { skuCode: { in: createdSkuCodes } },
      });
    }
    if (createdProductIds.length > 0) {
      await prisma.product.deleteMany({
        where: { id: { in: createdProductIds } },
      });
    }
    if (createdCategoryIds.length > 0) {
      await prisma.category.deleteMany({
        where: { id: { in: createdCategoryIds } },
      });
    }
    if (createdBrandIds.length > 0) {
      await prisma.brand.deleteMany({
        where: { id: { in: createdBrandIds } },
      });
    }
    await prisma.$disconnect();
  });

  it('creates catalog data and searches by query', async () => {
    const suffix = createId().slice(0, 8);
    const category = await repository.createCategory({
      slug: `it-cat-${suffix}`,
      name: 'Integration Category',
    });
    createdCategoryIds.push(category.id);

    const brand = await repository.createBrand({
      slug: `it-brand-${suffix}`,
      name: 'Integration Brand',
    });
    createdBrandIds.push(brand.id);

    const product = await repository.createProduct({
      slug: `it-product-${suffix}`,
      name: 'Integration Phone Pro',
      categoryId: category.id,
      brandId: brand.id,
      status: 'active',
    });
    createdProductIds.push(product.id);

    const sku = await repository.createSku({
      productId: product.id,
      skuCode: `IT-SKU-${suffix}`,
      name: 'Default',
      price: 1000000,
    });
    createdSkuCodes.push(sku.skuCode);

    const search = await repository.searchProducts({
      q: 'Integration Phone',
      page: 1,
      pageSize: 10,
    });
    expect(search.total).toBeGreaterThanOrEqual(1);
    expect(search.items.some((item) => item.slug === product.slug)).toBe(true);
  });
});
