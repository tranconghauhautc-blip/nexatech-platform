import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { InMemoryCatalogRepository } from './catalog.repository';
import { Roles } from '@nexatech/shared-auth';

describe('CatalogController', () => {
  let controller: CatalogController;
  let service: CatalogService;

  beforeEach(async () => {
    service = new CatalogService(new InMemoryCatalogRepository());
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: CatalogService, useValue: service }],
    }).compile();
    controller = module.get(CatalogController);
  });

  it('lists empty categories and brands', async () => {
    await expect(controller.categories()).resolves.toEqual([]);
    await expect(controller.brands()).resolves.toEqual([]);
  });

  it('searches products with pagination shape', async () => {
    const category = await service.createCategory(
      { name: 'Điện thoại', slug: 'dien-thoai' },
      [Roles.Staff],
    );
    const brand = await service.createBrand({ name: 'Apple', slug: 'apple' }, [
      Roles.Staff,
    ]);
    const product = await service.createProduct(
      {
        name: 'iPhone 16',
        slug: 'iphone-16',
        categoryId: category.id,
        brandId: brand.id,
        status: 'active',
      },
      [Roles.Staff],
    );
    await service.createSku(
      {
        productId: product.id,
        skuCode: 'IP16-128',
        name: '128GB',
        price: 24990000,
      },
      [Roles.Staff],
    );

    const result = await controller.products({ page: '1', pageSize: '10' });
    expect(result.items).toHaveLength(1);
    expect(result.meta.totalItems).toBe(1);

    const detail = await controller.productBySlug('iphone-16');
    expect(detail.slug).toBe('iphone-16');

    const sku = await controller.sku('IP16-128');
    expect(sku.skuCode).toBe('IP16-128');
  });
});
