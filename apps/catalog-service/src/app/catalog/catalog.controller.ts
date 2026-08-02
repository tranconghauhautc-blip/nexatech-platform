import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller({ path: '', version: ['1', '2'] })
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalogService.listCategoriesTree();
  }

  @Get('brands')
  brands() {
    return this.catalogService.listBrands();
  }

  @Get('products/facets')
  productFacets(@Query() query: Record<string, unknown>) {
    return this.catalogService.getProductFacets(query);
  }

  /** Batch product summaries for wishlist/compare hydration. */
  @Get('products/summaries')
  productSummaries(@Query('ids') ids?: string) {
    return this.catalogService.getProductSummariesByIds(ids);
  }

  @Get('products')
  products(@Query() query: Record<string, unknown>) {
    return this.catalogService.searchProducts(query);
  }

  @Get('products/:slug')
  productBySlug(@Param('slug') slug: string) {
    return this.catalogService.getProductBySlug(slug);
  }

  @Get('skus/:skuCode')
  sku(@Param('skuCode') skuCode: string) {
    return this.catalogService.getSku(skuCode);
  }

  @Get('products/:id/recommendations')
  recommendations(@Param('id') id: string) {
    return this.catalogService.recommendations(id);
  }
}
