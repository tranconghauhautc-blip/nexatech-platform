import {
  CART_GUEST_TTL_DAYS,
  CART_ITEM_MAX_QUANTITY,
  COMPARISON_MAX_ITEMS,
  RECENTLY_VIEWED_MAX_ITEMS,
  WISHLIST_MAX_ITEMS,
  addCartItemRequestSchema,
  mergeCartRequestSchema,
  updateCartItemRequestSchema,
  type AddCartItemRequest,
  type CartDto,
  type CartItemDto,
  type CartValidateResponse,
  type CartValidationIssue,
  type MergeCartRequest,
  type UpdateCartItemRequest,
} from '@nexatech/shared-contracts';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import { EventTypes, createEventEnvelope } from '@nexatech/shared-events';
import { createTraceId } from '@nexatech/shared-platform';
import { ZodError } from 'zod';
import type { CatalogClient } from './catalog.client';
import type { CartRepository } from './cart.repository';
import type { Cart, CartItem, CatalogSkuInfo } from './cart.types';
import type { CartEventPublisher } from './event-publisher';
import type { InventoryClient } from './inventory.client';
import {
  generateCartToken,
  hashCartToken,
  type CartRedisStore,
} from './redis.store';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const LOCK_TTL_SECONDS = 5;
const MAX_OPTIMISTIC_RETRIES = 3;

function parseOrThrow<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Dữ liệu không hợp lệ',
        details: { issues: error.issues },
      });
    }
    throw error;
  }
}

export interface CartActor {
  userId?: string;
  customerId?: string;
  guestCartToken?: string;
}

export class CartService {
  constructor(
    private readonly repository: CartRepository,
    private readonly catalog: CatalogClient,
    private readonly inventory: InventoryClient,
    private readonly redis: CartRedisStore,
    private readonly publisher: CartEventPublisher,
  ) {}

  async createGuestCart(): Promise<CartDto> {
    const token = generateCartToken();
    const tokenHash = hashCartToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CART_GUEST_TTL_DAYS);
    const cart = await this.repository.createGuestCart({
      guestTokenHash: tokenHash,
      expiresAt,
    });
    const ttlSeconds = CART_GUEST_TTL_DAYS * 24 * 60 * 60;
    await this.redis.setGuestTokenMeta(tokenHash, cart.id, ttlSeconds);
    await this.repository.writeAudit('cart.guest.created', 'guest', {
      cartId: cart.id,
    });
    await this.publisher.publish(
      createEventEnvelope({
        eventType: EventTypes.CART_CREATED,
        producer: 'cart-service',
        traceId: createTraceId(),
        payload: {
          cartId: cart.id,
          ownerType: 'GUEST',
        },
      }),
    );
    return this.toDto(cart, { guestCartToken: token });
  }

  async getCurrentCart(actor: CartActor): Promise<CartDto> {
    const cart = await this.resolveActiveCart(actor, { createIfMissing: true });
    return this.toDto(cart, {
      guestCartToken: actor.guestCartToken,
    });
  }

  async addItem(actor: CartActor, raw: AddCartItemRequest): Promise<CartDto> {
    const input = parseOrThrow(() => addCartItemRequestSchema.parse(raw));
    return this.withIdempotency(
      input.idempotencyKey,
      'cart.addItem',
      async () => {
        return this.withCartLock(actor, async () => {
          return this.retryOptimistic(async () => {
            const cart = await this.resolveActiveCart(actor, {
              createIfMissing: true,
            });
            this.assertCartWritable(cart);
            const sku = await this.requireSellableSku(input.skuCode);
            const existing = cart.items.find((i) => i.skuId === sku.skuId);
            const nextQty = (existing?.quantity ?? 0) + input.quantity;
            this.assertQuantity(nextQty);
            await this.precheckInventory(sku.skuCode, nextQty, input.city);

            const updated = await this.repository.upsertItem({
              cartId: cart.id,
              expectedVersion: cart.version,
              skuId: sku.skuId,
              skuCode: sku.skuCode,
              quantity: input.quantity,
              unitPriceSnapshot: sku.unitPrice,
              currency: sku.currency,
              productId: sku.productId,
              productName: sku.productName,
              productSlug: sku.productSlug,
              skuName: sku.skuName,
              attributes: sku.attributes,
              metadata: { priceIsSnapshotOnly: true },
              mode: 'add',
            });

            await this.repository.writeAudit(
              'cart.item.added',
              actor.customerId ?? actor.userId ?? 'guest',
              {
                cartId: cart.id,
                skuId: sku.skuId,
                quantity: input.quantity,
              },
            );
            await this.publisher.publish(
              createEventEnvelope({
                eventType: EventTypes.CART_ITEM_ADDED,
                producer: 'cart-service',
                traceId: createTraceId(),
                payload: {
                  cartId: cart.id,
                  skuId: sku.skuId,
                  skuCode: sku.skuCode,
                  quantity: input.quantity,
                },
              }),
            );
            return this.toDto(updated, {
              guestCartToken: actor.guestCartToken,
            });
          });
        });
      },
    );
  }

  async updateItem(
    actor: CartActor,
    skuId: string,
    raw: UpdateCartItemRequest,
  ): Promise<CartDto> {
    const input = parseOrThrow(() => updateCartItemRequestSchema.parse(raw));
    return this.withIdempotency(
      input.idempotencyKey,
      'cart.updateItem',
      async () => {
        return this.withCartLock(actor, async () => {
          return this.retryOptimistic(async () => {
            const cart = await this.resolveActiveCart(actor);
            this.assertCartWritable(cart);
            const item = cart.items.find((i) => i.skuId === skuId);
            if (!item) {
              throw new AppError({
                errorCode: ErrorCodes.CART_ITEM_NOT_FOUND,
                message: 'Không tìm thấy sản phẩm trong giỏ hàng',
                details: { skuId },
              });
            }
            this.assertQuantity(input.quantity);
            const sku = await this.requireSellableSku(item.skuCode);
            await this.precheckInventory(
              sku.skuCode,
              input.quantity,
              input.city,
            );

            const updated = await this.repository.upsertItem({
              cartId: cart.id,
              expectedVersion: cart.version,
              skuId: item.skuId,
              skuCode: item.skuCode,
              quantity: input.quantity,
              unitPriceSnapshot: sku.unitPrice,
              currency: sku.currency,
              productId: sku.productId,
              productName: sku.productName,
              productSlug: sku.productSlug,
              skuName: sku.skuName,
              attributes: sku.attributes,
              metadata: { priceIsSnapshotOnly: true },
              mode: 'replace',
            });

            await this.repository.writeAudit(
              'cart.item.updated',
              actor.customerId ?? actor.userId ?? 'guest',
              { cartId: cart.id, skuId, quantity: input.quantity },
            );
            await this.publisher.publish(
              createEventEnvelope({
                eventType: EventTypes.CART_ITEM_UPDATED,
                producer: 'cart-service',
                traceId: createTraceId(),
                payload: {
                  cartId: cart.id,
                  skuId,
                  quantity: input.quantity,
                },
              }),
            );
            return this.toDto(updated, {
              guestCartToken: actor.guestCartToken,
            });
          });
        });
      },
    );
  }

  async removeItem(actor: CartActor, skuId: string): Promise<CartDto> {
    return this.withCartLock(actor, async () => {
      return this.retryOptimistic(async () => {
        const cart = await this.resolveActiveCart(actor);
        this.assertCartWritable(cart);
        const updated = await this.repository.removeItem({
          cartId: cart.id,
          expectedVersion: cart.version,
          skuId,
        });
        await this.repository.writeAudit(
          'cart.item.removed',
          actor.customerId ?? actor.userId ?? 'guest',
          { cartId: cart.id, skuId },
        );
        await this.publisher.publish(
          createEventEnvelope({
            eventType: EventTypes.CART_ITEM_REMOVED,
            producer: 'cart-service',
            traceId: createTraceId(),
            payload: { cartId: cart.id, skuId },
          }),
        );
        return this.toDto(updated, {
          guestCartToken: actor.guestCartToken,
        });
      });
    });
  }

  async clearCart(actor: CartActor): Promise<CartDto> {
    return this.withCartLock(actor, async () => {
      return this.retryOptimistic(async () => {
        const cart = await this.resolveActiveCart(actor);
        this.assertCartWritable(cart);
        const updated = await this.repository.clearItems({
          cartId: cart.id,
          expectedVersion: cart.version,
        });
        await this.repository.writeAudit(
          'cart.cleared',
          actor.customerId ?? actor.userId ?? 'guest',
          { cartId: cart.id },
        );
        return this.toDto(updated, {
          guestCartToken: actor.guestCartToken,
        });
      });
    });
  }

  async mergeCart(actor: CartActor, raw: MergeCartRequest): Promise<CartDto> {
    const customerId = actor.customerId ?? actor.userId;
    if (!customerId) {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Cần đăng nhập để gộp giỏ hàng',
      });
    }
    const input = parseOrThrow(() => mergeCartRequestSchema.parse(raw));
    const idemKey =
      input.idempotencyKey ??
      `merge:${customerId}:${hashCartToken(input.guestCartToken)}`;

    return this.withIdempotency(idemKey, 'cart.merge', async () => {
      return this.retryOptimistic(async () => {
        const guestHash = hashCartToken(input.guestCartToken);
        const guestCart =
          await this.repository.getActiveCartByGuestTokenHash(guestHash);
        if (!guestCart) {
          throw new AppError({
            errorCode: ErrorCodes.CART_MERGE_INVALID,
            message: 'Không tìm thấy giỏ hàng khách để gộp',
          });
        }

        let customerCart =
          await this.repository.getActiveCartByCustomerId(customerId);
        if (!customerCart) {
          customerCart = await this.repository.createCustomerCart({
            customerId,
          });
        }

        const merged = this.mergeItems(customerCart.items, guestCart.items);
        for (const item of merged) {
          this.assertQuantity(item.quantity);
        }

        const updated = await this.repository.replaceItems(
          customerCart.id,
          customerCart.version,
          merged,
        );

        await this.repository.updateStatus({
          cartId: guestCart.id,
          expectedVersion: guestCart.version,
          status: 'CONVERTED',
        });
        await this.redis.deleteGuestTokenMeta(guestHash);

        await this.repository.writeAudit('cart.merged', customerId, {
          customerCartId: customerCart.id,
          guestCartId: guestCart.id,
          itemCount: merged.length,
        });
        await this.publisher.publish(
          createEventEnvelope({
            eventType: EventTypes.CART_MERGED,
            producer: 'cart-service',
            traceId: createTraceId(),
            payload: {
              customerCartId: customerCart.id,
              guestCartId: guestCart.id,
              customerId,
            },
          }),
        );
        await this.publisher.publish(
          createEventEnvelope({
            eventType: EventTypes.CART_CONVERTED,
            producer: 'cart-service',
            traceId: createTraceId(),
            payload: {
              cartId: guestCart.id,
              customerCartId: customerCart.id,
            },
          }),
        );

        return this.toDto(updated);
      });
    });
  }

  async refreshCart(actor: CartActor): Promise<CartDto> {
    return this.withCartLock(actor, async () => {
      return this.retryOptimistic(async () => {
        const cart = await this.resolveActiveCart(actor);
        this.assertCartWritable(cart);
        const refreshed: Array<
          Omit<CartItem, 'id' | 'cartId' | 'createdAt' | 'updatedAt'>
        > = [];

        for (const item of cart.items) {
          const sku = await this.catalog.getSkuByCode(item.skuCode);
          if (!sku || !sku.isSellable) {
            continue;
          }
          refreshed.push({
            skuId: sku.skuId,
            skuCode: sku.skuCode,
            quantity: Math.min(item.quantity, CART_ITEM_MAX_QUANTITY),
            unitPriceSnapshot: sku.unitPrice,
            currency: sku.currency,
            productId: sku.productId,
            productName: sku.productName,
            productSlug: sku.productSlug,
            skuName: sku.skuName,
            attributes: sku.attributes,
            metadata: {
              priceIsSnapshotOnly: true,
              refreshedAt: new Date().toISOString(),
            },
          });
        }

        const updated = await this.repository.replaceItems(
          cart.id,
          cart.version,
          refreshed,
        );
        return this.toDto(updated, {
          guestCartToken: actor.guestCartToken,
        });
      });
    });
  }

  async validateCart(
    actor: CartActor,
    city?: string,
  ): Promise<CartValidateResponse> {
    const cart = await this.resolveActiveCart(actor);
    const issues: CartValidationIssue[] = [];
    const itemDtos: CartItemDto[] = [];

    for (const item of cart.items) {
      const sku = await this.catalog.getSkuByCode(item.skuCode);
      if (!sku) {
        issues.push({
          skuId: item.skuId,
          skuCode: item.skuCode,
          code: 'SKU_NOT_FOUND',
          message: 'SKU không còn tồn tại',
        });
        itemDtos.push(this.toItemDto(item, undefined, false));
        continue;
      }
      if (!sku.isSellable) {
        issues.push({
          skuId: item.skuId,
          skuCode: item.skuCode,
          code: 'PRODUCT_NOT_SELLABLE',
          message: 'Sản phẩm không còn được bán',
        });
      }
      if (sku.unitPrice !== item.unitPriceSnapshot) {
        issues.push({
          skuId: item.skuId,
          skuCode: item.skuCode,
          code: 'PRICE_CHANGED',
          message: 'Giá sản phẩm đã thay đổi',
        });
      }
      if (item.quantity > CART_ITEM_MAX_QUANTITY) {
        issues.push({
          skuId: item.skuId,
          skuCode: item.skuCode,
          code: 'QUANTITY_LIMIT',
          message: `Số lượng vượt giới hạn ${CART_ITEM_MAX_QUANTITY}`,
        });
      }

      let available = true;
      try {
        const stock = await this.inventory.checkAvailability(
          item.skuCode,
          item.quantity,
          city,
        );
        available = stock.available;
        if (!stock.available) {
          issues.push({
            skuId: item.skuId,
            skuCode: item.skuCode,
            code: 'INSUFFICIENT_STOCK',
            message: 'Không đủ tồn kho khả dụng',
          });
        }
      } catch {
        issues.push({
          skuId: item.skuId,
          skuCode: item.skuCode,
          code: 'INSUFFICIENT_STOCK',
          message: 'Không kiểm tra được tồn kho',
        });
        available = false;
      }

      itemDtos.push(this.toItemDto(item, sku, available));
    }

    const dto = this.toDtoFromParts(cart, itemDtos, {
      guestCartToken: actor.guestCartToken,
    });

    return {
      cart: dto,
      valid: issues.length === 0,
      issues,
      reservationPreview: cart.items.map((item) => ({
        skuCode: item.skuCode,
        quantity: item.quantity,
      })),
    };
  }

  async cleanupExpiredCarts(now = new Date()): Promise<number> {
    const expired = await this.repository.listExpiredActiveCarts(now);
    let count = 0;
    for (const cart of expired) {
      try {
        await this.repository.updateStatus({
          cartId: cart.id,
          expectedVersion: cart.version,
          status: 'EXPIRED',
        });
        if (cart.guestTokenHash) {
          await this.redis.deleteGuestTokenMeta(cart.guestTokenHash);
        }
        await this.publisher.publish(
          createEventEnvelope({
            eventType: EventTypes.CART_EXPIRED,
            producer: 'cart-service',
            traceId: createTraceId(),
            payload: { cartId: cart.id },
          }),
        );
        count += 1;
      } catch {
        // skip conflicted carts; next cleanup will retry
      }
    }
    return count;
  }

  async listWishlist(customerId: string) {
    return this.repository.listWishlist(customerId);
  }

  async addWishlist(customerId: string, productId: string, skuId?: string) {
    const current = await this.repository.listWishlist(customerId);
    if (
      current.length >= WISHLIST_MAX_ITEMS &&
      !current.some((i) => i.productId === productId)
    ) {
      throw new AppError({
        errorCode: ErrorCodes.WISHLIST_LIMIT,
        message: `Wishlist tối đa ${WISHLIST_MAX_ITEMS} sản phẩm`,
      });
    }
    return this.repository.addWishlist({ customerId, productId, skuId });
  }

  async removeWishlist(customerId: string, productId: string) {
    await this.repository.removeWishlist(customerId, productId);
  }

  async listComparison(customerId: string) {
    return this.repository.listComparison(customerId);
  }

  async addComparison(customerId: string, productId: string) {
    const current = await this.repository.listComparison(customerId);
    if (
      current.length >= COMPARISON_MAX_ITEMS &&
      !current.some((i) => i.productId === productId)
    ) {
      throw new AppError({
        errorCode: ErrorCodes.COMPARISON_LIMIT,
        message: `So sánh tối đa ${COMPARISON_MAX_ITEMS} sản phẩm`,
      });
    }
    return this.repository.addComparison(customerId, productId);
  }

  async removeComparison(customerId: string, productId: string) {
    await this.repository.removeComparison(customerId, productId);
  }

  async clearComparison(customerId: string) {
    await this.repository.clearComparison(customerId);
  }

  async trackRecentlyViewed(actor: CartActor, productId: string) {
    const customerId = actor.customerId ?? actor.userId;
    const guestTokenHash = actor.guestCartToken
      ? hashCartToken(actor.guestCartToken)
      : undefined;
    if (!customerId && !guestTokenHash) {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Cần đăng nhập hoặc cart token để lưu lịch sử xem',
      });
    }
    return this.repository.trackRecentlyViewed({
      customerId,
      guestTokenHash,
      productId,
      maxItems: RECENTLY_VIEWED_MAX_ITEMS,
    });
  }

  async listRecentlyViewed(actor: CartActor) {
    const customerId = actor.customerId ?? actor.userId;
    const guestTokenHash = actor.guestCartToken
      ? hashCartToken(actor.guestCartToken)
      : undefined;
    return this.repository.listRecentlyViewed({
      customerId,
      guestTokenHash,
      limit: RECENTLY_VIEWED_MAX_ITEMS,
    });
  }

  private mergeItems(
    customerItems: CartItem[],
    guestItems: CartItem[],
  ): Array<Omit<CartItem, 'id' | 'cartId' | 'createdAt' | 'updatedAt'>> {
    const map = new Map<
      string,
      Omit<CartItem, 'id' | 'cartId' | 'createdAt' | 'updatedAt'>
    >();
    for (const item of customerItems) {
      map.set(item.skuId, {
        skuId: item.skuId,
        skuCode: item.skuCode,
        quantity: item.quantity,
        unitPriceSnapshot: item.unitPriceSnapshot,
        currency: item.currency,
        productId: item.productId,
        productName: item.productName,
        productSlug: item.productSlug,
        skuName: item.skuName,
        attributes: { ...item.attributes },
        metadata: item.metadata,
      });
    }
    for (const item of guestItems) {
      const existing = map.get(item.skuId);
      if (existing) {
        existing.quantity = Math.min(
          existing.quantity + item.quantity,
          CART_ITEM_MAX_QUANTITY,
        );
      } else {
        map.set(item.skuId, {
          skuId: item.skuId,
          skuCode: item.skuCode,
          quantity: Math.min(item.quantity, CART_ITEM_MAX_QUANTITY),
          unitPriceSnapshot: item.unitPriceSnapshot,
          currency: item.currency,
          productId: item.productId,
          productName: item.productName,
          productSlug: item.productSlug,
          skuName: item.skuName,
          attributes: { ...item.attributes },
          metadata: item.metadata,
        });
      }
    }
    return [...map.values()];
  }

  private async resolveActiveCart(
    actor: CartActor,
    options?: { createIfMissing?: boolean },
  ): Promise<Cart> {
    const customerId = actor.customerId ?? actor.userId;
    if (customerId) {
      let cart = await this.repository.getActiveCartByCustomerId(customerId);
      if (!cart && options?.createIfMissing) {
        cart = await this.repository.createCustomerCart({ customerId });
        await this.publisher.publish(
          createEventEnvelope({
            eventType: EventTypes.CART_CREATED,
            producer: 'cart-service',
            traceId: createTraceId(),
            payload: {
              cartId: cart.id,
              ownerType: 'CUSTOMER',
              customerId,
            },
          }),
        );
      }
      if (!cart) {
        throw new AppError({
          errorCode: ErrorCodes.CART_NOT_FOUND,
          message: 'Không tìm thấy giỏ hàng',
        });
      }
      this.assertOwnership(cart, actor);
      this.assertNotExpired(cart);
      return cart;
    }

    if (!actor.guestCartToken) {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Thiếu cart token hoặc thông tin đăng nhập',
      });
    }
    const tokenHash = hashCartToken(actor.guestCartToken);
    const cart = await this.repository.getActiveCartByGuestTokenHash(tokenHash);
    if (!cart) {
      throw new AppError({
        errorCode: ErrorCodes.CART_NOT_FOUND,
        message: 'Không tìm thấy giỏ hàng khách',
      });
    }
    this.assertOwnership(cart, actor);
    this.assertNotExpired(cart);
    return cart;
  }

  private assertOwnership(cart: Cart, actor: CartActor): void {
    const customerId = actor.customerId ?? actor.userId;
    if (cart.ownerType === 'CUSTOMER') {
      if (!customerId || cart.customerId !== customerId) {
        throw new AppError({
          errorCode: ErrorCodes.CART_FORBIDDEN,
          message: 'Không có quyền truy cập giỏ hàng này',
        });
      }
      return;
    }
    if (!actor.guestCartToken) {
      throw new AppError({
        errorCode: ErrorCodes.CART_FORBIDDEN,
        message: 'Không có quyền truy cập giỏ hàng khách',
      });
    }
    if (cart.guestTokenHash !== hashCartToken(actor.guestCartToken)) {
      throw new AppError({
        errorCode: ErrorCodes.CART_FORBIDDEN,
        message: 'Cart token không hợp lệ',
      });
    }
  }

  private assertCartWritable(cart: Cart): void {
    if (cart.status !== 'ACTIVE') {
      throw new AppError({
        errorCode: ErrorCodes.CART_EXPIRED,
        message: 'Giỏ hàng không còn hiệu lực',
        details: { status: cart.status },
      });
    }
    this.assertNotExpired(cart);
  }

  private assertNotExpired(cart: Cart): void {
    if (cart.expiresAt && cart.expiresAt.getTime() <= Date.now()) {
      throw new AppError({
        errorCode: ErrorCodes.CART_EXPIRED,
        message: 'Giỏ hàng đã hết hạn',
      });
    }
  }

  private assertQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError({
        errorCode: ErrorCodes.CART_QUANTITY_INVALID,
        message: 'Số lượng phải là số nguyên dương',
        details: { quantity },
      });
    }
    if (quantity > CART_ITEM_MAX_QUANTITY) {
      throw new AppError({
        errorCode: ErrorCodes.CART_QUANTITY_LIMIT,
        message: `Số lượng tối đa mỗi sản phẩm là ${CART_ITEM_MAX_QUANTITY}`,
        details: { quantity, max: CART_ITEM_MAX_QUANTITY },
      });
    }
  }

  private async requireSellableSku(skuCode: string): Promise<CatalogSkuInfo> {
    let sku: CatalogSkuInfo | null;
    try {
      sku = await this.catalog.getSkuByCode(skuCode);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError({
        errorCode: ErrorCodes.CART_CATALOG_UNAVAILABLE,
        message: 'Không thể lấy thông tin SKU từ catalog-service',
      });
    }
    if (!sku) {
      throw new AppError({
        errorCode: ErrorCodes.CART_SKU_UNAVAILABLE,
        message: 'SKU không tồn tại',
        details: { skuCode },
      });
    }
    if (!sku.isSellable) {
      throw new AppError({
        errorCode: ErrorCodes.CART_SKU_UNAVAILABLE,
        message: 'SKU không còn khả dụng để bán',
        details: {
          skuCode,
          productStatus: sku.productStatus,
          unitPrice: sku.unitPrice,
        },
      });
    }
    return sku;
  }

  private async precheckInventory(
    skuCode: string,
    quantity: number,
    city?: string,
  ): Promise<void> {
    try {
      const result = await this.inventory.checkAvailability(
        skuCode,
        quantity,
        city,
      );
      if (!result.available) {
        throw new AppError({
          errorCode: ErrorCodes.CART_SKU_UNAVAILABLE,
          message: 'Không đủ tồn kho khả dụng',
          details: {
            skuCode,
            quantity,
            totalAvailable: result.totalAvailable,
          },
        });
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError({
        errorCode: ErrorCodes.CART_INVENTORY_UNAVAILABLE,
        message: 'Không thể kiểm tra tồn kho',
      });
    }
  }

  private async withIdempotency<T>(
    key: string | undefined,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!key) {
      return fn();
    }

    const cachedRedis = await this.redis.getIdempotency(key);
    if (cachedRedis !== null) {
      return cachedRedis as T;
    }
    const cachedDb = await this.repository.findIdempotency(key);
    if (cachedDb) {
      if (cachedDb.operation !== operation) {
        throw new AppError({
          errorCode: ErrorCodes.CART_IDEMPOTENCY_CONFLICT,
          message: 'Idempotency key đã dùng cho thao tác khác',
        });
      }
      return cachedDb.responseJson as T;
    }

    const result = await fn();
    const stored = await this.redis.setIdempotency(
      key,
      result,
      IDEMPOTENCY_TTL_SECONDS,
    );
    if (!stored) {
      const again = await this.redis.getIdempotency(key);
      if (again !== null) {
        return again as T;
      }
    }
    try {
      await this.repository.saveIdempotency(key, operation, result);
    } catch {
      const again = await this.repository.findIdempotency(key);
      if (again) {
        return again.responseJson as T;
      }
    }
    return result;
  }

  private async withCartLock<T>(
    actor: CartActor,
    fn: () => Promise<T>,
  ): Promise<T> {
    const lockKey = this.lockKeyFor(actor);
    let token: string | null = null;
    for (let i = 0; i < 5; i++) {
      token = await this.redis.acquireLock(lockKey, LOCK_TTL_SECONDS);
      if (token) {
        break;
      }
      await new Promise((r) => setTimeout(r, 20 * (i + 1)));
    }
    if (!token) {
      throw new AppError({
        errorCode: ErrorCodes.CART_CONFLICT,
        message: 'Giỏ hàng đang được cập nhật, thử lại sau',
      });
    }
    try {
      return await fn();
    } finally {
      await this.redis.releaseLock(lockKey, token);
    }
  }

  private lockKeyFor(actor: CartActor): string {
    const customerId = actor.customerId ?? actor.userId;
    if (customerId) {
      return `customer:${customerId}`;
    }
    return `guest:${hashCartToken(actor.guestCartToken ?? 'unknown')}`;
  }

  private async retryOptimistic<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (
          error instanceof AppError &&
          error.errorCode === ErrorCodes.CART_CONFLICT &&
          attempt < MAX_OPTIMISTIC_RETRIES - 1
        ) {
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  private toDto(cart: Cart, extras?: { guestCartToken?: string }): CartDto {
    const items = cart.items.map((item) => this.toItemDto(item));
    return this.toDtoFromParts(cart, items, extras);
  }

  private toDtoFromParts(
    cart: Cart,
    items: CartItemDto[],
    extras?: { guestCartToken?: string },
  ): CartDto {
    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.lineSubtotal, 0);
    return {
      id: cart.id,
      ownerType: cart.ownerType,
      customerId: cart.customerId,
      status: cart.status,
      version: cart.version,
      itemCount: items.length,
      totalQuantity,
      subtotal,
      currency: items[0]?.currency ?? 'VND',
      expiresAt: cart.expiresAt?.toISOString(),
      createdAt: cart.createdAt.toISOString(),
      updatedAt: cart.updatedAt.toISOString(),
      items,
      guestCartToken: extras?.guestCartToken,
    };
  }

  private toItemDto(
    item: CartItem,
    sku?: CatalogSkuInfo,
    available?: boolean,
  ): CartItemDto {
    const currentUnitPrice = sku?.unitPrice;
    return {
      id: item.id,
      skuId: item.skuId,
      skuCode: item.skuCode,
      quantity: item.quantity,
      unitPriceSnapshot: item.unitPriceSnapshot,
      currentUnitPrice,
      priceChanged:
        currentUnitPrice !== undefined &&
        currentUnitPrice !== item.unitPriceSnapshot,
      currency: item.currency,
      productId: item.productId,
      productName: item.productName,
      productSlug: item.productSlug,
      skuName: item.skuName,
      attributes: item.attributes,
      available,
      lineSubtotal: item.unitPriceSnapshot * item.quantity,
    };
  }
}
