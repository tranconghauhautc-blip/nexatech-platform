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
  type UpdateSpecTemplateRequest,
  type LinkMediaRequest,
  type ProductSearchQuery,
  type UpdatePriceRequest,
  type UpdateSkuRequest,
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

  async getSpecTemplateById(id: string, roles: Role[]): Promise<SpecTemplate> {
    this.requireStaff(roles);
    const template = await this.repository.getSpecTemplateById(id);
    if (!template) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy mẫu thông số',
      });
    }
    return template;
  }

  async getSpecTemplatesByCategory(categoryId: string, roles: Role[]) {
    this.requireStaff(roles);
    return this.repository.getSpecTemplatesByCategory(categoryId);
  }

  async updateSpecTemplate(
    id: string,
    input: UpdateSpecTemplateRequest,
    roles: Role[],
  ): Promise<SpecTemplate> {
    this.requireStaff(roles);
    const template = await this.repository.updateSpecTemplate(id, input);
    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.CATALOG_CATEGORY_UPDATED,
        producer: 'catalog-service',
        traceId: createTraceId(),
        payload: { specTemplateId: template.id, action: 'updated' },
      }),
    );
    return template;
  }

  async deleteSpecTemplate(id: string, roles: Role[]): Promise<void> {
    this.requireStaff(roles);
    await this.repository.deleteSpecTemplate(id);
    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.CATALOG_CATEGORY_UPDATED,
        producer: 'catalog-service',
        traceId: createTraceId(),
        payload: { specTemplateId: id, action: 'deleted' },
      }),
    );
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

  async updateSku(
    skuId: string,
    input: UpdateSkuRequest,
    roles: Role[],
  ): Promise<SkuWithPrice> {
    this.requireStaff(roles);
    const existing = await this.repository.getSkuById(skuId);
    if (!existing) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_SKU_NOT_FOUND,
        message: 'Không tìm thấy SKU',
      });
    }
    if (input.name === undefined && input.attributes === undefined) {
      return existing;
    }
    const updated = await this.repository.updateSku(skuId, {
      name: input.name,
      attributes: input.attributes,
    });
    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.CATALOG_PRODUCT_UPDATED,
        producer: 'catalog-service',
        traceId: createTraceId(),
        payload: {
          skuId,
          productId: updated.productId,
          name: updated.name,
          action: 'sku.updated',
        },
      }),
    );
    return updated;
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

  async listProductMediaLinks(productId: string, roles: Role[]) {
    this.requireStaff(roles);
    const product = await this.repository.getProductById(productId);
    if (!product) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_PRODUCT_NOT_FOUND,
        message: 'Không tìm thấy sản phẩm',
      });
    }
    return this.repository.listProductMediaLinks(productId);
  }

  async updateProductMediaLink(
    productId: string,
    linkId: string,
    input: {
      role?: LinkMediaRequest['role'];
      sortOrder?: number;
      isPrimary?: boolean;
    },
    roles: Role[],
  ): Promise<ProductMediaLink> {
    this.requireStaff(roles);
    return this.repository.updateProductMediaLink(productId, linkId, input);
  }

  async unlinkProductMedia(
    productId: string,
    linkId: string,
    roles: Role[],
  ): Promise<void> {
    this.requireStaff(roles);
    await this.repository.deleteProductMediaLink(productId, linkId);
    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.CATALOG_PRODUCT_UPDATED,
        producer: 'catalog-service',
        traceId: createTraceId(),
        payload: { productId, linkId, action: 'media_unlinked' },
      }),
    );
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

  async getProductSummariesByIds(idsRaw?: string) {
    const ids = String(idsRaw ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (ids.length === 0) {
      return [];
    }
    const products = await Promise.all(
      ids.map((id) => this.repository.getProductById(id)),
    );
    const found = products.filter((p): p is NonNullable<typeof p> =>
      Boolean(p),
    );
    const templatesByCategory = new Map<string, SpecTemplate[]>();
    await Promise.all(
      [...new Set(found.map((p) => p.categoryId))].map(async (categoryId) => {
        templatesByCategory.set(
          categoryId,
          await this.repository.getSpecTemplatesByCategory(categoryId),
        );
      }),
    );

    return found.map((product) => {
      const amounts = product.skus
        .map((sku) => sku.price?.amount)
        .filter((amount): amount is number => typeof amount === 'number');
      const primary =
        product.mediaLinks.find((m) => m.isPrimary) ?? product.mediaLinks[0];
      const primarySku = product.skus[0];
      const attrById = new Map<string, { key: string; label: string }>();
      for (const template of templatesByCategory.get(product.categoryId) ??
        []) {
        for (const group of template.groups) {
          for (const attribute of group.attributes) {
            attrById.set(attribute.id, {
              key: attribute.key,
              label: attribute.label,
            });
          }
        }
      }
      const specs: Record<string, string> = {};
      for (const sv of product.specValues) {
        const attr = attrById.get(sv.attributeId);
        const label = attr?.label || attr?.key || sv.attributeId;
        specs[label] = sv.value;
      }
      if (primarySku?.attributes) {
        for (const [key, value] of Object.entries(primarySku.attributes)) {
          if (!value || key in specs) {
            continue;
          }
          specs[key] = value;
        }
      }
      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        status: product.status,
        brandName: product.brand.name,
        categorySlug: product.category.slug,
        categoryName: product.category.name,
        minPrice: amounts.length > 0 ? Math.min(...amounts) : 0,
        currency: 'VND' as const,
        thumbnailUrl: primary?.mediaId,
        primarySkuCode: primarySku?.skuCode,
        primarySkuName: primarySku?.name,
        primarySkuAttributes: primarySku?.attributes ?? {},
        specs,
      };
    });
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
