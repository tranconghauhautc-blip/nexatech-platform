import type { ProductStatus } from '@nexatech/shared-contracts';

export interface CategoryTreeNode {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface ProductSummaryRow {
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
  category: Omit<CategoryTreeNode, 'children'>;
  brand: Brand;
  specValues: ProductSpecValue[];
  skus: SkuWithPrice[];
  mediaLinks: ProductMediaLink[];
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  code: string;
  name: string;
  warehouseId?: string;
  address?: string;
  city?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StockLocationType = 'warehouse' | 'store';

export interface StockItem {
  id: string;
  skuCode: string;
  locationType: StockLocationType;
  locationId: string;
  onHand: number;
  reserved: number;
  available: number;
  version: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export type StockMovementType =
  | 'IN'
  | 'OUT'
  | 'RESERVE'
  | 'RELEASE'
  | 'COMMIT'
  | 'RETURN'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'ADJUST';

export interface StockMovement {
  id: string;
  skuCode: string;
  locationType: StockLocationType;
  locationId: string;
  type: StockMovementType;
  quantity: number;
  balanceOnHand: number;
  balanceReserved: number;
  referenceType?: string;
  referenceId?: string;
  actorId?: string;
  note?: string;
  createdAt: string;
}

export interface SpecTemplateAttribute {
  key: string;
  label: string;
  dataType: 'string' | 'number' | 'boolean' | 'enum';
  unit?: string;
  isFilterable: boolean;
  sortOrder: number;
}

export interface SpecTemplateGroup {
  name: string;
  sortOrder: number;
  attributes: SpecTemplateAttribute[];
}

export interface SpecTemplate {
  id: string;
  categoryId: string;
  name: string;
  groups: SpecTemplateGroup[];
  createdAt: string;
  updatedAt: string;
}

export interface MediaAsset {
  id: string;
  ownerType: string;
  ownerId: string;
  role: string;
  status: string;
  bucket: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}
