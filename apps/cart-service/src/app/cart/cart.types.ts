import type { CartOwnerType, CartStatus } from '@nexatech/shared-contracts';

export type { CartOwnerType, CartStatus };

export interface CartItem {
  id: string;
  cartId: string;
  skuId: string;
  skuCode: string;
  quantity: number;
  unitPriceSnapshot: number;
  currency: string;
  productId: string;
  productName: string;
  productSlug: string;
  skuName: string;
  attributes: Record<string, string>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Cart {
  id: string;
  ownerType: CartOwnerType;
  customerId?: string;
  guestTokenHash?: string;
  status: CartStatus;
  version: number;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  items: CartItem[];
}

export interface WishlistItem {
  id: string;
  customerId: string;
  productId: string;
  skuId?: string;
  createdAt: Date;
}

export interface ComparisonItem {
  id: string;
  customerId: string;
  productId: string;
  createdAt: Date;
}

export interface RecentlyViewedItem {
  id: string;
  customerId?: string;
  guestTokenHash?: string;
  productId: string;
  viewedAt: Date;
}

export interface IdempotencyRecord {
  key: string;
  operation: string;
  responseJson: unknown;
  createdAt: Date;
}

export interface CreateGuestCartInput {
  guestTokenHash: string;
  expiresAt: Date;
}

export interface CreateCustomerCartInput {
  customerId: string;
}

export interface UpsertCartItemInput {
  cartId: string;
  expectedVersion: number;
  skuId: string;
  skuCode: string;
  quantity: number;
  unitPriceSnapshot: number;
  currency: string;
  productId: string;
  productName: string;
  productSlug: string;
  skuName: string;
  attributes: Record<string, string>;
  metadata?: Record<string, unknown>;
  /** replace = set quantity; add = increment */
  mode: 'replace' | 'add';
}

export interface RemoveCartItemInput {
  cartId: string;
  expectedVersion: number;
  skuId: string;
}

export interface ClearCartInput {
  cartId: string;
  expectedVersion: number;
}

export interface UpdateCartStatusInput {
  cartId: string;
  expectedVersion: number;
  status: CartStatus;
  expiresAt?: Date | null;
}

export interface CatalogSkuInfo {
  skuId: string;
  skuCode: string;
  productId: string;
  productName: string;
  productSlug: string;
  productStatus: 'draft' | 'active' | 'inactive' | 'archived';
  skuName: string;
  attributes: Record<string, string>;
  unitPrice: number;
  currency: string;
  isSellable: boolean;
}

export interface InventoryAvailability {
  skuCode: string;
  quantityRequested: number;
  available: boolean;
  totalAvailable: number;
}

export interface ReservationContractPreview {
  skuCode: string;
  quantity: number;
}
