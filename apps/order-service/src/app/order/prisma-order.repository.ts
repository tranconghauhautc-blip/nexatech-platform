import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { Prisma } from '../../generated/prisma';
import type { OrderRepository } from './order.repository';
import type {
  CreateOrderWithRelationsInput,
  IdempotencyRecord,
  ListOrdersFilter,
  ListOrdersResult,
  Order,
  OrderAddressSnapshot,
  OrderItem,
  OrderPackage,
  OrderPackageItem,
  OrderStatusHistoryEntry,
  OutboxEventInput,
  OutboxEventRecord,
  RefundContractStatus,
  UpdateOrderStatusInput,
} from './order.types';
import { PrismaService } from './prisma.service';

type PrismaOrderFull = Prisma.OrderGetPayload<{
  include: {
    items: true;
    address: true;
    packages: { include: { items: true } };
  };
}>;

const ORDER_INCLUDE = {
  items: true,
  address: true,
  packages: { include: { items: true } },
} satisfies Prisma.OrderInclude;

function mapItem(row: PrismaOrderFull['items'][number]): OrderItem {
  return {
    id: row.id,
    orderId: row.orderId,
    skuId: row.skuId,
    skuCode: row.skuCode,
    skuName: row.skuName,
    productId: row.productId,
    productName: row.productName,
    variantAttributes: (row.variantAttributes as Record<string, string>) ?? {},
    unitPrice: row.unitPrice,
    quantity: row.quantity,
    lineSubtotal: row.lineSubtotal,
    currency: row.currency,
  };
}

function mapAddress(
  row: NonNullable<PrismaOrderFull['address']>,
): OrderAddressSnapshot {
  return {
    id: row.id,
    orderId: row.orderId,
    recipientName: row.recipientName,
    recipientPhone: row.recipientPhone,
    line1: row.line1,
    line2: row.line2 ?? undefined,
    ward: row.ward ?? undefined,
    district: row.district ?? undefined,
    city: row.city,
    province: row.province ?? undefined,
    postalCode: row.postalCode ?? undefined,
    country: row.country,
    fullText: row.fullText,
  };
}

function mapPackageItem(
  row: PrismaOrderFull['packages'][number]['items'][number],
): OrderPackageItem {
  return {
    id: row.id,
    packageId: row.packageId,
    orderItemId: row.orderItemId,
    skuCode: row.skuCode,
    quantity: row.quantity,
  };
}

function mapPackage(row: PrismaOrderFull['packages'][number]): OrderPackage {
  return {
    id: row.id,
    orderId: row.orderId,
    packageCode: row.packageCode,
    status: row.status,
    sourceLocationType: row.sourceLocationType,
    sourceLocationId: row.sourceLocationId,
    shippingProvider: row.shippingProvider ?? undefined,
    trackingCode: row.trackingCode ?? undefined,
    estimatedDeliveryAt: row.estimatedDeliveryAt ?? undefined,
    items: row.items.map(mapPackageItem),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapOrder(row: PrismaOrderFull): Order {
  return {
    id: row.id,
    orderCode: row.orderCode,
    customerId: row.customerId,
    customerDisplayName: row.customerDisplayName ?? undefined,
    customerEmail: row.customerEmail ?? undefined,
    customerPhone: row.customerPhone ?? undefined,
    status: row.status,
    version: row.version,
    cartId: row.cartId,
    reservationId: row.reservationId ?? undefined,
    deliveryMethod: row.deliveryMethod,
    deliverySlot: row.deliverySlot ?? undefined,
    pickupStoreId: row.pickupStoreId ?? undefined,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    paymentReference: row.paymentReference ?? undefined,
    paidAt: row.paidAt ?? undefined,
    currency: row.currency,
    merchandiseSubtotal: row.merchandiseSubtotal,
    shippingFee: row.shippingFee,
    discountTotal: row.discountTotal,
    grandTotal: row.grandTotal,
    totalQuantity: row.totalQuantity,
    cancelReason: row.cancelReason ?? undefined,
    cancelledAt: row.cancelledAt ?? undefined,
    inventoryReleased: row.inventoryReleased,
    refundContractStatus:
      (row.refundContractStatus as RefundContractStatus | null) ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: row.items.map(mapItem),
    address: row.address ? mapAddress(row.address) : undefined,
    packages: row.packages.map(mapPackage),
  };
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrderWithRelations(
    input: CreateOrderWithRelationsInput,
  ): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          id: input.id,
          orderCode: input.orderCode,
          customerId: input.customerId,
          customerDisplayName: input.customerDisplayName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          status: input.status,
          cartId: input.cartId,
          reservationId: input.reservationId,
          deliveryMethod: input.deliveryMethod,
          deliverySlot: input.deliverySlot,
          pickupStoreId: input.pickupStoreId,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentStatus,
          currency: input.currency,
          merchandiseSubtotal: input.merchandiseSubtotal,
          shippingFee: input.shippingFee,
          discountTotal: input.discountTotal,
          grandTotal: input.grandTotal,
          totalQuantity: input.totalQuantity,
        },
      });

      const itemsWithIds = input.items.map((item) => ({
        id: createId(),
        ...item,
      }));
      const itemIdBySkuCode = new Map(
        itemsWithIds.map((item) => [item.skuCode, item.id]),
      );

      await tx.orderItem.createMany({
        data: itemsWithIds.map((item) => ({
          id: item.id,
          orderId: input.id,
          skuId: item.skuId,
          skuCode: item.skuCode,
          skuName: item.skuName,
          productId: item.productId,
          productName: item.productName,
          variantAttributes: item.variantAttributes as Prisma.InputJsonValue,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineSubtotal: item.lineSubtotal,
          currency: item.currency,
        })),
      });

      if (input.address) {
        await tx.orderAddressSnapshot.create({
          data: { id: createId(), orderId: input.id, ...input.address },
        });
      }

      const packagesWithIds = input.packages.map((pkg) => ({
        id: createId(),
        ...pkg,
      }));

      if (packagesWithIds.length > 0) {
        await tx.orderPackage.createMany({
          data: packagesWithIds.map((pkg) => ({
            id: pkg.id,
            orderId: input.id,
            packageCode: pkg.packageCode,
            status: pkg.status,
            sourceLocationType: pkg.sourceLocationType,
            sourceLocationId: pkg.sourceLocationId,
          })),
        });

        const packageItemsData = packagesWithIds.flatMap((pkg) =>
          pkg.items.map((item) => ({
            id: createId(),
            packageId: pkg.id,
            orderItemId: itemIdBySkuCode.get(item.skuCode) ?? '',
            skuCode: item.skuCode,
            quantity: item.quantity,
          })),
        );
        if (packageItemsData.length > 0) {
          await tx.orderPackageItem.createMany({ data: packageItemsData });
        }
      }

      await tx.orderStatusHistory.create({
        data: {
          id: createId(),
          orderId: input.id,
          fromStatus: undefined,
          toStatus: input.status,
          actorId: input.actorId,
          actorType: input.actorType,
        },
      });

      if (input.outboxEvents.length > 0) {
        await tx.outboxEvent.createMany({
          data: input.outboxEvents.map((event) => ({
            id: createId(),
            eventType: event.eventType,
            routingKey: event.routingKey,
            payloadJson: event.payload as Prisma.InputJsonValue,
            traceId: event.traceId,
          })),
        });
      }

      const row = await tx.order.findUniqueOrThrow({
        where: { id: input.id },
        include: ORDER_INCLUDE,
      });
      return mapOrder(row);
    });
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    return row ? mapOrder(row) : null;
  }

  async findByCode(orderCode: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { orderCode },
      include: ORDER_INCLUDE,
    });
    return row ? mapOrder(row) : null;
  }

  async list(filter: ListOrdersFilter): Promise<ListOrdersResult> {
    const where: Prisma.OrderWhereInput = {
      customerId: filter.customerId,
      status: filter.status,
      orderCode: filter.orderCode,
      ...((filter.from || filter.to) && {
        createdAt: {
          ...(filter.from && { gte: filter.from }),
          ...(filter.to && { lte: filter.to }),
        },
      }),
    };
    const [sortField, sortDir] = filter.sort.split('_') as [
      'createdAt' | 'grandTotal',
      'asc' | 'desc',
    ];

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { [sortField]: sortDir },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items: rows.map(mapOrder), total };
  }

  async updateStatus(input: UpdateOrderStatusInput): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id: input.orderId },
      });
      if (!current) {
        throw new AppError({
          errorCode: ErrorCodes.ORDER_NOT_FOUND,
          message: 'Không tìm thấy đơn hàng',
        });
      }

      const updated = await tx.order.updateMany({
        where: { id: input.orderId, version: input.expectedVersion },
        data: {
          status: input.toStatus,
          version: { increment: 1 },
          updatedAt: new Date(),
          ...(input.paymentStatus !== undefined && {
            paymentStatus: input.paymentStatus,
          }),
          ...(input.paymentReference !== undefined && {
            paymentReference: input.paymentReference,
          }),
          ...(input.paidAt !== undefined && { paidAt: input.paidAt }),
          ...(input.cancelReason !== undefined && {
            cancelReason: input.cancelReason,
          }),
          ...(input.cancelledAt !== undefined && {
            cancelledAt: input.cancelledAt,
          }),
          ...(input.inventoryReleased !== undefined && {
            inventoryReleased: input.inventoryReleased,
          }),
          ...(input.refundContractStatus !== undefined && {
            refundContractStatus: input.refundContractStatus,
          }),
        },
      });
      if (updated.count !== 1) {
        throw new AppError({
          errorCode: ErrorCodes.ORDER_CONFLICT,
          message: 'Đơn hàng đã được cập nhật bởi thao tác khác',
          details: {
            expectedVersion: input.expectedVersion,
            actualVersion: current.version,
          },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          id: createId(),
          orderId: input.orderId,
          fromStatus: current.status,
          toStatus: input.toStatus,
          actorId: input.actorId,
          actorType: input.actorType,
          reason: input.reason,
        },
      });

      if (input.outboxEvents?.length) {
        await tx.outboxEvent.createMany({
          data: input.outboxEvents.map((event) => ({
            id: createId(),
            eventType: event.eventType,
            routingKey: event.routingKey,
            payloadJson: event.payload as Prisma.InputJsonValue,
            traceId: event.traceId,
          })),
        });
      }

      const row = await tx.order.findUniqueOrThrow({
        where: { id: input.orderId },
        include: ORDER_INCLUDE,
      });
      return mapOrder(row);
    });
  }

  async markInventoryReleased(
    orderId: string,
    expectedVersion: number,
  ): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, version: expectedVersion },
        data: {
          inventoryReleased: true,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new AppError({
          errorCode: ErrorCodes.ORDER_CONFLICT,
          message: 'Đơn hàng đã được cập nhật bởi thao tác khác',
        });
      }
      const row = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      });
      return mapOrder(row);
    });
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.orderIdempotency.findUnique({
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
    await this.prisma.orderIdempotency.upsert({
      where: { key },
      create: {
        key,
        operation,
        responseJson: response as Prisma.InputJsonValue,
      },
      update: {},
    });
  }

  async addOutbox(events: OutboxEventInput[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    await this.prisma.outboxEvent.createMany({
      data: events.map((event) => ({
        id: createId(),
        eventType: event.eventType,
        routingKey: event.routingKey,
        payloadJson: event.payload as Prisma.InputJsonValue,
        traceId: event.traceId,
      })),
    });
  }

  async listUnpublishedOutbox(limit: number): Promise<OutboxEventRecord[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      routingKey: row.routingKey,
      payload: row.payloadJson,
      traceId: row.traceId,
      publishedAt: row.publishedAt ?? undefined,
      createdAt: row.createdAt,
    }));
  }

  async markOutboxPublished(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.prisma.outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: { publishedAt: new Date() },
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

  async getStatusHistory(orderId: string): Promise<OrderStatusHistoryEntry[]> {
    const rows = await this.prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      orderId: row.orderId,
      fromStatus: row.fromStatus ?? undefined,
      toStatus: row.toStatus,
      actorId: row.actorId,
      actorType: row.actorType,
      reason: row.reason ?? undefined,
      createdAt: row.createdAt,
    }));
  }

  async getPackages(orderId: string): Promise<OrderPackage[]> {
    const rows = await this.prisma.orderPackage.findMany({
      where: { orderId },
      include: { items: true },
    });
    return rows.map(mapPackage);
  }
}
