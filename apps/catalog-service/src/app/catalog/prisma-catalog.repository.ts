import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { ProductStatus as DomainProductStatus } from '@nexatech/shared-contracts';
import {
  MediaRole,
  ProductStatus as PrismaProductStatus,
  type Brand as PrismaBrand,
  type Category as PrismaCategory,
  type Price as PrismaPrice,
  type Product as PrismaProduct,
  type ProductMediaLink as PrismaProductMediaLink,
  type ProductSpecValue as PrismaProductSpecValue,
  type Sku as PrismaSku,
  type SpecAttribute as PrismaSpecAttribute,
  type SpecGroup as PrismaSpecGroup,
  type SpecTemplate as PrismaSpecTemplate,
} from '../../generated/prisma';
import type { CatalogRepository } from './catalog.repository';
import type {
  Brand,
  Category,
  CategoryTreeNode,
  CreateBrandInput,
  CreateCategoryInput,
  CreateProductInput,
  CreateSkuInput,
  CreateSpecTemplateInput,
  LinkProductMediaInput,
  Product,
  ProductDetail,
  ProductMediaLink,
  ProductSearchFilters,
  ProductSearchItem,
  ProductSearchResult,
  ProductSpecValue,
  SkuWithPrice,
  SpecTemplate,
  UpdateBrandInput,
  UpdateCategoryInput,
  UpdatePriceInput,
  UpdateProductInput,
} from './catalog.types';
import { PrismaService } from './prisma.service';

function toDomainStatus(status: PrismaProductStatus): DomainProductStatus {
  switch (status) {
    case PrismaProductStatus.DRAFT:
      return 'draft';
    case PrismaProductStatus.ACTIVE:
      return 'active';
    case PrismaProductStatus.INACTIVE:
      return 'inactive';
    case PrismaProductStatus.ARCHIVED:
      return 'archived';
  }
}

function toPrismaStatus(status: DomainProductStatus): PrismaProductStatus {
  switch (status) {
    case 'draft':
      return PrismaProductStatus.DRAFT;
    case 'active':
      return PrismaProductStatus.ACTIVE;
    case 'inactive':
      return PrismaProductStatus.INACTIVE;
    case 'archived':
      return PrismaProductStatus.ARCHIVED;
  }
}

function buildSearchText(name: string, description?: string): string {
  return [name, description ?? ''].join(' ').trim();
}

function mapCategory(row: PrismaCategory): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    parentId: row.parentId,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapBrand(row: PrismaBrand): Brand {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapProduct(row: PrismaProduct): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    categoryId: row.categoryId,
    brandId: row.brandId,
    status: toDomainStatus(row.status),
    searchText: row.searchText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSpecValue(row: PrismaProductSpecValue): ProductSpecValue {
  return {
    id: row.id,
    productId: row.productId,
    attributeId: row.attributeId,
    value: row.value,
  };
}

function mapPrice(row: PrismaPrice) {
  return {
    id: row.id,
    skuId: row.skuId,
    amount: row.amount,
    currency: row.currency,
    effectiveFrom: row.effectiveFrom,
  };
}

function mapSku(row: PrismaSku & { price?: PrismaPrice | null }): SkuWithPrice {
  return {
    id: row.id,
    productId: row.productId,
    variantId: row.variantId ?? undefined,
    skuCode: row.skuCode,
    name: row.name,
    attributes: (row.attributes as Record<string, string>) ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    price: row.price ? mapPrice(row.price) : undefined,
  };
}

function mapMediaLink(row: PrismaProductMediaLink): ProductMediaLink {
  return {
    id: row.id,
    productId: row.productId,
    mediaId: row.mediaId,
    skuId: row.skuId ?? undefined,
    role: row.role as ProductMediaLink['role'],
    sortOrder: row.sortOrder,
    isPrimary: row.isPrimary,
  };
}

function mapSpecTemplate(
  row: PrismaSpecTemplate & {
    groups: Array<PrismaSpecGroup & { attributes: PrismaSpecAttribute[] }>;
  },
): SpecTemplate {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    groups: row.groups.map((group) => ({
      id: group.id,
      templateId: group.templateId,
      name: group.name,
      sortOrder: group.sortOrder,
      attributes: group.attributes.map((attribute) => ({
        id: attribute.id,
        groupId: attribute.groupId,
        key: attribute.key,
        label: attribute.label,
        dataType: attribute.dataType,
        unit: attribute.unit ?? undefined,
        isFilterable: attribute.isFilterable,
        sortOrder: attribute.sortOrder,
      })),
    })),
  };
}

function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const byParent = new Map<string | null, Category[]>();
  for (const category of categories) {
    const key = category.parentId;
    const list = byParent.get(key) ?? [];
    list.push(category);
    byParent.set(key, list);
  }
  const build = (parentId: string | null): CategoryTreeNode[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((category) => ({
        ...category,
        children: build(category.id),
      }));
  return build(null);
}

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    try {
      const row = await this.prisma.category.create({
        data: {
          slug: input.slug,
          name: input.name,
          parentId: input.parentId ?? null,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
        },
      });
      return mapCategory(row);
    } catch (error) {
      this.handleUnique(error, 'Slug danh mục đã tồn tại', input.slug);
      throw error;
    }
  }

  async updateCategory(
    id: string,
    input: UpdateCategoryInput,
  ): Promise<Category> {
    try {
      const row = await this.prisma.category.update({
        where: { id },
        data: {
          name: input.name,
          parentId: input.parentId,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        },
      });
      return mapCategory(row);
    } catch {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_CATEGORY_NOT_FOUND,
        message: 'Không tìm thấy danh mục',
      });
    }
  }

  async getCategoryById(id: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { id } });
    return row ? mapCategory(row) : null;
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { slug } });
    return row ? mapCategory(row) : null;
  }

  async listTree(): Promise<CategoryTreeNode[]> {
    const rows = await this.prisma.category.findMany();
    return buildCategoryTree(rows.map(mapCategory));
  }

  async createBrand(input: CreateBrandInput): Promise<Brand> {
    try {
      const row = await this.prisma.brand.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
          isActive: input.isActive ?? true,
        },
      });
      return mapBrand(row);
    } catch (error) {
      this.handleUnique(error, 'Slug thương hiệu đã tồn tại', input.slug);
      throw error;
    }
  }

  async updateBrand(id: string, input: UpdateBrandInput): Promise<Brand> {
    try {
      const row = await this.prisma.brand.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          isActive: input.isActive,
        },
      });
      return mapBrand(row);
    } catch {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_BRAND_NOT_FOUND,
        message: 'Không tìm thấy thương hiệu',
      });
    }
  }

  async getBrandById(id: string): Promise<Brand | null> {
    const row = await this.prisma.brand.findUnique({ where: { id } });
    return row ? mapBrand(row) : null;
  }

  async getBrandBySlug(slug: string): Promise<Brand | null> {
    const row = await this.prisma.brand.findUnique({ where: { slug } });
    return row ? mapBrand(row) : null;
  }

  async listBrands(): Promise<Brand[]> {
    const rows = await this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map(mapBrand);
  }

  async createSpecTemplate(
    input: CreateSpecTemplateInput,
  ): Promise<SpecTemplate> {
    try {
      const row = await this.prisma.specTemplate.create({
        data: {
          categoryId: input.categoryId,
          name: input.name,
          groups: {
            create: input.groups.map((group) => ({
              name: group.name,
              sortOrder: group.sortOrder ?? 0,
              attributes: {
                create: group.attributes.map((attribute) => ({
                  key: attribute.key,
                  label: attribute.label,
                  dataType: attribute.dataType ?? 'string',
                  unit: attribute.unit,
                  isFilterable: attribute.isFilterable ?? true,
                  sortOrder: attribute.sortOrder ?? 0,
                })),
              },
            })),
          },
        },
        include: {
          groups: {
            include: { attributes: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
      return mapSpecTemplate(row);
    } catch (error) {
      this.handleUnique(
        error,
        'Mẫu thông số đã tồn tại cho danh mục này',
        input.name,
      );
      throw error;
    }
  }

  async getSpecTemplatesByCategory(
    categoryId: string,
  ): Promise<SpecTemplate[]> {
    const rows = await this.prisma.specTemplate.findMany({
      where: { categoryId },
      include: {
        groups: {
          include: { attributes: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    return rows.map(mapSpecTemplate);
  }

  async createProduct(input: CreateProductInput): Promise<Product> {
    try {
      const row = await this.prisma.product.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
          categoryId: input.categoryId,
          brandId: input.brandId,
          status: toPrismaStatus(input.status ?? 'draft'),
          searchText: buildSearchText(input.name, input.description),
          specValues: {
            create: (input.specs ?? []).map((spec) => ({
              attributeId: spec.attributeId,
              value: spec.value,
            })),
          },
        },
      });
      return mapProduct(row);
    } catch (error) {
      this.handleUnique(error, 'Slug sản phẩm đã tồn tại', input.slug);
      throw error;
    }
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
    const current = await this.prisma.product.findUnique({ where: { id } });
    if (!current) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_PRODUCT_NOT_FOUND,
        message: 'Không tìm thấy sản phẩm',
      });
    }
    const name = input.name ?? current.name;
    const description = input.description ?? current.description ?? undefined;
    const row = await this.prisma.product.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        brandId: input.brandId,
        status: input.status ? toPrismaStatus(input.status) : undefined,
        searchText: buildSearchText(name, description),
      },
    });
    if (input.specs) {
      await this.prisma.productSpecValue.deleteMany({
        where: { productId: id },
      });
      await this.prisma.productSpecValue.createMany({
        data: input.specs.map((spec) => ({
          productId: id,
          attributeId: spec.attributeId,
          value: spec.value,
        })),
      });
    }
    return mapProduct(row);
  }

  async getProductBySlug(slug: string): Promise<ProductDetail | null> {
    const row = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        brand: true,
        specValues: true,
        skus: { include: { price: true } },
        mediaLinks: true,
      },
    });
    if (!row) {
      return null;
    }
    return {
      ...mapProduct(row),
      category: mapCategory(row.category),
      brand: mapBrand(row.brand),
      specValues: row.specValues.map(mapSpecValue),
      skus: row.skus.map(mapSku),
      mediaLinks: row.mediaLinks.map(mapMediaLink),
    };
  }

  async getProductById(id: string): Promise<ProductDetail | null> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        specValues: true,
        skus: { include: { price: true } },
        mediaLinks: true,
      },
    });
    if (!row) {
      return null;
    }
    return {
      ...mapProduct(row),
      category: mapCategory(row.category),
      brand: mapBrand(row.brand),
      specValues: row.specValues.map(mapSpecValue),
      skus: row.skus.map(mapSku),
      mediaLinks: row.mediaLinks.map(mapMediaLink),
    };
  }

  async searchProducts(
    filters: ProductSearchFilters,
  ): Promise<ProductSearchResult> {
    if (filters.q) {
      return this.searchWithFullText(filters);
    }
    return this.searchWithPrisma(filters);
  }

  private async searchWithFullText(
    filters: ProductSearchFilters,
  ): Promise<ProductSearchResult> {
    const conditions: string[] = [
      `p."searchVector" @@ plainto_tsquery('simple', $1)`,
    ];
    const params: unknown[] = [filters.q];
    let paramIndex = 2;

    if (filters.categorySlug) {
      conditions.push(`c."slug" = $${paramIndex++}`);
      params.push(filters.categorySlug);
    }
    if (filters.brandSlug) {
      conditions.push(`b."slug" = $${paramIndex++}`);
      params.push(filters.brandSlug);
    }
    if (filters.status) {
      conditions.push(`p."status" = $${paramIndex++}::"ProductStatus"`);
      params.push(toPrismaStatus(filters.status));
    }

    const whereClause = conditions.join(' AND ');
    const countSql = `
      SELECT COUNT(DISTINCT p."id")::int AS total
      FROM "Product" p
      JOIN "Category" c ON c."id" = p."categoryId"
      JOIN "Brand" b ON b."id" = p."brandId"
      WHERE ${whereClause}
    `;
    const countRows = await this.prisma.$queryRawUnsafe<
      Array<{ total: number }>
    >(countSql, ...params);
    const total = countRows[0]?.total ?? 0;

    const offset = (filters.page - 1) * filters.pageSize;
    const orderBy =
      filters.sort === 'newest'
        ? `p."createdAt" DESC`
        : filters.sort === 'name'
          ? `p."name" ASC`
          : `ts_rank(p."searchVector", plainto_tsquery('simple', $1)) DESC`;

    const dataSql = `
      SELECT p."id", p."slug", p."name", p."status", c."slug" AS "categorySlug",
             b."name" AS "brandName",
             COALESCE(MIN(pr."amount"), 0)::int AS "minPrice"
      FROM "Product" p
      JOIN "Category" c ON c."id" = p."categoryId"
      JOIN "Brand" b ON b."id" = p."brandId"
      LEFT JOIN "Sku" s ON s."productId" = p."id"
      LEFT JOIN "Price" pr ON pr."skuId" = s."id"
      WHERE ${whereClause}
      GROUP BY p."id", p."slug", p."name", p."status", c."slug", b."name", p."searchVector", p."createdAt"
      ORDER BY ${orderBy}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(filters.pageSize, offset);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        slug: string;
        name: string;
        status: PrismaProductStatus;
        categorySlug: string;
        brandName: string;
        minPrice: number;
      }>
    >(dataSql, ...params);

    const items: ProductSearchItem[] = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      brandName: row.brandName,
      categorySlug: row.categorySlug,
      status: toDomainStatus(row.status),
      minPrice: row.minPrice,
      currency: 'VND',
    }));

    return { items, total };
  }

  private async searchWithPrisma(
    filters: ProductSearchFilters,
  ): Promise<ProductSearchResult> {
    const where: Record<string, unknown> = {};

    if (filters.categorySlug) {
      where['category'] = { slug: filters.categorySlug };
    }
    if (filters.brandSlug) {
      where['brand'] = { slug: filters.brandSlug };
    }
    if (filters.status) {
      where['status'] = toPrismaStatus(filters.status);
    }

    const rows = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        brand: true,
        skus: { include: { price: true } },
        mediaLinks: { where: { isPrimary: true }, take: 1 },
      },
      orderBy:
        filters.sort === 'newest'
          ? { createdAt: 'desc' }
          : filters.sort === 'name'
            ? { name: 'asc' }
            : { createdAt: 'desc' },
    });

    let filtered = rows;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      filtered = filtered.filter((product) => {
        const minPrice = Math.min(
          ...product.skus.map((sku) => sku.price?.amount ?? 0),
          0,
        );
        if (filters.minPrice !== undefined && minPrice < filters.minPrice) {
          return false;
        }
        if (filters.maxPrice !== undefined && minPrice > filters.maxPrice) {
          return false;
        }
        return true;
      });
    }

    if (filters.attributeKey && filters.attributeValue) {
      const attribute = await this.prisma.specAttribute.findFirst({
        where: { key: filters.attributeKey },
      });
      if (attribute) {
        const matchingProductIds = (
          await this.prisma.productSpecValue.findMany({
            where: {
              attributeId: attribute.id,
              value: { equals: filters.attributeValue, mode: 'insensitive' },
            },
            select: { productId: true },
          })
        ).map((row) => row.productId);
        filtered = filtered.filter((product) =>
          matchingProductIds.includes(product.id),
        );
      } else {
        filtered = [];
      }
    }

    if (filters.sort === 'price_asc' || filters.sort === 'price_desc') {
      filtered.sort((a, b) => {
        const minA = Math.min(
          ...a.skus.map((sku) => sku.price?.amount ?? 0),
          0,
        );
        const minB = Math.min(
          ...b.skus.map((sku) => sku.price?.amount ?? 0),
          0,
        );
        return filters.sort === 'price_asc' ? minA - minB : minB - minA;
      });
    }

    const total = filtered.length;
    const start = (filters.page - 1) * filters.pageSize;
    const paged = filtered.slice(start, start + filters.pageSize);

    const items: ProductSearchItem[] = paged.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      brandName: product.brand.name,
      categorySlug: product.category.slug,
      status: toDomainStatus(product.status),
      minPrice: Math.min(
        ...product.skus.map((sku) => sku.price?.amount ?? 0),
        0,
      ),
      currency: 'VND',
      thumbnailUrl: product.mediaLinks[0]?.mediaId,
    }));

    return { items, total };
  }

  async createSku(input: CreateSkuInput): Promise<SkuWithPrice> {
    try {
      const row = await this.prisma.sku.create({
        data: {
          productId: input.productId,
          variantId: input.variantId,
          skuCode: input.skuCode,
          name: input.name,
          attributes: input.attributes ?? {},
          price: {
            create: {
              amount: input.price,
              currency: input.currency ?? 'VND',
            },
          },
        },
        include: { price: true },
      });
      return mapSku(row);
    } catch (error) {
      this.handleUnique(error, 'Mã SKU đã tồn tại', input.skuCode);
      throw error;
    }
  }

  async getSkuByCode(skuCode: string): Promise<SkuWithPrice | null> {
    const row = await this.prisma.sku.findUnique({
      where: { skuCode },
      include: { price: true },
    });
    return row ? mapSku(row) : null;
  }

  async listSkusByProduct(productId: string): Promise<SkuWithPrice[]> {
    const rows = await this.prisma.sku.findMany({
      where: { productId },
      include: { price: true },
    });
    return rows.map(mapSku);
  }

  async updatePrice(
    skuId: string,
    input: UpdatePriceInput,
  ): Promise<SkuWithPrice> {
    const sku = await this.prisma.sku.findUnique({ where: { id: skuId } });
    if (!sku) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_SKU_NOT_FOUND,
        message: 'Không tìm thấy SKU',
      });
    }
    await this.prisma.priceHistory.create({
      data: {
        skuId,
        amount: input.amount,
        currency: input.currency ?? 'VND',
        reason: input.reason,
        changedBy: input.changedBy,
      },
    });
    const row = await this.prisma.sku.update({
      where: { id: skuId },
      data: {
        price: {
          upsert: {
            create: {
              amount: input.amount,
              currency: input.currency ?? 'VND',
            },
            update: {
              amount: input.amount,
              currency: input.currency ?? 'VND',
              effectiveFrom: new Date(),
            },
          },
        },
      },
      include: { price: true },
    });
    return mapSku(row);
  }

  async linkProductMedia(
    input: LinkProductMediaInput,
  ): Promise<ProductMediaLink> {
    if (input.isPrimary) {
      await this.prisma.productMediaLink.updateMany({
        where: { productId: input.productId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    try {
      const row = await this.prisma.productMediaLink.create({
        data: {
          productId: input.productId,
          mediaId: input.mediaId,
          skuId: input.skuId,
          role: input.role as MediaRole,
          sortOrder: input.sortOrder ?? 0,
          isPrimary: input.isPrimary ?? false,
        },
      });
      return mapMediaLink(row);
    } catch (error) {
      this.handleUnique(
        error,
        'Media đã được liên kết với sản phẩm',
        input.mediaId,
      );
      throw error;
    }
  }

  async findRecommendations(productId: string, limit = 8): Promise<Product[]> {
    const source = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!source) {
      return [];
    }
    const rows = await this.prisma.product.findMany({
      where: {
        id: { not: productId },
        status: PrismaProductStatus.ACTIVE,
        OR: [{ brandId: source.brandId }, { categoryId: source.categoryId }],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapProduct);
  }

  private handleUnique(error: unknown, message: string, slug: string): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_SLUG_CONFLICT,
        message,
        details: { slug },
      });
    }
  }
}
