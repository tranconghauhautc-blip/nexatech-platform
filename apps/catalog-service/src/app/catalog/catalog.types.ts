import type { MediaRole, ProductStatus } from '@nexatech/shared-contracts';

export type { ProductStatus, MediaRole };

export interface Category {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpecAttribute {
  id: string;
  groupId: string;
  key: string;
  label: string;
  dataType: string;
  unit?: string;
  isFilterable: boolean;
  sortOrder: number;
}

export interface SpecGroup {
  id: string;
  templateId: string;
  name: string;
  sortOrder: number;
  attributes: SpecAttribute[];
}

export interface SpecTemplate {
  id: string;
  categoryId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  groups: SpecGroup[];
}

export interface ProductSpecValue {
  id: string;
  productId: string;
  attributeId: string;
  value: string;
  attributeKey?: string;
  attributeLabel?: string;
  unit?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description?: string;
  categoryId: string;
  brandId: string;
  status: ProductStatus;
  searchText: string;
  createdAt: Date;
  updatedAt: Date;
  specValues?: ProductSpecValue[];
}

export interface ProductDetail extends Product {
  category: Category;
  brand: Brand;
  specValues: ProductSpecValue[];
  skus: SkuWithPrice[];
  mediaLinks: ProductMediaLink[];
}

export interface Variant {
  id: string;
  productId: string;
  name: string;
  attributes: Record<string, string>;
}

export interface Sku {
  id: string;
  productId: string;
  variantId?: string;
  skuCode: string;
  name: string;
  attributes: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Price {
  id: string;
  skuId: string;
  amount: number;
  currency: string;
  effectiveFrom: Date;
}

export interface PriceHistoryEntry {
  id: string;
  skuId: string;
  amount: number;
  currency: string;
  reason?: string;
  changedBy?: string;
  changedAt: Date;
}

export interface SkuWithPrice extends Sku {
  price?: Price;
  product?: {
    id: string;
    slug: string;
    name: string;
    status: ProductStatus;
    /** mediaId của ảnh đại diện sản phẩm (không phải URL tuyệt đối). */
    thumbnailUrl?: string;
  };
}

export interface ProductMediaLink {
  id: string;
  productId: string;
  mediaId: string;
  skuId?: string;
  role: MediaRole;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductSearchItem {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  categorySlug: string;
  status: ProductStatus;
  minPrice: number;
  currency: 'VND';
  thumbnailUrl?: string;
}

export interface ProductSearchFilters {
  q?: string;
  categorySlug?: string;
  brandSlug?: string;
  status?: ProductStatus;
  minPrice?: number;
  maxPrice?: number;
  attributeKey?: string;
  attributeValue?: string;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'name';
  page: number;
  pageSize: number;
}

export interface ProductSearchResult {
  items: ProductSearchItem[];
  total: number;
}

export interface ProductFacetBrand {
  id: string;
  slug: string;
  name: string;
  productCount: number;
}

export interface ProductSearchFacets {
  brands: ProductFacetBrand[];
  priceRange: { min: number; max: number } | null;
}

export interface CreateCategoryInput {
  slug: string;
  name: string;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateBrandInput {
  slug: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateBrandInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateSpecTemplateInput {
  categoryId: string;
  name: string;
  groups: Array<{
    name: string;
    sortOrder?: number;
    attributes: Array<{
      key: string;
      label: string;
      dataType?: string;
      unit?: string;
      isFilterable?: boolean;
      sortOrder?: number;
    }>;
  }>;
}

export interface UpdateSpecTemplateInput {
  name?: string;
  groups: Array<{
    name: string;
    sortOrder?: number;
    attributes: Array<{
      key: string;
      label: string;
      dataType?: string;
      unit?: string;
      isFilterable?: boolean;
      sortOrder?: number;
    }>;
  }>;
}

export interface CreateProductInput {
  slug: string;
  name: string;
  description?: string;
  categoryId: string;
  brandId: string;
  status?: ProductStatus;
  specs?: Array<{ attributeId: string; value: string }>;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  status?: ProductStatus;
  specs?: Array<{ attributeId: string; value: string }>;
}

export interface CreateSkuInput {
  productId: string;
  skuCode: string;
  name: string;
  attributes?: Record<string, string>;
  variantId?: string;
  price: number;
  currency?: string;
}

export interface UpdateSkuInput {
  name?: string;
  attributes?: Record<string, string>;
}

export interface UpdatePriceInput {
  amount: number;
  currency?: string;
  reason?: string;
  changedBy?: string;
}

export interface LinkProductMediaInput {
  productId: string;
  mediaId: string;
  skuId?: string;
  role: MediaRole;
  sortOrder?: number;
  isPrimary?: boolean;
}

export interface UpdateProductMediaLinkInput {
  role?: MediaRole;
  sortOrder?: number;
  isPrimary?: boolean;
}
