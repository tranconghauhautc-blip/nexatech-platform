import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import { createId } from '@nexatech/shared-platform';
import type { Prisma } from '../../generated/prisma';
import type { CartRepository } from './cart.repository';
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
import { PrismaService } from './prisma.service';

type PrismaCartWithItems = Prisma.CartGetPayload<{ include: { items: true } }>;

function mapItem(row: PrismaCartWithItems['items'][number]): CartItem {
  return {
    id: row.id,
    cartId: row.cartId,
    skuId: row.skuId,
    skuCode: row.skuCode,
    quantity: row.quantity,
    unitPriceSnapshot: row.unitPriceSnapshot,
    currency: row.currency,
    productId: row.productId,
    productName: row.productName,
    productSlug: row.productSlug,
    skuName: row.skuName,
    attributes: (row.attributesJson as Record<string, string>) ?? {},
    metadata: (row.metadataJson as Record<string, unknown> | null) ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCart(row: PrismaCartWithItems): Cart {
  return {
    id: row.id,
    ownerType: row.ownerType,
    customerId: row.customerId ?? undefined,
    guestTokenHash: row.guestTokenHash ?? undefined,
    status: row.status,
    version: row.version,
    expiresAt: row.expiresAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: row.items.map(mapItem),
  };
}

export class PrismaCartRepository implements CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async getCartRow(id: string): Promise<PrismaCartWithItems | null> {
    return this.prisma.cart.findUnique({
      where: { id },
      include: { items: true },
    });
  }

  async createGuestCart(input: CreateGuestCartInput): Promise<Cart> {
    const row = await this.prisma.cart.create({
      data: {
        id: createId(),
        ownerType: 'GUEST',
        guestTokenHash: input.guestTokenHash,
        status: 'ACTIVE',
        expiresAt: input.expiresAt,
      },
      include: { items: true },
    });
    return mapCart(row);
  }

  async createCustomerCart(input: CreateCustomerCartInput): Promise<Cart> {
    const existing = await this.getActiveCartByCustomerId(input.customerId);
    if (existing) {
      return existing;
    }
    try {
      const row = await this.prisma.cart.create({
        data: {
          id: createId(),
          ownerType: 'CUSTOMER',
          customerId: input.customerId,
          status: 'ACTIVE',
        },
        include: { items: true },
      });
      return mapCart(row);
    } catch {
      const again = await this.getActiveCartByCustomerId(input.customerId);
      if (again) {
        return again;
      }
      throw new AppError({
        errorCode: ErrorCodes.CART_CONFLICT,
        message: 'Không thể tạo giỏ hàng khách hàng',
      });
    }
  }

  async getCartById(id: string): Promise<Cart | null> {
    const row = await this.getCartRow(id);
    return row ? mapCart(row) : null;
  }

  async getActiveCartByCustomerId(customerId: string): Promise<Cart | null> {
    const row = await this.prisma.cart.findFirst({
      where: { customerId, status: 'ACTIVE', ownerType: 'CUSTOMER' },
      include: { items: true },
    });
    return row ? mapCart(row) : null;
  }

  async getActiveCartByGuestTokenHash(tokenHash: string): Promise<Cart | null> {
    const row = await this.prisma.cart.findFirst({
      where: {
        guestTokenHash: tokenHash,
        status: 'ACTIVE',
        ownerType: 'GUEST',
      },
      include: { items: true },
    });
    return row ? mapCart(row) : null;
  }

  async upsertItem(input: UpsertCartItemInput): Promise<Cart> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cart.updateMany({
        where: {
          id: input.cartId,
          version: input.expectedVersion,
          status: 'ACTIVE',
        },
        data: {
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new AppError({
          errorCode: ErrorCodes.CART_CONFLICT,
          message: 'Giỏ hàng đã được cập nhật bởi thao tác khác',
        });
      }

      const existing = await tx.cartItem.findUnique({
        where: {
          cartId_skuId: { cartId: input.cartId, skuId: input.skuId },
        },
      });

      const quantity =
        existing && input.mode === 'add'
          ? existing.quantity + input.quantity
          : input.quantity;

      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity,
            unitPriceSnapshot: input.unitPriceSnapshot,
            currency: input.currency,
            productName: input.productName,
            productSlug: input.productSlug,
            skuName: input.skuName,
            attributesJson: input.attributes,
            metadataJson: (input.metadata ?? undefined) as
              | Prisma.InputJsonValue
              | undefined,
          },
        });
      } else {
        await tx.cartItem.create({
          data: {
            id: createId(),
            cartId: input.cartId,
            skuId: input.skuId,
            skuCode: input.skuCode,
            quantity,
            unitPriceSnapshot: input.unitPriceSnapshot,
            currency: input.currency,
            productId: input.productId,
            productName: input.productName,
            productSlug: input.productSlug,
            skuName: input.skuName,
            attributesJson: input.attributes,
            metadataJson: (input.metadata ?? undefined) as
              | Prisma.InputJsonValue
              | undefined,
          },
        });
      }

      const row = await tx.cart.findUniqueOrThrow({
        where: { id: input.cartId },
        include: { items: true },
      });
      return mapCart(row);
    });
  }

  async removeItem(input: RemoveCartItemInput): Promise<Cart> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findUnique({
        where: {
          cartId_skuId: { cartId: input.cartId, skuId: input.skuId },
        },
      });
      if (!existing) {
        throw new AppError({
          errorCode: ErrorCodes.CART_ITEM_NOT_FOUND,
          message: 'Không tìm thấy sản phẩm trong giỏ hàng',
          details: { skuId: input.skuId },
        });
      }

      const updated = await tx.cart.updateMany({
        where: {
          id: input.cartId,
          version: input.expectedVersion,
          status: 'ACTIVE',
        },
        data: {
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new AppError({
          errorCode: ErrorCodes.CART_CONFLICT,
          message: 'Giỏ hàng đã được cập nhật bởi thao tác khác',
        });
      }

      await tx.cartItem.delete({ where: { id: existing.id } });
      const row = await tx.cart.findUniqueOrThrow({
        where: { id: input.cartId },
        include: { items: true },
      });
      return mapCart(row);
    });
  }

  async clearItems(input: ClearCartInput): Promise<Cart> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cart.updateMany({
        where: {
          id: input.cartId,
          version: input.expectedVersion,
          status: 'ACTIVE',
        },
        data: {
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new AppError({
          errorCode: ErrorCodes.CART_CONFLICT,
          message: 'Giỏ hàng đã được cập nhật bởi thao tác khác',
        });
      }
      await tx.cartItem.deleteMany({ where: { cartId: input.cartId } });
      const row = await tx.cart.findUniqueOrThrow({
        where: { id: input.cartId },
        include: { items: true },
      });
      return mapCart(row);
    });
  }

  async updateStatus(input: UpdateCartStatusInput): Promise<Cart> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cart.updateMany({
        where: { id: input.cartId, version: input.expectedVersion },
        data: {
          status: input.status,
          expiresAt:
            input.expiresAt === undefined ? undefined : input.expiresAt,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new AppError({
          errorCode: ErrorCodes.CART_CONFLICT,
          message: 'Giỏ hàng đã được cập nhật bởi thao tác khác',
        });
      }
      const row = await tx.cart.findUniqueOrThrow({
        where: { id: input.cartId },
        include: { items: true },
      });
      return mapCart(row);
    });
  }

  async replaceItems(
    cartId: string,
    expectedVersion: number,
    items: Array<Omit<CartItem, 'id' | 'cartId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Cart> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cart.updateMany({
        where: { id: cartId, version: expectedVersion, status: 'ACTIVE' },
        data: {
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new AppError({
          errorCode: ErrorCodes.CART_CONFLICT,
          message: 'Giỏ hàng đã được cập nhật bởi thao tác khác',
        });
      }
      await tx.cartItem.deleteMany({ where: { cartId } });
      if (items.length > 0) {
        await tx.cartItem.createMany({
          data: items.map((item) => ({
            id: createId(),
            cartId,
            skuId: item.skuId,
            skuCode: item.skuCode,
            quantity: item.quantity,
            unitPriceSnapshot: item.unitPriceSnapshot,
            currency: item.currency,
            productId: item.productId,
            productName: item.productName,
            productSlug: item.productSlug,
            skuName: item.skuName,
            attributesJson: item.attributes,
            metadataJson: (item.metadata ?? undefined) as
              | Prisma.InputJsonValue
              | undefined,
          })),
        });
      }
      const row = await tx.cart.findUniqueOrThrow({
        where: { id: cartId },
        include: { items: true },
      });
      return mapCart(row);
    });
  }

  async listExpiredActiveCarts(now: Date): Promise<Cart[]> {
    const rows = await this.prisma.cart.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: now },
      },
      include: { items: true },
    });
    return rows.map(mapCart);
  }

  async findIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.idempotencyRecord.findUnique({
      where: { key },
    });
    if (!row) {
      return null;
    }
    return {
      key: row.key,
      operation: row.operation,
      responseJson: row.responseJson,
      createdAt: row.createdAt,
    };
  }

  async saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void> {
    await this.prisma.idempotencyRecord.create({
      data: {
        key,
        operation,
        responseJson: response as Prisma.InputJsonValue,
      },
    });
  }

  async writeAudit(
    action: string,
    actorId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        id: createId(),
        action,
        actorId,
        details: details as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listWishlist(customerId: string): Promise<WishlistItem[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      customerId: row.customerId,
      productId: row.productId,
      skuId: row.skuId ?? undefined,
      createdAt: row.createdAt,
    }));
  }

  async addWishlist(item: {
    customerId: string;
    productId: string;
    skuId?: string;
  }): Promise<WishlistItem> {
    const row = await this.prisma.wishlistItem.upsert({
      where: {
        customerId_productId: {
          customerId: item.customerId,
          productId: item.productId,
        },
      },
      create: {
        id: createId(),
        customerId: item.customerId,
        productId: item.productId,
        skuId: item.skuId,
      },
      update: {
        skuId: item.skuId,
      },
    });
    return {
      id: row.id,
      customerId: row.customerId,
      productId: row.productId,
      skuId: row.skuId ?? undefined,
      createdAt: row.createdAt,
    };
  }

  async removeWishlist(customerId: string, productId: string): Promise<void> {
    await this.prisma.wishlistItem.deleteMany({
      where: { customerId, productId },
    });
  }

  async listComparison(customerId: string): Promise<ComparisonItem[]> {
    const rows = await this.prisma.comparisonItem.findMany({
      where: { customerId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      customerId: row.customerId,
      productId: row.productId,
      createdAt: row.createdAt,
    }));
  }

  async addComparison(
    customerId: string,
    productId: string,
  ): Promise<ComparisonItem> {
    const row = await this.prisma.comparisonItem.upsert({
      where: {
        customerId_productId: { customerId, productId },
      },
      create: {
        id: createId(),
        customerId,
        productId,
      },
      update: {},
    });
    return {
      id: row.id,
      customerId: row.customerId,
      productId: row.productId,
      createdAt: row.createdAt,
    };
  }

  async removeComparison(customerId: string, productId: string): Promise<void> {
    await this.prisma.comparisonItem.deleteMany({
      where: { customerId, productId },
    });
  }

  async clearComparison(customerId: string): Promise<void> {
    await this.prisma.comparisonItem.deleteMany({ where: { customerId } });
  }

  async trackRecentlyViewed(input: {
    customerId?: string;
    guestTokenHash?: string;
    productId: string;
    maxItems: number;
  }): Promise<RecentlyViewedItem[]> {
    const now = new Date();
    const existing = await this.prisma.recentlyViewedItem.findFirst({
      where: {
        productId: input.productId,
        customerId: input.customerId ?? null,
        guestTokenHash: input.guestTokenHash ?? null,
      },
    });
    if (existing) {
      await this.prisma.recentlyViewedItem.update({
        where: { id: existing.id },
        data: { viewedAt: now },
      });
    } else {
      await this.prisma.recentlyViewedItem.create({
        data: {
          id: createId(),
          customerId: input.customerId,
          guestTokenHash: input.guestTokenHash,
          productId: input.productId,
          viewedAt: now,
        },
      });
    }

    const list = await this.listRecentlyViewed({
      customerId: input.customerId,
      guestTokenHash: input.guestTokenHash,
      limit: 1000,
    });
    if (list.length > input.maxItems) {
      const excess = list.slice(input.maxItems);
      await this.prisma.recentlyViewedItem.deleteMany({
        where: { id: { in: excess.map((i) => i.id) } },
      });
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
    const rows = await this.prisma.recentlyViewedItem.findMany({
      where: input.customerId
        ? { customerId: input.customerId }
        : { guestTokenHash: input.guestTokenHash },
      orderBy: { viewedAt: 'desc' },
      take: input.limit,
    });
    return rows.map((row) => ({
      id: row.id,
      customerId: row.customerId ?? undefined,
      guestTokenHash: row.guestTokenHash ?? undefined,
      productId: row.productId,
      viewedAt: row.viewedAt,
    }));
  }
}
