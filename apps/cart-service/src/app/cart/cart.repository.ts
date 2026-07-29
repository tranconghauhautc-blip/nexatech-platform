import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type {
  Cart,
  CartItem,
  ClearCartInput,
  ComparisonItem,
  CreateCustomerCartInput,
  CreateGuestCartInput,
  IdempotencyRecord,
  RecentlyViewedItem,
  RemoveCartItemInput,
  UpdateCartStatusInput,
  UpsertCartItemInput,
  WishlistItem,
} from './cart.types';

export const CART_REPOSITORY = Symbol('CART_REPOSITORY');

export interface CartRepository {
  createGuestCart(input: CreateGuestCartInput): Promise<Cart>;
  createCustomerCart(input: CreateCustomerCartInput): Promise<Cart>;
  getCartById(id: string): Promise<Cart | null>;
  getActiveCartByCustomerId(customerId: string): Promise<Cart | null>;
  getActiveCartByGuestTokenHash(tokenHash: string): Promise<Cart | null>;
  upsertItem(input: UpsertCartItemInput): Promise<Cart>;
  removeItem(input: RemoveCartItemInput): Promise<Cart>;
  clearItems(input: ClearCartInput): Promise<Cart>;
  updateStatus(input: UpdateCartStatusInput): Promise<Cart>;
  replaceItems(
    cartId: string,
    expectedVersion: number,
    items: Array<Omit<CartItem, 'id' | 'cartId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Cart>;
  listExpiredActiveCarts(now: Date): Promise<Cart[]>;
  findIdempotency(key: string): Promise<IdempotencyRecord | null>;
  saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void>;
  writeAudit(
    action: string,
    actorId: string,
    details?: Record<string, unknown>,
  ): Promise<void>;
  listWishlist(customerId: string): Promise<WishlistItem[]>;
  addWishlist(item: {
    customerId: string;
    productId: string;
    skuId?: string;
  }): Promise<WishlistItem>;
  removeWishlist(customerId: string, productId: string): Promise<void>;
  listComparison(customerId: string): Promise<ComparisonItem[]>;
  addComparison(customerId: string, productId: string): Promise<ComparisonItem>;
  removeComparison(customerId: string, productId: string): Promise<void>;
  clearComparison(customerId: string): Promise<void>;
  trackRecentlyViewed(input: {
    customerId?: string;
    guestTokenHash?: string;
    productId: string;
    maxItems: number;
  }): Promise<RecentlyViewedItem[]>;
  listRecentlyViewed(input: {
    customerId?: string;
    guestTokenHash?: string;
    limit: number;
  }): Promise<RecentlyViewedItem[]>;
}

function cloneCart(cart: Cart): Cart {
  return {
    ...cart,
    expiresAt: cart.expiresAt ? new Date(cart.expiresAt) : undefined,
    createdAt: new Date(cart.createdAt),
    updatedAt: new Date(cart.updatedAt),
    items: cart.items.map((item) => ({
      ...item,
      attributes: { ...item.attributes },
      metadata: item.metadata ? { ...item.metadata } : undefined,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    })),
  };
}

function assertVersion(cart: Cart, expectedVersion: number): void {
  if (cart.version !== expectedVersion) {
    throw new AppError({
      errorCode: ErrorCodes.CART_CONFLICT,
      message: 'Giỏ hàng đã được cập nhật bởi thao tác khác',
      details: { expectedVersion, actualVersion: cart.version },
    });
  }
}

export class InMemoryCartRepository implements CartRepository {
  private carts = new Map<string, Cart>();
  private idempotency = new Map<string, IdempotencyRecord>();
  private audits: Array<{
    id: string;
    action: string;
    actorId: string;
    details?: Record<string, unknown>;
    createdAt: Date;
  }> = [];
  private wishlist = new Map<string, WishlistItem>();
  private comparison = new Map<string, ComparisonItem>();
  private recentlyViewed = new Map<string, RecentlyViewedItem>();

  async createGuestCart(input: CreateGuestCartInput): Promise<Cart> {
    const now = new Date();
    const cart: Cart = {
      id: createId(),
      ownerType: 'GUEST',
      guestTokenHash: input.guestTokenHash,
      status: 'ACTIVE',
      version: 0,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
      items: [],
    };
    this.carts.set(cart.id, cart);
    return cloneCart(cart);
  }

  async createCustomerCart(input: CreateCustomerCartInput): Promise<Cart> {
    const existing = [...this.carts.values()].find(
      (c) =>
        c.customerId === input.customerId &&
        c.status === 'ACTIVE' &&
        c.ownerType === 'CUSTOMER',
    );
    if (existing) {
      return cloneCart(existing);
    }
    const now = new Date();
    const cart: Cart = {
      id: createId(),
      ownerType: 'CUSTOMER',
      customerId: input.customerId,
      status: 'ACTIVE',
      version: 0,
      createdAt: now,
      updatedAt: now,
      items: [],
    };
    this.carts.set(cart.id, cart);
    return cloneCart(cart);
  }

  async getCartById(id: string): Promise<Cart | null> {
    const cart = this.carts.get(id);
    return cart ? cloneCart(cart) : null;
  }

  async getActiveCartByCustomerId(customerId: string): Promise<Cart | null> {
    const cart = [...this.carts.values()].find(
      (c) =>
        c.customerId === customerId &&
        c.status === 'ACTIVE' &&
        c.ownerType === 'CUSTOMER',
    );
    return cart ? cloneCart(cart) : null;
  }

  async getActiveCartByGuestTokenHash(tokenHash: string): Promise<Cart | null> {
    const cart = [...this.carts.values()].find(
      (c) =>
        c.guestTokenHash === tokenHash &&
        c.status === 'ACTIVE' &&
        c.ownerType === 'GUEST',
    );
    return cart ? cloneCart(cart) : null;
  }

  async upsertItem(input: UpsertCartItemInput): Promise<Cart> {
    const cart = this.carts.get(input.cartId);
    if (!cart || cart.status !== 'ACTIVE') {
      throw new AppError({
        errorCode: ErrorCodes.CART_NOT_FOUND,
        message: 'Không tìm thấy giỏ hàng',
      });
    }
    assertVersion(cart, input.expectedVersion);
    const now = new Date();
    const existing = cart.items.find((i) => i.skuId === input.skuId);
    if (existing) {
      const nextQty =
        input.mode === 'add'
          ? existing.quantity + input.quantity
          : input.quantity;
      existing.quantity = nextQty;
      existing.unitPriceSnapshot = input.unitPriceSnapshot;
      existing.currency = input.currency;
      existing.productName = input.productName;
      existing.productSlug = input.productSlug;
      existing.skuName = input.skuName;
      existing.attributes = { ...input.attributes };
      existing.metadata = input.metadata;
      existing.updatedAt = now;
    } else {
      cart.items.push({
        id: createId(),
        cartId: cart.id,
        skuId: input.skuId,
        skuCode: input.skuCode,
        quantity: input.quantity,
        unitPriceSnapshot: input.unitPriceSnapshot,
        currency: input.currency,
        productId: input.productId,
        productName: input.productName,
        productSlug: input.productSlug,
        skuName: input.skuName,
        attributes: { ...input.attributes },
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      });
    }
    cart.version += 1;
    cart.updatedAt = now;
    return cloneCart(cart);
  }

  async removeItem(input: RemoveCartItemInput): Promise<Cart> {
    const cart = this.carts.get(input.cartId);
    if (!cart || cart.status !== 'ACTIVE') {
      throw new AppError({
        errorCode: ErrorCodes.CART_NOT_FOUND,
        message: 'Không tìm thấy giỏ hàng',
      });
    }
    assertVersion(cart, input.expectedVersion);
    const before = cart.items.length;
    cart.items = cart.items.filter((i) => i.skuId !== input.skuId);
    if (cart.items.length === before) {
      throw new AppError({
        errorCode: ErrorCodes.CART_ITEM_NOT_FOUND,
        message: 'Không tìm thấy sản phẩm trong giỏ hàng',
        details: { skuId: input.skuId },
      });
    }
    cart.version += 1;
    cart.updatedAt = new Date();
    return cloneCart(cart);
  }

  async clearItems(input: ClearCartInput): Promise<Cart> {
    const cart = this.carts.get(input.cartId);
    if (!cart || cart.status !== 'ACTIVE') {
      throw new AppError({
        errorCode: ErrorCodes.CART_NOT_FOUND,
        message: 'Không tìm thấy giỏ hàng',
      });
    }
    assertVersion(cart, input.expectedVersion);
    cart.items = [];
    cart.version += 1;
    cart.updatedAt = new Date();
    return cloneCart(cart);
  }

  async updateStatus(input: UpdateCartStatusInput): Promise<Cart> {
    const cart = this.carts.get(input.cartId);
    if (!cart) {
      throw new AppError({
        errorCode: ErrorCodes.CART_NOT_FOUND,
        message: 'Không tìm thấy giỏ hàng',
      });
    }
    assertVersion(cart, input.expectedVersion);
    cart.status = input.status;
    if (input.expiresAt !== undefined) {
      cart.expiresAt = input.expiresAt ?? undefined;
    }
    cart.version += 1;
    cart.updatedAt = new Date();
    return cloneCart(cart);
  }

  async replaceItems(
    cartId: string,
    expectedVersion: number,
    items: Array<Omit<CartItem, 'id' | 'cartId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart || cart.status !== 'ACTIVE') {
      throw new AppError({
        errorCode: ErrorCodes.CART_NOT_FOUND,
        message: 'Không tìm thấy giỏ hàng',
      });
    }
    assertVersion(cart, expectedVersion);
    const now = new Date();
    cart.items = items.map((item) => ({
      ...item,
      id: createId(),
      cartId,
      attributes: { ...item.attributes },
      metadata: item.metadata ? { ...item.metadata } : undefined,
      createdAt: now,
      updatedAt: now,
    }));
    cart.version += 1;
    cart.updatedAt = now;
    return cloneCart(cart);
  }

  async listExpiredActiveCarts(now: Date): Promise<Cart[]> {
    return [...this.carts.values()]
      .filter(
        (c) =>
          c.status === 'ACTIVE' &&
          c.expiresAt !== undefined &&
          c.expiresAt <= now,
      )
      .map(cloneCart);
  }

  async findIdempotency(key: string): Promise<IdempotencyRecord | null> {
    return this.idempotency.get(key) ?? null;
  }

  async saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void> {
    this.idempotency.set(key, {
      key,
      operation,
      responseJson: response,
      createdAt: new Date(),
    });
  }

  async writeAudit(
    action: string,
    actorId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    this.audits.push({
      id: createId(),
      action,
      actorId,
      details,
      createdAt: new Date(),
    });
  }

  async listWishlist(customerId: string): Promise<WishlistItem[]> {
    return [...this.wishlist.values()]
      .filter((i) => i.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async addWishlist(item: {
    customerId: string;
    productId: string;
    skuId?: string;
  }): Promise<WishlistItem> {
    const key = `${item.customerId}:${item.productId}`;
    const existing = this.wishlist.get(key);
    if (existing) {
      return { ...existing };
    }
    const created: WishlistItem = {
      id: createId(),
      customerId: item.customerId,
      productId: item.productId,
      skuId: item.skuId,
      createdAt: new Date(),
    };
    this.wishlist.set(key, created);
    return { ...created };
  }

  async removeWishlist(customerId: string, productId: string): Promise<void> {
    this.wishlist.delete(`${customerId}:${productId}`);
  }

  async listComparison(customerId: string): Promise<ComparisonItem[]> {
    return [...this.comparison.values()]
      .filter((i) => i.customerId === customerId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async addComparison(
    customerId: string,
    productId: string,
  ): Promise<ComparisonItem> {
    const key = `${customerId}:${productId}`;
    const existing = this.comparison.get(key);
    if (existing) {
      return { ...existing };
    }
    const created: ComparisonItem = {
      id: createId(),
      customerId,
      productId,
      createdAt: new Date(),
    };
    this.comparison.set(key, created);
    return { ...created };
  }

  async removeComparison(customerId: string, productId: string): Promise<void> {
    this.comparison.delete(`${customerId}:${productId}`);
  }

  async clearComparison(customerId: string): Promise<void> {
    for (const [key, item] of this.comparison) {
      if (item.customerId === customerId) {
        this.comparison.delete(key);
      }
    }
  }

  async trackRecentlyViewed(input: {
    customerId?: string;
    guestTokenHash?: string;
    productId: string;
    maxItems: number;
  }): Promise<RecentlyViewedItem[]> {
    const ownerKey = input.customerId
      ? `c:${input.customerId}`
      : `g:${input.guestTokenHash ?? ''}`;
    const key = `${ownerKey}:${input.productId}`;
    const existing = this.recentlyViewed.get(key);
    const now = new Date();
    if (existing) {
      existing.viewedAt = now;
    } else {
      this.recentlyViewed.set(key, {
        id: createId(),
        customerId: input.customerId,
        guestTokenHash: input.guestTokenHash,
        productId: input.productId,
        viewedAt: now,
      });
    }
    const list = await this.listRecentlyViewed({
      customerId: input.customerId,
      guestTokenHash: input.guestTokenHash,
      limit: 1000,
    });
    if (list.length > input.maxItems) {
      const toRemove = list.slice(input.maxItems);
      for (const item of toRemove) {
        const removeKey = `${ownerKey}:${item.productId}`;
        this.recentlyViewed.delete(removeKey);
      }
    }
    return this.listRecentlyViewed({
      customerId: input.customerId,
      guestTokenHash: input.guestTokenHash,
      limit: input.maxItems,
    });
  }

  async listRecentlyViewed(input: {
    customerId?: string;
    guestTokenHash?: string;
    limit: number;
  }): Promise<RecentlyViewedItem[]> {
    return [...this.recentlyViewed.values()]
      .filter((item) =>
        input.customerId
          ? item.customerId === input.customerId
          : item.guestTokenHash === input.guestTokenHash,
      )
      .sort((a, b) => b.viewedAt.getTime() - a.viewedAt.getTime())
      .slice(0, input.limit)
      .map((item) => ({ ...item, viewedAt: new Date(item.viewedAt) }));
  }
}
