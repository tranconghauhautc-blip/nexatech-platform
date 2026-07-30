import type { ProductStatus } from '@nexatech/shared-contracts';

/** ===== catalog-service ===== */
export interface Category {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
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
  /** Có thể là mediaId (cần resolve qua media-service) hoặc URL đầy đủ. */
  thumbnailUrl?: string;
}

export interface ProductSpecValue {
  id: string;
  productId: string;
  attributeId: string;
  value: string;
}

export interface SkuPrice {
  id: string;
  skuId: string;
  amount: number;
  currency: string;
  effectiveFrom: string;
}

export interface SkuWithPrice {
  id: string;
  productId: string;
  variantId?: string;
  skuCode: string;
  name: string;
  attributes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  price?: SkuPrice;
}

export interface ProductMediaLink {
  id: string;
  productId: string;
  mediaId: string;
  skuId?: string;
  role: 'thumbnail' | 'gallery' | 'video';
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  description?: string;
  categoryId: string;
  brandId: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  category: Category;
  brand: Brand;
  specValues: ProductSpecValue[];
  skus: SkuWithPrice[];
  mediaLinks: ProductMediaLink[];
}

export interface RecommendationItem {
  id: string;
  slug: string;
  name: string;
  status: ProductStatus;
}

/** ===== inventory-service ===== */
export interface StockSource {
  locationType: 'warehouse' | 'store';
  locationId: string;
  code: string;
  name: string;
  city?: string;
  available: number;
}

/** ===== customer-service ===== */
export interface CustomerProfile {
  id: string;
  userId: string;
  fullName: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2?: string;
  ward?: string;
  district?: string;
  city: string;
  postalCode?: string;
  isDefault: boolean;
}

/** ===== identity-service ===== */
export interface RegisterResult {
  userId: string;
  email: string;
  debugOtp?: string;
}

export interface AuthTokenResult {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface PasswordResetResult {
  accepted: true;
  debugOtp?: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  expiresAt: string;
  revokedAt?: string;
  userAgent?: string;
  createdAt: string;
}

/** ===== media-service ===== */
export interface MediaLinkRecord {
  id: string;
  mediaId: string;
  entityType: 'product' | 'sku' | 'review';
  entityId: string;
  role: 'thumbnail' | 'gallery' | 'video';
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
}

export interface MediaRecord {
  id: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: 'pending' | 'active' | 'deleted';
  ownerType: 'product' | 'sku' | 'review' | 'user' | 'misc';
  ownerId: string;
  uploadedBy: string;
  etag?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface MediaByEntityItem {
  link: MediaLinkRecord;
  media: MediaRecord;
}

export interface MediaDownloadUrlResult {
  downloadUrl: string;
  expiresIn: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}
