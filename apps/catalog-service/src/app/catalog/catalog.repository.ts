import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type {
  Brand,
  Category,
  CategoryTreeNode,
  CreateBrandInput,
  CreateCategoryInput,
  CreateProductInput,
  CreateSkuInput,
  CreateSpecTemplateInput,
  UpdateSpecTemplateInput,
  LinkProductMediaInput,
  UpdateProductMediaLinkInput,
  Product,
  ProductDetail,
  ProductMediaLink,
  ProductSearchFilters,
  ProductSearchFacets,
  ProductSearchItem,
  ProductSearchResult,
  ProductSpecValue,
  SkuWithPrice,
  SpecTemplate,
  UpdateBrandInput,
  UpdateCategoryInput,
  UpdatePriceInput,
  UpdateProductInput,
  UpdateSkuInput,
} from './catalog.types';

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

export interface CatalogRepository {
  createCategory(input: CreateCategoryInput): Promise<Category>;
  updateCategory(id: string, input: UpdateCategoryInput): Promise<Category>;
  getCategoryById(id: string): Promise<Category | null>;
  getCategoryBySlug(slug: string): Promise<Category | null>;
  listTree(): Promise<CategoryTreeNode[]>;

  createBrand(input: CreateBrandInput): Promise<Brand>;
  updateBrand(id: string, input: UpdateBrandInput): Promise<Brand>;
  getBrandById(id: string): Promise<Brand | null>;
  getBrandBySlug(slug: string): Promise<Brand | null>;
  listBrands(): Promise<Brand[]>;
  getSearchFacets(filters: ProductSearchFilters): Promise<ProductSearchFacets>;

  createSpecTemplate(input: CreateSpecTemplateInput): Promise<SpecTemplate>;
  getSpecTemplateById(id: string): Promise<SpecTemplate | null>;
  getSpecTemplatesByCategory(categoryId: string): Promise<SpecTemplate[]>;
  updateSpecTemplate(
    id: string,
    input: UpdateSpecTemplateInput,
  ): Promise<SpecTemplate>;
  deleteSpecTemplate(id: string): Promise<void>;

  createProduct(input: CreateProductInput): Promise<Product>;
  updateProduct(id: string, input: UpdateProductInput): Promise<Product>;
  getProductBySlug(slug: string): Promise<ProductDetail | null>;
  getProductById(id: string): Promise<ProductDetail | null>;
  searchProducts(filters: ProductSearchFilters): Promise<ProductSearchResult>;

  createSku(input: CreateSkuInput): Promise<SkuWithPrice>;
  getSkuByCode(skuCode: string): Promise<SkuWithPrice | null>;
  getSkuById(skuId: string): Promise<SkuWithPrice | null>;
  listSkusByProduct(productId: string): Promise<SkuWithPrice[]>;
  updateSku(skuId: string, input: UpdateSkuInput): Promise<SkuWithPrice>;

  updatePrice(skuId: string, input: UpdatePriceInput): Promise<SkuWithPrice>;

  linkProductMedia(input: LinkProductMediaInput): Promise<ProductMediaLink>;
  listProductMediaLinks(productId: string): Promise<ProductMediaLink[]>;
  updateProductMediaLink(
    productId: string,
    linkId: string,
    input: UpdateProductMediaLinkInput,
  ): Promise<ProductMediaLink>;
  deleteProductMediaLink(productId: string, linkId: string): Promise<void>;

  findRecommendations(productId: string, limit?: number): Promise<Product[]>;
}

function buildSearchText(name: string, description?: string): string {
  return [name, description ?? ''].join(' ').trim();
}

function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const byParent = new Map<string | null, Category[]>();
  for (const category of categories) {
    const key = category.parentId;
    const list = byParent.get(key) ?? [];
    list.push(category);
    byParent.set(key, list);
  }

  const build = (parentId: string | null): CategoryTreeNode[] => {
    const nodes = byParent.get(parentId) ?? [];
    return nodes
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((category) => ({
        ...category,
        children: build(category.id),
      }));
  };

  return build(null);
}

export class InMemoryCatalogRepository implements CatalogRepository {
  private categories = new Map<string, Category>();
  private brands = new Map<string, Brand>();
  private specTemplates = new Map<string, SpecTemplate>();
  private products = new Map<string, Product>();
  private specValues = new Map<string, ProductSpecValue>();
  private skus = new Map<string, SkuWithPrice>();
  private skuByCode = new Map<string, string>();
  private prices = new Map<string, { amount: number; currency: string }>();
  private mediaLinks = new Map<string, ProductMediaLink>();
  private attributes = new Map<
    string,
    { key: string; groupId: string; templateId: string; categoryId: string }
  >();

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    if ([...this.categories.values()].some((c) => c.slug === input.slug)) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_SLUG_CONFLICT,
        message: 'Slug danh mục đã tồn tại',
        details: { slug: input.slug },
      });
    }
    if (input.parentId && !this.categories.has(input.parentId)) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_CATEGORY_NOT_FOUND,
        message: 'Không tìm thấy danh mục cha',
      });
    }
    const now = new Date();
    const category: Category = {
      id: createId(),
      slug: input.slug,
      name: input.name,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.categories.set(category.id, category);
    return category;
  }

  async updateCategory(
    id: string,
    input: UpdateCategoryInput,
  ): Promise<Category> {
    const current = this.categories.get(id);
    if (!current) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_CATEGORY_NOT_FOUND,
        message: 'Không tìm thấy danh mục',
      });
    }
    if (input.parentId && !this.categories.has(input.parentId)) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_CATEGORY_NOT_FOUND,
        message: 'Không tìm thấy danh mục cha',
      });
    }
    const updated: Category = {
      ...current,
      name: input.name ?? current.name,
      parentId:
        input.parentId !== undefined ? input.parentId : current.parentId,
      sortOrder: input.sortOrder ?? current.sortOrder,
      isActive: input.isActive ?? current.isActive,
      updatedAt: new Date(),
    };
    this.categories.set(id, updated);
    return updated;
  }

  async getCategoryById(id: string): Promise<Category | null> {
    return this.categories.get(id) ?? null;
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return (
      [...this.categories.values()].find(
        (category) => category.slug === slug,
      ) ?? null
    );
  }

  async listTree(): Promise<CategoryTreeNode[]> {
    return buildCategoryTree([...this.categories.values()]);
  }

  async createBrand(input: CreateBrandInput): Promise<Brand> {
    if ([...this.brands.values()].some((b) => b.slug === input.slug)) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_SLUG_CONFLICT,
        message: 'Slug thương hiệu đã tồn tại',
        details: { slug: input.slug },
      });
    }
    const now = new Date();
    const brand: Brand = {
      id: createId(),
      slug: input.slug,
      name: input.name,
      description: input.description,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.brands.set(brand.id, brand);
    return brand;
  }

  async updateBrand(id: string, input: UpdateBrandInput): Promise<Brand> {
    const current = this.brands.get(id);
    if (!current) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_BRAND_NOT_FOUND,
        message: 'Không tìm thấy thương hiệu',
      });
    }
    const updated: Brand = {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      isActive: input.isActive ?? current.isActive,
      updatedAt: new Date(),
    };
    this.brands.set(id, updated);
    return updated;
  }

  async getBrandById(id: string): Promise<Brand | null> {
    return this.brands.get(id) ?? null;
  }

  async getBrandBySlug(slug: string): Promise<Brand | null> {
    return (
      [...this.brands.values()].find((brand) => brand.slug === slug) ?? null
    );
  }

  async listBrands(): Promise<Brand[]> {
    return [...this.brands.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  async getSearchFacets(
    filters: ProductSearchFilters,
  ): Promise<ProductSearchFacets> {
    // Facets ignore brandSlug so user can switch brands within current scope.
    const base = await this.searchProducts({
      ...filters,
      brandSlug: undefined,
      page: 1,
      pageSize: 10_000,
    });
    const brandCounts = new Map<string, number>();
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    for (const item of base.items) {
      brandCounts.set(
        item.brandName,
        (brandCounts.get(item.brandName) ?? 0) + 1,
      );
      if (item.minPrice < min) min = item.minPrice;
      if (item.minPrice > max) max = item.minPrice;
    }
    const brands: ProductSearchFacets['brands'] = [];
    for (const brand of await this.listBrands()) {
      const count = brandCounts.get(brand.name) ?? 0;
      if (count > 0) {
        brands.push({
          id: brand.id,
          slug: brand.slug,
          name: brand.name,
          productCount: count,
        });
      }
    }
    brands.sort((a, b) => a.name.localeCompare(b.name));
    return {
      brands,
      priceRange:
        base.items.length > 0 && Number.isFinite(min) ? { min, max } : null,
    };
  }

  async createSpecTemplate(
    input: CreateSpecTemplateInput,
  ): Promise<SpecTemplate> {
    if (!this.categories.has(input.categoryId)) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_CATEGORY_NOT_FOUND,
        message: 'Không tìm thấy danh mục',
      });
    }
    const duplicate = [...this.specTemplates.values()].some(
      (template) =>
        template.categoryId === input.categoryId &&
        template.name === input.name,
    );
    if (duplicate) {
      throw new AppError({
        errorCode: ErrorCodes.CONFLICT,
        message: 'Mẫu thông số đã tồn tại cho danh mục này',
      });
    }
    const now = new Date();
    const templateId = createId();
    const groups = input.groups.map((group) => {
      const groupId = createId();
      const attributes = group.attributes.map((attribute) => {
        const attributeId = createId();
        this.attributes.set(attributeId, {
          key: attribute.key,
          groupId,
          templateId,
          categoryId: input.categoryId,
        });
        return {
          id: attributeId,
          groupId,
          key: attribute.key,
          label: attribute.label,
          dataType: attribute.dataType ?? 'string',
          unit: attribute.unit,
          isFilterable: attribute.isFilterable ?? true,
          sortOrder: attribute.sortOrder ?? 0,
        };
      });
      return {
        id: groupId,
        templateId,
        name: group.name,
        sortOrder: group.sortOrder ?? 0,
        attributes,
      };
    });
    const template: SpecTemplate = {
      id: templateId,
      categoryId: input.categoryId,
      name: input.name,
      createdAt: now,
      updatedAt: now,
      groups,
    };
    this.specTemplates.set(templateId, template);
    return template;
  }

  async getSpecTemplateById(id: string): Promise<SpecTemplate | null> {
    return this.specTemplates.get(id) ?? null;
  }

  async getSpecTemplatesByCategory(
    categoryId: string,
  ): Promise<SpecTemplate[]> {
    return [...this.specTemplates.values()].filter(
      (template) => template.categoryId === categoryId,
    );
  }

  private groupKey(sortOrder: number, name: string): string {
    return `${sortOrder}:${name}`;
  }

  async updateSpecTemplate(
    id: string,
    input: UpdateSpecTemplateInput,
  ): Promise<SpecTemplate> {
    const current = this.specTemplates.get(id);
    if (!current) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy mẫu thông số',
      });
    }

    const existingByKey = new Map<
      string,
      (typeof current.groups)[0]['attributes'][0]
    >();
    for (const group of current.groups) {
      for (const attribute of group.attributes) {
        existingByKey.set(attribute.key, attribute);
      }
    }

    const payloadKeys = new Set<string>();
    for (const group of input.groups) {
      for (const attribute of group.attributes) {
        payloadKeys.add(attribute.key);
      }
    }

    for (const [key, attribute] of existingByKey) {
      if (!payloadKeys.has(key)) {
        const referenced = [...this.specValues.values()].some(
          (value) => value.attributeId === attribute.id,
        );
        if (referenced) {
          throw new AppError({
            errorCode: ErrorCodes.CONFLICT,
            message: `Không thể xóa thuộc tính "${attribute.label}" (${key}) vì đã có sản phẩm sử dụng`,
            details: { attributeId: attribute.id, key },
          });
        }
      }
    }

    const existingGroupsByKey = new Map<string, (typeof current.groups)[0]>();
    for (const group of current.groups) {
      existingGroupsByKey.set(
        this.groupKey(group.sortOrder, group.name),
        group,
      );
    }

    const usedGroupIds = new Set<string>();
    const newGroups: SpecTemplate['groups'] = [];

    for (const groupInput of input.groups) {
      const sortOrder = groupInput.sortOrder ?? 0;
      const key = this.groupKey(sortOrder, groupInput.name);
      const existingGroup = existingGroupsByKey.get(key);
      const groupId = existingGroup?.id ?? createId();
      usedGroupIds.add(groupId);

      const attributes = groupInput.attributes.map((attributeInput) => {
        const attrSortOrder = attributeInput.sortOrder ?? 0;
        const existingAttr = existingByKey.get(attributeInput.key);
        const attributeId = existingAttr?.id ?? createId();
        this.attributes.set(attributeId, {
          key: attributeInput.key,
          groupId,
          templateId: id,
          categoryId: current.categoryId,
        });
        return {
          id: attributeId,
          groupId,
          key: attributeInput.key,
          label: attributeInput.label,
          dataType: attributeInput.dataType ?? 'string',
          unit: attributeInput.unit,
          isFilterable: attributeInput.isFilterable ?? true,
          sortOrder: attrSortOrder,
        };
      });

      newGroups.push({
        id: groupId,
        templateId: id,
        name: groupInput.name,
        sortOrder,
        attributes,
      });
    }

    for (const [key, attribute] of existingByKey) {
      if (!payloadKeys.has(key)) {
        this.attributes.delete(attribute.id);
      }
    }

    for (const group of current.groups) {
      if (!usedGroupIds.has(group.id)) {
        for (const attribute of group.attributes) {
          this.attributes.delete(attribute.id);
        }
      }
    }

    const updated: SpecTemplate = {
      ...current,
      name: input.name ?? current.name,
      updatedAt: new Date(),
      groups: newGroups,
    };
    this.specTemplates.set(id, updated);
    return updated;
  }

  async deleteSpecTemplate(id: string): Promise<void> {
    const current = this.specTemplates.get(id);
    if (!current) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy mẫu thông số',
      });
    }

    const attributeIds = current.groups.flatMap((group) =>
      group.attributes.map((attribute) => attribute.id),
    );
    const referenced = [...this.specValues.values()].some((value) =>
      attributeIds.includes(value.attributeId),
    );
    if (referenced) {
      throw new AppError({
        errorCode: ErrorCodes.CONFLICT,
        message:
          'Không thể xóa mẫu thông số vì đã có sản phẩm sử dụng các thuộc tính',
      });
    }

    for (const group of current.groups) {
      for (const attribute of group.attributes) {
        this.attributes.delete(attribute.id);
      }
    }
    this.specTemplates.delete(id);
  }

  async createProduct(input: CreateProductInput): Promise<Product> {
    if ([...this.products.values()].some((p) => p.slug === input.slug)) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_SLUG_CONFLICT,
        message: 'Slug sản phẩm đã tồn tại',
        details: { slug: input.slug },
      });
    }
    if (!this.categories.has(input.categoryId)) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_CATEGORY_NOT_FOUND,
        message: 'Không tìm thấy danh mục',
      });
    }
    if (!this.brands.has(input.brandId)) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_BRAND_NOT_FOUND,
        message: 'Không tìm thấy thương hiệu',
      });
    }
    const now = new Date();
    const product: Product = {
      id: createId(),
      slug: input.slug,
      name: input.name,
      description: input.description,
      categoryId: input.categoryId,
      brandId: input.brandId,
      status: input.status ?? 'draft',
      searchText: buildSearchText(input.name, input.description),
      createdAt: now,
      updatedAt: now,
    };
    this.products.set(product.id, product);
    for (const spec of input.specs ?? []) {
      const value: ProductSpecValue = {
        id: createId(),
        productId: product.id,
        attributeId: spec.attributeId,
        value: spec.value,
      };
      this.specValues.set(value.id, value);
    }
    return product;
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
    const current = this.products.get(id);
    if (!current) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_PRODUCT_NOT_FOUND,
        message: 'Không tìm thấy sản phẩm',
      });
    }
    if (input.categoryId && !this.categories.has(input.categoryId)) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_CATEGORY_NOT_FOUND,
        message: 'Không tìm thấy danh mục',
      });
    }
    if (input.brandId && !this.brands.has(input.brandId)) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_BRAND_NOT_FOUND,
        message: 'Không tìm thấy thương hiệu',
      });
    }
    const updated: Product = {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      categoryId: input.categoryId ?? current.categoryId,
      brandId: input.brandId ?? current.brandId,
      status: input.status ?? current.status,
      searchText: buildSearchText(
        input.name ?? current.name,
        input.description ?? current.description,
      ),
      updatedAt: new Date(),
    };
    this.products.set(id, updated);
    if (input.specs) {
      for (const [specId, spec] of this.specValues) {
        if (spec.productId === id) {
          this.specValues.delete(specId);
        }
      }
      for (const spec of input.specs) {
        const value: ProductSpecValue = {
          id: createId(),
          productId: id,
          attributeId: spec.attributeId,
          value: spec.value,
        };
        this.specValues.set(value.id, value);
      }
    }
    return updated;
  }

  private toProductDetail(product: Product): ProductDetail {
    const category = this.categories.get(product.categoryId);
    const brand = this.brands.get(product.brandId);
    if (!category || !brand) {
      throw new AppError({
        errorCode: ErrorCodes.INTERNAL_ERROR,
        message: 'Dữ liệu sản phẩm không nhất quán',
      });
    }
    const specValues = [...this.specValues.values()].filter(
      (value) => value.productId === product.id,
    );
    const skus = [...this.skus.values()].filter(
      (sku) => sku.productId === product.id,
    );
    const media = [...this.mediaLinks.values()].filter(
      (link) => link.productId === product.id,
    );
    return {
      ...product,
      category,
      brand,
      specValues,
      skus,
      mediaLinks: media,
    };
  }

  async getProductBySlug(slug: string): Promise<ProductDetail | null> {
    const product = [...this.products.values()].find((p) => p.slug === slug);
    return product ? this.toProductDetail(product) : null;
  }

  async getProductById(id: string): Promise<ProductDetail | null> {
    const product = this.products.get(id);
    return product ? this.toProductDetail(product) : null;
  }

  private getMinPrice(productId: string): number {
    const productSkus = [...this.skus.values()].filter(
      (sku) => sku.productId === productId,
    );
    const amounts = productSkus
      .map((sku) => this.prices.get(sku.id)?.amount)
      .filter((amount): amount is number => typeof amount === 'number');
    if (amounts.length === 0) {
      return 0;
    }
    return Math.min(...amounts);
  }

  private toSearchItem(product: Product): ProductSearchItem {
    const brand = this.brands.get(product.brandId);
    const category = this.categories.get(product.categoryId);
    const primaryMedia = [...this.mediaLinks.values()]
      .filter((link) => link.productId === product.id && link.isPrimary)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0];
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      brandName: brand?.name ?? '',
      categorySlug: category?.slug ?? '',
      status: product.status,
      minPrice: this.getMinPrice(product.id),
      currency: 'VND',
      thumbnailUrl: primaryMedia?.mediaId,
    };
  }

  async searchProducts(
    filters: ProductSearchFilters,
  ): Promise<ProductSearchResult> {
    let items = [...this.products.values()];

    if (filters.categorySlug) {
      const category = await this.getCategoryBySlug(filters.categorySlug);
      if (category) {
        items = items.filter((product) => product.categoryId === category.id);
      } else {
        items = [];
      }
    }

    if (filters.brandSlug) {
      const brand = await this.getBrandBySlug(filters.brandSlug);
      if (brand) {
        items = items.filter((product) => product.brandId === brand.id);
      } else {
        items = [];
      }
    }

    if (filters.status) {
      items = items.filter((product) => product.status === filters.status);
    }

    if (filters.q) {
      const query = filters.q.toLowerCase();
      items = items.filter((product) =>
        product.searchText.toLowerCase().includes(query),
      );
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      items = items.filter((product) => {
        const minPrice = this.getMinPrice(product.id);
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
      const matchingAttributeIds = [...this.attributes.entries()]
        .filter(([, attribute]) => attribute.key === filters.attributeKey)
        .map(([id]) => id);
      items = items.filter((product) =>
        [...this.specValues.values()].some(
          (value) =>
            value.productId === product.id &&
            matchingAttributeIds.includes(value.attributeId) &&
            value.value.toLowerCase() ===
              (filters.attributeValue ?? '').toLowerCase(),
        ),
      );
    }

    const sort = filters.sort ?? 'relevance';
    items.sort((a, b) => {
      switch (sort) {
        case 'price_asc':
          return this.getMinPrice(a.id) - this.getMinPrice(b.id);
        case 'price_desc':
          return this.getMinPrice(b.id) - this.getMinPrice(a.id);
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    const total = items.length;
    const start = (filters.page - 1) * filters.pageSize;
    const paged = items.slice(start, start + filters.pageSize);
    return {
      items: paged.map((product) => this.toSearchItem(product)),
      total,
    };
  }

  async createSku(input: CreateSkuInput): Promise<SkuWithPrice> {
    if (this.skuByCode.has(input.skuCode)) {
      throw new AppError({
        errorCode: ErrorCodes.CONFLICT,
        message: 'Mã SKU đã tồn tại',
        details: { skuCode: input.skuCode },
      });
    }
    if (!this.products.has(input.productId)) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_PRODUCT_NOT_FOUND,
        message: 'Không tìm thấy sản phẩm',
      });
    }
    const now = new Date();
    const priceId = createId();
    const sku: SkuWithPrice = {
      id: createId(),
      productId: input.productId,
      variantId: input.variantId,
      skuCode: input.skuCode,
      name: input.name,
      attributes: input.attributes ?? {},
      createdAt: now,
      updatedAt: now,
      price: {
        id: priceId,
        skuId: '',
        amount: input.price,
        currency: input.currency ?? 'VND',
        effectiveFrom: now,
      },
    };
    if (sku.price) {
      sku.price.skuId = sku.id;
    }
    this.skus.set(sku.id, sku);
    this.skuByCode.set(input.skuCode, sku.id);
    this.prices.set(sku.id, {
      amount: input.price,
      currency: input.currency ?? 'VND',
    });
    return sku;
  }

  async getSkuByCode(skuCode: string): Promise<SkuWithPrice | null> {
    const id = this.skuByCode.get(skuCode);
    if (!id) {
      return null;
    }
    const sku = this.skus.get(id);
    if (!sku) {
      return null;
    }
    const product = this.products.get(sku.productId);
    return {
      ...sku,
      product: product
        ? {
            id: product.id,
            slug: product.slug,
            name: product.name,
            status: product.status,
          }
        : undefined,
    };
  }

  async getSkuById(skuId: string): Promise<SkuWithPrice | null> {
    const sku = this.skus.get(skuId);
    return sku ? { ...sku } : null;
  }

  async listSkusByProduct(productId: string): Promise<SkuWithPrice[]> {
    return [...this.skus.values()].filter((sku) => sku.productId === productId);
  }

  async updateSku(skuId: string, input: UpdateSkuInput): Promise<SkuWithPrice> {
    const sku = this.skus.get(skuId);
    if (!sku) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_SKU_NOT_FOUND,
        message: 'Không tìm thấy SKU',
      });
    }
    const updated: SkuWithPrice = {
      ...sku,
      name: input.name ?? sku.name,
      attributes: input.attributes ?? sku.attributes,
      updatedAt: new Date(),
    };
    this.skus.set(skuId, updated);
    return updated;
  }

  async updatePrice(
    skuId: string,
    input: UpdatePriceInput,
  ): Promise<SkuWithPrice> {
    const sku = this.skus.get(skuId);
    if (!sku) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_SKU_NOT_FOUND,
        message: 'Không tìm thấy SKU',
      });
    }
    const now = new Date();
    const price = {
      id: createId(),
      skuId,
      amount: input.amount,
      currency: input.currency ?? 'VND',
      effectiveFrom: now,
    };
    sku.price = price;
    sku.updatedAt = now;
    this.prices.set(skuId, {
      amount: input.amount,
      currency: input.currency ?? 'VND',
    });
    this.skus.set(skuId, sku);
    return sku;
  }

  async linkProductMedia(
    input: LinkProductMediaInput,
  ): Promise<ProductMediaLink> {
    if (!this.products.has(input.productId)) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_PRODUCT_NOT_FOUND,
        message: 'Không tìm thấy sản phẩm',
      });
    }
    const duplicate = [...this.mediaLinks.values()].find(
      (link) =>
        link.productId === input.productId && link.mediaId === input.mediaId,
    );
    if (duplicate) {
      throw new AppError({
        errorCode: ErrorCodes.CONFLICT,
        message: 'Media đã được liên kết với sản phẩm',
      });
    }
    if (input.isPrimary) {
      for (const [id, link] of this.mediaLinks) {
        if (link.productId === input.productId && link.isPrimary) {
          this.mediaLinks.set(id, { ...link, isPrimary: false });
        }
      }
    }
    const link: ProductMediaLink = {
      id: createId(),
      productId: input.productId,
      mediaId: input.mediaId,
      skuId: input.skuId,
      role: input.role,
      sortOrder: input.sortOrder ?? 0,
      isPrimary: input.isPrimary ?? false,
    };
    this.mediaLinks.set(link.id, link);
    return link;
  }

  async listProductMediaLinks(productId: string): Promise<ProductMediaLink[]> {
    return [...this.mediaLinks.values()]
      .filter((link) => link.productId === productId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async updateProductMediaLink(
    productId: string,
    linkId: string,
    input: UpdateProductMediaLinkInput,
  ): Promise<ProductMediaLink> {
    const link = this.mediaLinks.get(linkId);
    if (!link || link.productId !== productId) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_PRODUCT_NOT_FOUND,
        message: 'Không tìm thấy liên kết media',
      });
    }
    if (input.isPrimary) {
      for (const [id, existing] of this.mediaLinks) {
        if (existing.productId === productId && existing.isPrimary) {
          this.mediaLinks.set(id, { ...existing, isPrimary: false });
        }
      }
    }
    const updated: ProductMediaLink = {
      ...link,
      role: input.role ?? link.role,
      sortOrder: input.sortOrder ?? link.sortOrder,
      isPrimary: input.isPrimary ?? link.isPrimary,
    };
    this.mediaLinks.set(linkId, updated);
    return updated;
  }

  async deleteProductMediaLink(
    productId: string,
    linkId: string,
  ): Promise<void> {
    const link = this.mediaLinks.get(linkId);
    if (!link || link.productId !== productId) {
      throw new AppError({
        errorCode: ErrorCodes.CATALOG_PRODUCT_NOT_FOUND,
        message: 'Không tìm thấy liên kết media',
      });
    }
    this.mediaLinks.delete(linkId);
  }

  async findRecommendations(productId: string, limit = 8): Promise<Product[]> {
    const source = this.products.get(productId);
    if (!source) {
      return [];
    }
    return [...this.products.values()]
      .filter(
        (product) =>
          product.id !== productId &&
          product.status === 'active' &&
          (product.brandId === source.brandId ||
            product.categoryId === source.categoryId),
      )
      .slice(0, limit);
  }
}
