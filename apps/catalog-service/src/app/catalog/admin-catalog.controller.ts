import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  CreateBrandRequest,
  CreateCategoryRequest,
  CreateProductRequest,
  CreateSkuRequest,
  CreateSpecTemplateRequest,
  UpdateSpecTemplateRequest,
  ProductStatus,
  UpdatePriceRequest,
  UpdateSkuRequest,
} from '@nexatech/shared-contracts';
import { CatalogService, parseRolesHeader } from './catalog.service';

@ApiTags('admin-catalog')
@ApiBearerAuth('bearer')
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

  @Get('spec-templates/:id')
  getSpecTemplate(
    @Headers('x-user-roles') rolesHeader: string,
    @Param('id') id: string,
  ) {
    return this.catalogService.getSpecTemplateById(
      id,
      parseRolesHeader(rolesHeader),
    );
  }

  @Patch('spec-templates/:id')
  updateSpecTemplate(
    @Headers('x-user-roles') rolesHeader: string,
    @Param('id') id: string,
    @Body() body: UpdateSpecTemplateRequest,
  ) {
    return this.catalogService.updateSpecTemplate(
      id,
      body,
      parseRolesHeader(rolesHeader),
    );
  }

  @Delete('spec-templates/:id')
  deleteSpecTemplate(
    @Headers('x-user-roles') rolesHeader: string,
    @Param('id') id: string,
  ) {
    return this.catalogService.deleteSpecTemplate(
      id,
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

  @Patch('skus/:skuId')
  updateSku(
    @Headers('x-user-roles') rolesHeader: string,
    @Param('skuId') skuId: string,
    @Body() body: UpdateSkuRequest,
  ) {
    return this.catalogService.updateSku(
      skuId,
      body,
      parseRolesHeader(rolesHeader),
    );
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

  @Get('products/:productId/media-links')
  listMediaLinks(
    @Headers('x-user-roles') rolesHeader: string,
    @Param('productId') productId: string,
  ) {
    return this.catalogService.listProductMediaLinks(
      productId,
      parseRolesHeader(rolesHeader),
    );
  }

  @Patch('products/:productId/media-links/:linkId')
  updateMediaLink(
    @Headers('x-user-roles') rolesHeader: string,
    @Param('productId') productId: string,
    @Param('linkId') linkId: string,
    @Body()
    body: {
      role?: 'thumbnail' | 'gallery' | 'video';
      sortOrder?: number;
      isPrimary?: boolean;
    },
  ) {
    return this.catalogService.updateProductMediaLink(
      productId,
      linkId,
      body,
      parseRolesHeader(rolesHeader),
    );
  }

  @Delete('products/:productId/media-links/:linkId')
  unlinkMedia(
    @Headers('x-user-roles') rolesHeader: string,
    @Param('productId') productId: string,
    @Param('linkId') linkId: string,
  ) {
    return this.catalogService.unlinkProductMedia(
      productId,
      linkId,
      parseRolesHeader(rolesHeader),
    );
  }
}
