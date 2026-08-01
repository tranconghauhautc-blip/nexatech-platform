import {
  hasMinimumRole,
  isRole,
  Roles,
  type Role,
} from '@nexatech/shared-auth';
import {
  createPaginatedResponse,
  productSearchQuerySchema,
  type CreateBrandRequest,
  type CreateCategoryRequest,
  type CreateProductRequest,
  type CreateSkuRequest,
  type CreateSpecTemplateRequest,
  type LinkMediaRequest,
  type ProductSearchQuery,
  type UpdatePriceRequest,
} from '@nexatech/shared-contracts';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  createEventEnvelope,
  EventTypes,
  type EventEnvelope,
} from '@nexatech/shared-events';
import { createTraceId } from '@nexatech/shared-platform';
import { Injectable } from '@nestjs/common';
import { type CatalogRepository } from './catalog.repository';
import type {
  Brand,
  Category,
  CategoryTreeNode,
  Product,
  ProductDetail,
  ProductMediaLink,
  SkuWithPrice,
  SpecTemplate,
} from './catalog.types';

export const auditEvents: EventEnvelope[] = [];

@Injectable()
export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  private requireStaff(roles: Role[]): void {
    if (!hasMinimumRole(roles, Roles.Staff)) {
      throw new AppError({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Bạn không có quyền thực hiện thao tác này',
      });
    }
  }

  private recordAudit(event: EventEnvelope): void {
    auditEvents.push(event);
  }

  listCategoriesTree(): Promise<CategoryTreeNode[]> {
    return this.repository.listTree();
  }

  async createCategory(
    input: CreateCategoryRequest,
    roles: Role[],
  ): Promise<Category> {
    this.requireStaff(roles);
    const category = await this.repository.createCategory(input);
    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.CATALOG_CATEGORY_UPDATED,
        producer: 'catalog-service',
        traceId: createTraceId(),
        payload: { categoryId: category.id, action: 'created' },
      }),
    );
    return category;
  }

  async updateCategory(
    id: string,
    input: Partial<CreateCategoryRequest>,
    roles: Role[],
  ) {
    this.requireStaff(roles);
    const category = await this.repository.updateCategory(id, input);
    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.CATALOG_CATEGORY_UPDATED,
        producer: 'catalog-service',
        traceId: createTraceId(),
        payload: { categoryId: category.id, action: 'updated' },
      }),
    );
    return category;
  }

  listBrands(): Promise<Brand[]> {
    return this.repository.listBrands();
  }

  async getProductFacets(rawQuery: Record<string, unknown>) {
    const query = productSearchQuerySchema.parse({
      ...rawQuery,
      page: rawQuery['page'] ?? 1,
      pageSize: rawQuery['pageSize'] ?? 20,
    }) as ProductSearchQuery;
    return this.repository.getSearchFacets({
      q: query.q,
      categorySlug: query.categorySlug,
      brandSlug: query.brandSlug,
      status: query.status ?? 'active',
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      attributeKey: query.attributeKey,
      attributeValue: query.attributeValue,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async createBrand(input: CreateBrandRequest, roles: Role[]): Promise<Brand> {
    this.requireStaff(roles);
    const brand = await this.repository.createBrand(input);
    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.CATALOG_BRAND_UPDATED,
        producer: 'catalog-service',
        traceId: createTraceId(),
        payload: { brandId: brand.id, action: 'created' },
      }),
    );
    return brand;
  }

  async updateBrand(
    id: string,
    input: Partial<CreateBrandRequest>,
    roles: Role[],
  ) {
    this.requireStaff(roles);
    const brand = await this.repository.updateBrand(id, input);
    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.CATALOG_BRAND_UPDATED,
        producer: 'catalog-service',
        traceId: createTraceId(),
        payload: { brandId: brand.id, action: 'updated' },
      }),
    );
    return brand;
  }

  async createSpecTemplate(
    input: CreateSpecTemplateRequest,
    roles: Role[],
  ): Promise<SpecTemplate> {
    this.requireStaff(roles);
    return this.repository.createSpecTemplate(input);
  }

  async getSpecTemplatesByCategory(categoryId: string, roles: Role[]) {
    this.requireStaff(roles);
    return this.repository.getSpecTemplatesByCategory(categoryId);
  }

  async createProduct(
    input: CreateProductRequest,
    roles: Role[],
  ): Promise<Product> {
    this.requireStaff(roles);
    const category = await this.repository.getCategoryById(input.categoryId);
    if (!category) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_CATEGORY_NOT_FOUND,
        message: 'Không tìm thấy danh mục',
      });
    }
    const brand = await this.repository.getBrandById(input.brandId);
    if (!brand) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_BRAND_NOT_FOUND,
        message: 'Không tìm thấy thương hiệu',
      });
    }
    const product = await this.repository.createProduct(input);
    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.CATALOG_PRODUCT_UPDATED,
        producer: 'catalog-service',
        traceId: createTraceId(),
        payload: { productId: product.id, action: 'created' },
      }),
    );
    return product;
  }

  async updateProduct(
    id: string,
    input: Partial<CreateProductRequest>,
    roles: Role[],
  ): Promise<Product> {
    this.requireStaff(roles);
    const product = await this.repository.updateProduct(id, input);
    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.CATALOG_PRODUCT_UPDATED,
        producer: 'catalog-service',
        traceId: createTraceId(),
        payload: { productId: product.id, action: 'updated' },
      }),
    );
    return product;
  }

  async updateProductStatus(
    id: string,
    status: Product['status'],
    roles: Role[],
  ) {
    this.requireStaff(roles);
    const product = await this.repository.updateProduct(id, { status });
    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.CATALOG_PRODUCT_UPDATED,
        producer: 'catalog-service',
        traceId: createTraceId(),
        payload: { productId: product.id, action: 'status_changed', status },
      }),
    );
    return product;
  }

  async getProductBySlug(slug: string): Promise<ProductDetail> {
    const product = await this.repository.getProductBySlug(slug);
    if (!product) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_PRODUCT_NOT_FOUND,
        message: 'Không tìm thấy sản phẩm',
      });
    }
    return product;
  }

  async searchProducts(rawQuery: Record<string, unknown>) {
    const query = productSearchQuerySchema.parse(
      rawQuery,
    ) as ProductSearchQuery;
    const result = await this.repository.searchProducts({
      q: query.q,
      categorySlug: query.categorySlug,
      brandSlug: query.brandSlug,
      status: query.status,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      attributeKey: query.attributeKey,
      attributeValue: query.attributeValue,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    });
    return createPaginatedResponse(result.items, result.total, query);
  }

  async createSku(
    input: CreateSkuRequest,
    roles: Role[],
  ): Promise<SkuWithPrice> {
    this.requireStaff(roles);
    const product = await this.repository.getProductById(input.productId);
    if (!product) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_PRODUCT_NOT_FOUND,
        message: 'Không tìm thấy sản phẩm',
      });
    }
    return this.repository.createSku(input);
  }

  async getSku(skuCode: string): Promise<SkuWithPrice> {
    const sku = await this.repository.getSkuByCode(skuCode);
    if (!sku) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_SKU_NOT_FOUND,
        message: 'Không tìm thấy SKU',
      });
    }
    return sku;
  }

  async updateSkuPrice(
    skuId: string,
    input: UpdatePriceRequest,
    roles: Role[],
    changedBy?: string,
  ): Promise<SkuWithPrice> {
    this.requireStaff(roles);
    const sku = await this.repository.updatePrice(skuId, {
      ...input,
      changedBy,
    });
    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.CATALOG_PRICE_CHANGED,
        producer: 'catalog-service',
        traceId: createTraceId(),
        payload: {
          skuId,
          amount: input.amount,
          currency: input.currency ?? 'VND',
          reason: input.reason,
        },
      }),
    );
    return sku;
  }

  async linkMedia(
    productId: string,
    input: {
      mediaId: string;
      skuId?: string;
      role: LinkMediaRequest['role'];
      sortOrder?: number;
      isPrimary?: boolean;
    },
    roles: Role[],
  ): Promise<ProductMediaLink> {
    this.requireStaff(roles);
    return this.repository.linkProductMedia({
      productId,
      mediaId: input.mediaId,
      skuId: input.skuId,
      role: input.role,
      sortOrder: input.sortOrder,
      isPrimary: input.isPrimary,
    });
  }

  async recommendations(productId: string) {
    const product = await this.repository.getProductById(productId);
    if (!product) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_PRODUCT_NOT_FOUND,
        message: 'Không tìm thấy sản phẩm',
      });
    }
    const items = await this.repository.findRecommendations(productId, 8);
    return items.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      status: item.status,
    }));
  }
}

export function parseRolesHeader(value?: string): Role[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((role) => role.trim())
    .filter(isRole);
}
