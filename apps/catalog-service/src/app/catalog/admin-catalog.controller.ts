import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  CreateBrandRequest,
  CreateCategoryRequest,
  CreateProductRequest,
  CreateSkuRequest,
  CreateSpecTemplateRequest,
  ProductStatus,
  UpdatePriceRequest,
} from '@nexatech/shared-contracts';
import { CatalogService, parseRolesHeader } from './catalog.service';

@ApiTags('admin-catalog')
@Controller({ path: 'admin/catalog', version: ['1', '2'] })
export class AdminCatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post('categories')
  createCategory(
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: CreateCategoryRequest,
  ) {
    return this.catalogService.createCategory(
      body,
      parseRolesHeader(rolesHeader),
    );
  }

  @Patch('categories/:id')
  updateCategory(
    @Headers('x-user-roles') rolesHeader: string,
    @Param('id') id: string,
    @Body() body: Partial<CreateCategoryRequest>,
  ) {
    return this.catalogService.updateCategory(
      id,
      body,
      parseRolesHeader(rolesHeader),
    );
  }

  @Post('brands')
  createBrand(
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: CreateBrandRequest,
  ) {
    return this.catalogService.createBrand(body, parseRolesHeader(rolesHeader));
  }

  @Patch('brands/:id')
  updateBrand(
    @Headers('x-user-roles') rolesHeader: string,
    @Param('id') id: string,
    @Body() body: Partial<CreateBrandRequest>,
  ) {
    return this.catalogService.updateBrand(
      id,
      body,
      parseRolesHeader(rolesHeader),
    );
  }

  @Post('spec-templates')
  createSpecTemplate(
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: CreateSpecTemplateRequest,
  ) {
    return this.catalogService.createSpecTemplate(
      body,
      parseRolesHeader(rolesHeader),
    );
  }

  @Get('spec-templates')
  listSpecTemplates(
    @Headers('x-user-roles') rolesHeader: string,
    @Query('categoryId') categoryId: string,
  ) {
    return this.catalogService.getSpecTemplatesByCategory(
      categoryId,
      parseRolesHeader(rolesHeader),
    );
  }

  @Post('products')
  createProduct(
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: CreateProductRequest,
  ) {
    return this.catalogService.createProduct(
      body,
      parseRolesHeader(rolesHeader),
    );
  }

  @Patch('products/:id')
  updateProduct(
    @Headers('x-user-roles') rolesHeader: string,
    @Param('id') id: string,
    @Body() body: Partial<CreateProductRequest>,
  ) {
    return this.catalogService.updateProduct(
      id,
      body,
      parseRolesHeader(rolesHeader),
    );
  }

  @Patch('products/:id/status')
  updateProductStatus(
    @Headers('x-user-roles') rolesHeader: string,
    @Param('id') id: string,
    @Body() body: { status: ProductStatus },
  ) {
    return this.catalogService.updateProductStatus(
      id,
      body.status,
      parseRolesHeader(rolesHeader),
    );
  }

  @Post('skus')
  createSku(
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: CreateSkuRequest,
  ) {
    return this.catalogService.createSku(body, parseRolesHeader(rolesHeader));
  }

  @Post('skus/:skuId/prices')
  updatePrice(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Param('skuId') skuId: string,
    @Body() body: UpdatePriceRequest,
  ) {
    return this.catalogService.updateSkuPrice(
      skuId,
      body,
      parseRolesHeader(rolesHeader),
      userId,
    );
  }

  @Post('products/:productId/media-links')
  linkMedia(
    @Headers('x-user-roles') rolesHeader: string,
    @Param('productId') productId: string,
    @Body()
    body: {
      mediaId: string;
      skuId?: string;
      role: 'thumbnail' | 'gallery' | 'video';
      sortOrder?: number;
      isPrimary?: boolean;
    },
  ) {
    return this.catalogService.linkMedia(
      productId,
      body,
      parseRolesHeader(rolesHeader),
    );
  }
}
