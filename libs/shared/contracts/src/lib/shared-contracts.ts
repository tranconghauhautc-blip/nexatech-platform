import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

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

export function createPaginatedResponse<T>(
  items: T[],
  totalItems: number,
  query: PaginationQuery,
): PaginatedResponse<T> {
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version?: string;
  timestamp: string;
}

export function createHealthResponse(
  service: string,
  status: HealthResponse['status'] = 'ok',
): HealthResponse {
  return {
    status,
    service,
    timestamp: new Date().toISOString(),
  };
}

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(1).max(120),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export const productStatusSchema = z.enum([
  'draft',
  'active',
  'inactive',
  'archived',
]);

export type ProductStatus = z.infer<typeof productStatusSchema>;

export interface ProductSummary {
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

export const CATEGORY_SLUGS = [
  'dien-thoai',
  'laptop',
  'tablet',
  'dong-ho-thong-minh',
  'tai-nghe-loa',
  'phu-kien',
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug phải dạng kebab-case ASCII');

export const mediaStatusSchema = z.enum(['pending', 'active', 'deleted']);
export type MediaStatus = z.infer<typeof mediaStatusSchema>;

export const mediaOwnerTypeSchema = z.enum([
  'product',
  'sku',
  'review',
  'user',
  'misc',
]);
export type MediaOwnerType = z.infer<typeof mediaOwnerTypeSchema>;

export const mediaRoleSchema = z.enum(['thumbnail', 'gallery', 'video']);
export type MediaRole = z.infer<typeof mediaRoleSchema>;

export const productSearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional(),
  categorySlug: z.string().trim().optional(),
  brandSlug: z.string().trim().optional(),
  status: productStatusSchema.optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  attributeKey: z.string().trim().optional(),
  attributeValue: z.string().trim().optional(),
  sort: z
    .enum(['relevance', 'price_asc', 'price_desc', 'newest', 'name'])
    .default('relevance'),
});

export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;

export const createCategoryRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;

export const createBrandRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().default(true),
});

export type CreateBrandRequest = z.infer<typeof createBrandRequestSchema>;

export const createProductRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: slugSchema,
  description: z.string().trim().max(10000).optional(),
  categoryId: z.string().uuid(),
  brandId: z.string().uuid(),
  status: productStatusSchema.default('draft'),
  specs: z
    .array(
      z.object({
        attributeId: z.string().uuid(),
        value: z.string().trim().min(1).max(500),
      }),
    )
    .default([]),
});

export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;

export const createSkuRequestSchema = z.object({
  productId: z.string().uuid(),
  skuCode: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Z0-9][A-Z0-9-_]*$/),
  name: z.string().trim().min(1).max(200),
  attributes: z.record(z.string(), z.string()).default({}),
  price: z.number().int().min(0),
  currency: z.literal('VND').default('VND'),
});

export type CreateSkuRequest = z.infer<typeof createSkuRequestSchema>;

export const updatePriceRequestSchema = z.object({
  amount: z.number().int().min(0),
  currency: z.literal('VND').default('VND'),
  reason: z.string().trim().max(500).optional(),
});

export type UpdatePriceRequest = z.infer<typeof updatePriceRequestSchema>;

export const createSpecTemplateRequestSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  groups: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        sortOrder: z.number().int().default(0),
        attributes: z
          .array(
            z.object({
              key: z
                .string()
                .trim()
                .min(1)
                .max(64)
                .regex(/^[a-z0-9_]+$/),
              label: z.string().trim().min(1).max(120),
              dataType: z
                .enum(['string', 'number', 'boolean', 'enum'])
                .default('string'),
              unit: z.string().trim().max(32).optional(),
              isFilterable: z.boolean().default(true),
              sortOrder: z.number().int().default(0),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

export type CreateSpecTemplateRequest = z.infer<
  typeof createSpecTemplateRequestSchema
>;

export const ALLOWED_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
] as const;

export const mediaPresignRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(ALLOWED_MEDIA_MIME_TYPES),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024),
  ownerType: mediaOwnerTypeSchema,
  ownerId: z.string().trim().min(1).max(120),
  role: mediaRoleSchema.default('gallery'),
  bucket: z.string().trim().min(1).max(63).optional(),
});

export type MediaPresignRequest = z.infer<typeof mediaPresignRequestSchema>;

export const confirmMediaUploadSchema = z.object({
  etag: z.string().trim().max(128).optional(),
});

export type ConfirmMediaUpload = z.infer<typeof confirmMediaUploadSchema>;

export const linkMediaRequestSchema = z.object({
  entityType: z.enum(['product', 'sku', 'review']),
  entityId: z.string().trim().min(1).max(120),
  role: mediaRoleSchema,
  sortOrder: z.number().int().default(0),
  isPrimary: z.boolean().default(false),
});

export type LinkMediaRequest = z.infer<typeof linkMediaRequestSchema>;

export function toSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

export const locationTypeSchema = z.enum(['warehouse', 'store']);
export type LocationType = z.infer<typeof locationTypeSchema>;

export const createWarehouseRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).optional(),
  isActive: z.boolean().default(true),
});
export type CreateWarehouseRequest = z.infer<
  typeof createWarehouseRequestSchema
>;

export const createStoreRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
  warehouseId: z.string().uuid().optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  isActive: z.boolean().default(true),
});
export type CreateStoreRequest = z.infer<typeof createStoreRequestSchema>;

export const stockLocationRefSchema = z.object({
  locationType: locationTypeSchema,
  locationId: z.string().uuid(),
});

export const receiveStockRequestSchema = z.object({
  skuCode: z.string().trim().min(1).max(64),
  locationType: locationTypeSchema,
  locationId: z.string().uuid(),
  quantity: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(120),
  note: z.string().trim().max(500).optional(),
});
export type ReceiveStockRequest = z.infer<typeof receiveStockRequestSchema>;

export const issueStockRequestSchema = receiveStockRequestSchema;
export type IssueStockRequest = z.infer<typeof issueStockRequestSchema>;

export const reserveStockRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  orderId: z.string().trim().min(1).max(120).optional(),
  lines: z
    .array(
      z.object({
        skuCode: z.string().trim().min(1).max(64),
        quantity: z.number().int().positive(),
        preferredLocationType: locationTypeSchema.optional(),
        preferredLocationId: z.string().uuid().optional(),
      }),
    )
    .min(1),
  expiresInSeconds: z.number().int().positive().max(86_400).default(900),
});
export type ReserveStockRequest = z.infer<typeof reserveStockRequestSchema>;

export const transferStockRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  skuCode: z.string().trim().min(1).max(64),
  quantity: z.number().int().positive(),
  fromLocationType: locationTypeSchema,
  fromLocationId: z.string().uuid(),
  toLocationType: locationTypeSchema,
  toLocationId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});
export type TransferStockRequest = z.infer<typeof transferStockRequestSchema>;

export const adjustStockRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  skuCode: z.string().trim().min(1).max(64),
  locationType: locationTypeSchema,
  locationId: z.string().uuid(),
  onHand: z.number().int().min(0),
  reason: z.string().trim().min(1).max(500),
});
export type AdjustStockRequest = z.infer<typeof adjustStockRequestSchema>;

export const availabilityQuerySchema = z.object({
  skuCode: z.string().trim().min(1).max(64),
  quantity: z.coerce.number().int().positive().default(1),
  city: z.string().trim().max(120).optional(),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

/** Giới hạn số lượng mỗi dòng giỏ hàng (không phải tồn kho). */
export const CART_ITEM_MAX_QUANTITY = 99;
export const CART_GUEST_TTL_DAYS = 30;
export const WISHLIST_MAX_ITEMS = 100;
export const COMPARISON_MAX_ITEMS = 4;
export const RECENTLY_VIEWED_MAX_ITEMS = 20;

export const cartStatusSchema = z.enum([
  'ACTIVE',
  'CONVERTED',
  'EXPIRED',
  'ABANDONED',
]);
export type CartStatus = z.infer<typeof cartStatusSchema>;

export const cartOwnerTypeSchema = z.enum(['GUEST', 'CUSTOMER']);
export type CartOwnerType = z.infer<typeof cartOwnerTypeSchema>;

export const addCartItemRequestSchema = z.object({
  skuCode: z.string().trim().min(1).max(64),
  quantity: z.number().int().positive().max(CART_ITEM_MAX_QUANTITY),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  city: z.string().trim().max(120).optional(),
});
export type AddCartItemRequest = z.infer<typeof addCartItemRequestSchema>;

export const updateCartItemRequestSchema = z.object({
  quantity: z.number().int().positive().max(CART_ITEM_MAX_QUANTITY),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  city: z.string().trim().max(120).optional(),
});
export type UpdateCartItemRequest = z.infer<typeof updateCartItemRequestSchema>;

export const mergeCartRequestSchema = z.object({
  guestCartToken: z.string().trim().min(16).max(256),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type MergeCartRequest = z.infer<typeof mergeCartRequestSchema>;

export const wishlistAddRequestSchema = z.object({
  productId: z.string().uuid(),
  skuId: z.string().uuid().optional(),
});
export type WishlistAddRequest = z.infer<typeof wishlistAddRequestSchema>;

export const comparisonAddRequestSchema = z.object({
  productId: z.string().uuid(),
});
export type ComparisonAddRequest = z.infer<typeof comparisonAddRequestSchema>;

export const recentlyViewedRequestSchema = z.object({
  productId: z.string().uuid(),
});
export type RecentlyViewedRequest = z.infer<typeof recentlyViewedRequestSchema>;

export interface CartItemDto {
  id: string;
  skuId: string;
  skuCode: string;
  quantity: number;
  unitPriceSnapshot: number;
  currentUnitPrice?: number;
  priceChanged: boolean;
  currency: string;
  productId: string;
  productName: string;
  productSlug: string;
  skuName: string;
  attributes: Record<string, string>;
  available?: boolean;
  lineSubtotal: number;
}

export interface CartDto {
  id: string;
  ownerType: CartOwnerType;
  customerId?: string;
  status: CartStatus;
  version: number;
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  currency: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  items: CartItemDto[];
  guestCartToken?: string;
}

export interface CartValidationIssue {
  skuId: string;
  skuCode: string;
  code:
    | 'SKU_NOT_FOUND'
    | 'PRODUCT_NOT_SELLABLE'
    | 'PRICE_CHANGED'
    | 'INSUFFICIENT_STOCK'
    | 'QUANTITY_LIMIT';
  message: string;
}

export interface CartValidateResponse {
  cart: CartDto;
  valid: boolean;
  issues: CartValidationIssue[];
  /** Contract gợi ý cho checkout — chưa gọi reserve. */
  reservationPreview: Array<{
    skuCode: string;
    quantity: number;
  }>;
}

export const convertCartRequestSchema = z.object({
  orderId: z.string().trim().min(1).max(120).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type ConvertCartRequest = z.infer<typeof convertCartRequestSchema>;

/** Phí ship snapshot (VND integer) — không voucher. */
export const ORDER_SHIPPING_FEE_VND = {
  STANDARD: 30_000,
  EXPRESS: 50_000,
  STORE_PICKUP: 0,
} as const;

export const orderStatusSchema = z.enum([
  'PENDING',
  'AWAITING_PAYMENT',
  'CONFIRMED',
  'PROCESSING',
  'READY_TO_SHIP',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
  'FAILED',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const deliveryMethodSchema = z.enum([
  'STANDARD',
  'EXPRESS',
  'STORE_PICKUP',
]);
export type DeliveryMethod = z.infer<typeof deliveryMethodSchema>;

export const paymentMethodSchema = z.enum(['COD', 'MOCK', 'VNPAY']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentStatusSchema = z.enum([
  'UNPAID',
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'REFUND_PENDING',
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const packageStatusSchema = z.enum([
  'PENDING',
  'ALLOCATED',
  'READY_TO_SHIP',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);
export type PackageStatus = z.infer<typeof packageStatusSchema>;

export const orderAddressSchema = z.object({
  recipientName: z.string().trim().min(1).max(120),
  recipientPhone: z.string().trim().min(8).max(20),
  line1: z.string().trim().min(1).max(250),
  line2: z.string().trim().max(250).optional(),
  ward: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1).max(120),
  province: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(80).default('VN'),
});
export type OrderAddressInput = z.infer<typeof orderAddressSchema>;

export const createOrderRequestSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(120),
    deliveryMethod: deliveryMethodSchema,
    paymentMethod: paymentMethodSchema,
    shippingAddress: orderAddressSchema.optional(),
    pickupStoreId: z.string().uuid().optional(),
    deliverySlot: z.string().trim().max(120).optional(),
    city: z.string().trim().max(120).optional(),
    customerDisplayName: z.string().trim().max(120).optional(),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().trim().max(20).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.deliveryMethod === 'STORE_PICKUP') {
      if (!value.pickupStoreId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'pickupStoreId bắt buộc khi nhận tại cửa hàng',
          path: ['pickupStoreId'],
        });
      }
    } else if (!value.shippingAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'shippingAddress bắt buộc với giao hàng tận nơi',
        path: ['shippingAddress'],
      });
    }
  });
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const cancelOrderRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type CancelOrderRequest = z.infer<typeof cancelOrderRequestSchema>;

export const confirmOrderRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type ConfirmOrderRequest = z.infer<typeof confirmOrderRequestSchema>;

export const orderStatusTransitionRequestSchema = z.object({
  toStatus: orderStatusSchema,
  reason: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type OrderStatusTransitionRequest = z.infer<
  typeof orderStatusTransitionRequestSchema
>;

export const listOrdersQuerySchema = paginationQuerySchema.extend({
  status: orderStatusSchema.optional(),
  customerId: z.string().trim().min(1).max(120).optional(),
  orderCode: z.string().trim().min(1).max(40).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z
    .enum([
      'createdAt_desc',
      'createdAt_asc',
      'grandTotal_desc',
      'grandTotal_asc',
    ])
    .default('createdAt_desc'),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export interface OrderItemDto {
  id: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  productId: string;
  productName: string;
  variantAttributes: Record<string, string>;
  unitPrice: number;
  quantity: number;
  lineSubtotal: number;
  currency: string;
}

export interface OrderAddressDto {
  recipientName: string;
  recipientPhone: string;
  line1: string;
  line2?: string;
  ward?: string;
  district?: string;
  city: string;
  province?: string;
  postalCode?: string;
  country: string;
  fullText: string;
}

export interface OrderPackageItemDto {
  id: string;
  orderItemId: string;
  skuCode: string;
  quantity: number;
}

export interface OrderPackageDto {
  id: string;
  packageCode: string;
  status: PackageStatus;
  sourceLocationType: 'warehouse' | 'store';
  sourceLocationId: string;
  shippingProvider?: string;
  trackingCode?: string;
  estimatedDeliveryAt?: string;
  items: OrderPackageItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderStatusHistoryDto {
  id: string;
  fromStatus?: OrderStatus;
  toStatus: OrderStatus;
  actorId: string;
  actorType: string;
  reason?: string;
  createdAt: string;
}

export interface OrderDto {
  id: string;
  orderCode: string;
  customerId: string;
  customerSnapshot: {
    displayName?: string;
    email?: string;
    phone?: string;
  };
  status: OrderStatus;
  version: number;
  cartId: string;
  reservationId?: string;
  deliveryMethod: DeliveryMethod;
  deliverySlot?: string;
  pickupStoreId?: string;
  shippingAddress?: OrderAddressDto;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  paidAt?: string;
  currency: string;
  merchandiseSubtotal: number;
  shippingFee: number;
  discountTotal: number;
  grandTotal: number;
  totalQuantity: number;
  cancelReason?: string;
  cancelledAt?: string;
  inventoryReleased: boolean;
  refundContractStatus?: 'NOT_REQUIRED' | 'PENDING' | 'COMPLETED';
  items: OrderItemDto[];
  packages: OrderPackageDto[];
  createdAt: string;
  updatedAt: string;
}

/** Payment lifecycle status (payment-service owned) */
export const paymentLifecycleStatusSchema = z.enum([
  'CREATED',
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REFUND_PENDING',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);
export type PaymentLifecycleStatus = z.infer<
  typeof paymentLifecycleStatusSchema
>;

export const paymentProviderSchema = z.enum(['COD', 'MOCK', 'VNPAY']);
export type PaymentProviderCode = z.infer<typeof paymentProviderSchema>;

export const refundStatusSchema = z.enum([
  'REQUESTED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
]);
export type RefundStatus = z.infer<typeof refundStatusSchema>;

export const createPaymentRequestSchema = z.object({
  orderId: z.string().trim().min(1).max(120),
  idempotencyKey: z.string().trim().min(8).max(120),
  /** Optional — nếu bỏ trống dùng paymentMethod của order */
  method: paymentMethodSchema.optional(),
  returnUrl: z.string().url().optional(),
});
export type CreatePaymentRequest = z.infer<typeof createPaymentRequestSchema>;

export const cancelPaymentRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type CancelPaymentRequest = z.infer<typeof cancelPaymentRequestSchema>;

export const createRefundRequestSchema = z.object({
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  reason: z.string().trim().min(1).max(500),
  idempotencyKey: z.string().trim().min(8).max(120),
});
export type CreateRefundRequest = z.infer<typeof createRefundRequestSchema>;

export const listPaymentsQuerySchema = paginationQuerySchema.extend({
  status: paymentLifecycleStatusSchema.optional(),
  provider: paymentProviderSchema.optional(),
  orderId: z.string().trim().min(1).max(120).optional(),
  customerId: z.string().trim().min(1).max(120).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z
    .enum(['createdAt_desc', 'createdAt_asc', 'amount_desc', 'amount_asc'])
    .default('createdAt_desc'),
});
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

export const syncOrderPaymentRequestSchema = z.object({
  paymentStatus: paymentStatusSchema,
  paymentReference: z.string().trim().min(1).max(120).optional(),
  paidAt: z.string().datetime().optional(),
  confirmOrder: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type SyncOrderPaymentRequest = z.infer<
  typeof syncOrderPaymentRequestSchema
>;

export interface PaymentAttemptDto {
  id: string;
  attemptNumber: number;
  status: string;
  providerReference?: string;
  failureCode?: string;
  failureMessage?: string;
  createdAt: string;
}

export interface PaymentTransactionDto {
  id: string;
  type: string;
  amount: number;
  currency: string;
  providerTxnId?: string;
  status: string;
  createdAt: string;
}

export interface RefundDto {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  refundReference: string;
  providerRefundId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDto {
  id: string;
  paymentReference: string;
  orderId: string;
  orderCode: string;
  customerId: string;
  provider: PaymentProviderCode;
  method: PaymentMethod;
  status: PaymentLifecycleStatus;
  amount: number;
  currency: 'VND';
  amountRefunded: number;
  checkoutUrl?: string;
  expiresAt?: string;
  paidAt?: string;
  failureCode?: string;
  failureMessage?: string;
  version: number;
  attempts?: PaymentAttemptDto[];
  transactions?: PaymentTransactionDto[];
  refunds?: RefundDto[];
  createdAt: string;
  updatedAt: string;
}

/** Shipping lifecycle status (shipping-service owned) */
export const shipmentStatusSchema = z.enum([
  'CREATED',
  'QUOTED',
  'BOOKED',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_FAILED',
  'CANCELLED',
  'RETURN_TO_SENDER',
  'RETURNED',
]);
export type ShipmentStatus = z.infer<typeof shipmentStatusSchema>;

export const shippingProviderSchema = z.enum(['MOCK', 'GHN']);
export type ShippingProviderCode = z.infer<typeof shippingProviderSchema>;

export const createShippingQuoteRequestSchema = z.object({
  orderId: z.string().trim().min(1).max(120),
  idempotencyKey: z.string().trim().min(8).max(120),
  deliveryMethod: deliveryMethodSchema.optional(),
  packageIds: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
});
export type CreateShippingQuoteRequest = z.infer<
  typeof createShippingQuoteRequestSchema
>;

export const createShipmentRequestSchema = z.object({
  orderId: z.string().trim().min(1).max(120),
  packageId: z.string().trim().min(1).max(120),
  quoteId: z.string().trim().min(1).max(120).optional(),
  slotReservationId: z.string().trim().min(1).max(120).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
  deliveryMethod: deliveryMethodSchema.optional(),
});
export type CreateShipmentRequest = z.infer<typeof createShipmentRequestSchema>;

export const bookShipmentRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type BookShipmentRequest = z.infer<typeof bookShipmentRequestSchema>;

export const cancelShipmentRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type CancelShipmentRequest = z.infer<typeof cancelShipmentRequestSchema>;

export const shipmentStatusTransitionRequestSchema = z.object({
  toStatus: shipmentStatusSchema,
  reason: z.string().trim().max(500).optional(),
  locationText: z.string().trim().max(250).optional(),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type ShipmentStatusTransitionRequest = z.infer<
  typeof shipmentStatusTransitionRequestSchema
>;

export const reserveDeliverySlotRequestSchema = z.object({
  orderId: z.string().trim().min(1).max(120).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
});
export type ReserveDeliverySlotRequest = z.infer<
  typeof reserveDeliverySlotRequestSchema
>;

export const readyForPickupRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type ReadyForPickupRequest = z.infer<typeof readyForPickupRequestSchema>;

export const confirmPickupRequestSchema = z.object({
  pickupCode: z.string().trim().min(4).max(32),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type ConfirmPickupRequest = z.infer<typeof confirmPickupRequestSchema>;

export const listShipmentsQuerySchema = paginationQuerySchema.extend({
  status: shipmentStatusSchema.optional(),
  provider: shippingProviderSchema.optional(),
  orderId: z.string().trim().min(1).max(120).optional(),
  customerId: z.string().trim().min(1).max(120).optional(),
  packageId: z.string().trim().min(1).max(120).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z
    .enum([
      'createdAt_desc',
      'createdAt_asc',
      'shippingFee_desc',
      'shippingFee_asc',
    ])
    .default('createdAt_desc'),
});
export type ListShipmentsQuery = z.infer<typeof listShipmentsQuerySchema>;

export const listDeliverySlotsQuerySchema = z.object({
  deliveryDate: z.string().trim().min(8).max(20).optional(),
  deliveryMethod: deliveryMethodSchema.optional(),
  locationType: z.enum(['warehouse', 'store', 'city']).optional(),
  locationId: z.string().trim().min(1).max(120).optional(),
});
export type ListDeliverySlotsQuery = z.infer<
  typeof listDeliverySlotsQuerySchema
>;

export const syncOrderShippingRequestSchema = z.object({
  packageId: z.string().trim().min(1).max(120),
  shipmentId: z.string().trim().min(1).max(120),
  trackingCode: z.string().trim().min(1).max(120).optional(),
  shippingProvider: z.string().trim().min(1).max(40).optional(),
  packageStatus: packageStatusSchema.optional(),
  estimatedDeliveryAt: z.string().datetime().optional(),
  orderStatus: orderStatusSchema.optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type SyncOrderShippingRequest = z.infer<
  typeof syncOrderShippingRequestSchema
>;

/** warranty-service → order: đồng bộ RETURN_REQUESTED / RETURNED / rollback DELIVERED */
export const syncOrderReturnRequestSchema = z.object({
  returnRequestId: z.string().trim().min(1).max(120).optional(),
  orderItemId: z.string().trim().min(1).max(120).optional(),
  toStatus: z.enum(['RETURN_REQUESTED', 'RETURNED', 'DELIVERED']),
  reason: z.string().trim().min(1).max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type SyncOrderReturnRequest = z.infer<
  typeof syncOrderReturnRequestSchema
>;

export interface ShippingQuotePackageFeeDto {
  packageId: string;
  fee: number;
}

export interface ShippingQuoteDto {
  id: string;
  orderId: string;
  orderCode: string;
  customerId: string;
  deliveryMethod: DeliveryMethod;
  currency: 'VND';
  totalFee: number;
  packageFees: ShippingQuotePackageFeeDto[];
  provider: ShippingProviderCode;
  expiresAt: string;
  status: string;
  createdAt: string;
}

export interface DeliverySlotDto {
  id: string;
  deliveryDate: string;
  windowStart: string;
  windowEnd: string;
  deliveryMethod: DeliveryMethod;
  locationType: string;
  locationId: string;
  capacity: number;
  reservedCount: number;
  available: number;
  cutoffAt: string;
  timezone: string;
  active: boolean;
}

export interface SlotReservationDto {
  id: string;
  slotId: string;
  orderId?: string;
  shipmentId?: string;
  customerId: string;
  status: 'HELD' | 'RELEASED' | 'CONSUMED';
  expiresAt: string;
  createdAt: string;
}

export interface TrackingEventDto {
  id: string;
  shipmentId: string;
  providerStatus: string;
  normalizedStatus: ShipmentStatus;
  eventTime: string;
  locationText?: string;
  note?: string;
  source: string;
}

export interface ShipmentItemDto {
  id: string;
  skuCode: string;
  quantity: number;
  orderItemId?: string;
}

export interface ShipmentDto {
  id: string;
  orderId: string;
  orderCode: string;
  packageId: string;
  customerId: string;
  deliveryMethod: DeliveryMethod;
  provider: ShippingProviderCode;
  status: ShipmentStatus;
  sourceLocationType: string;
  sourceLocationId: string;
  destination?: Record<string, unknown>;
  shippingFee: number;
  currency: 'VND';
  quoteId?: string;
  slotReservationId?: string;
  providerShipmentRef?: string;
  trackingCode?: string;
  estimatedDeliveryAt?: string;
  pickupCodeHint?: string;
  failureAttempts: number;
  version: number;
  items?: ShipmentItemDto[];
  trackingEvents?: TrackingEventDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicTrackingDto {
  trackingCode: string;
  status: ShipmentStatus;
  deliveryMethod: DeliveryMethod;
  estimatedDeliveryAt?: string;
  events: Array<{
    status: ShipmentStatus;
    eventTime: string;
    locationText?: string;
    note?: string;
  }>;
}

/** Review lifecycle (review-service owned) */
export const reviewStatusSchema = z.enum([
  'PENDING',
  'PUBLISHED',
  'HIDDEN',
  'REJECTED',
  'DELETED',
]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const reviewReportReasonSchema = z.enum([
  'SPAM',
  'OFFENSIVE',
  'FAKE',
  'IRRELEVANT',
  'PRIVACY',
  'OTHER',
]);
export type ReviewReportReason = z.infer<typeof reviewReportReasonSchema>;

export const reviewReportStatusSchema = z.enum([
  'OPEN',
  'REVIEWING',
  'RESOLVED',
  'DISMISSED',
]);
export type ReviewReportStatus = z.infer<typeof reviewReportStatusSchema>;

export const reviewMediaKindSchema = z.enum(['IMAGE', 'VIDEO']);
export type ReviewMediaKind = z.infer<typeof reviewMediaKindSchema>;

export const REVIEW_LIMITS = {
  TITLE_MAX: 120,
  CONTENT_MIN: 10,
  CONTENT_MAX: 5000,
  REPLY_MIN: 1,
  REPLY_MAX: 2000,
  REPORT_DESCRIPTION_MAX: 1000,
  MAX_IMAGES: 5,
  MAX_VIDEOS: 1,
  EDIT_WINDOW_HOURS: 72,
} as const;

export const createReviewRequestSchema = z.object({
  orderId: z.string().trim().min(1).max(120),
  orderItemId: z.string().trim().min(1).max(120),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(REVIEW_LIMITS.TITLE_MAX).optional(),
  content: z
    .string()
    .trim()
    .min(REVIEW_LIMITS.CONTENT_MIN)
    .max(REVIEW_LIMITS.CONTENT_MAX),
  displayName: z.string().trim().min(1).max(80).optional(),
  mediaIds: z.array(z.string().trim().min(1).max(120)).max(6).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type CreateReviewRequest = z.infer<typeof createReviewRequestSchema>;

export const updateReviewRequestSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    title: z
      .string()
      .trim()
      .min(1)
      .max(REVIEW_LIMITS.TITLE_MAX)
      .nullable()
      .optional(),
    content: z
      .string()
      .trim()
      .min(REVIEW_LIMITS.CONTENT_MIN)
      .max(REVIEW_LIMITS.CONTENT_MAX)
      .optional(),
    expectedVersion: z.coerce.number().int().min(0).optional(),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  })
  .refine(
    (v) =>
      v.rating !== undefined ||
      v.title !== undefined ||
      v.content !== undefined,
    { message: 'Cần ít nhất một trường để cập nhật' },
  );
export type UpdateReviewRequest = z.infer<typeof updateReviewRequestSchema>;

export const attachReviewMediaRequestSchema = z.object({
  mediaId: z.string().trim().min(1).max(120),
  kind: reviewMediaKindSchema.optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type AttachReviewMediaRequest = z.infer<
  typeof attachReviewMediaRequestSchema
>;

export const createReviewReplyRequestSchema = z.object({
  content: z
    .string()
    .trim()
    .min(REVIEW_LIMITS.REPLY_MIN)
    .max(REVIEW_LIMITS.REPLY_MAX),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type CreateReviewReplyRequest = z.infer<
  typeof createReviewReplyRequestSchema
>;

export const updateReviewReplyRequestSchema = z.object({
  content: z
    .string()
    .trim()
    .min(REVIEW_LIMITS.REPLY_MIN)
    .max(REVIEW_LIMITS.REPLY_MAX),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type UpdateReviewReplyRequest = z.infer<
  typeof updateReviewReplyRequestSchema
>;

export const createReviewReportRequestSchema = z.object({
  reason: reviewReportReasonSchema,
  description: z
    .string()
    .trim()
    .max(REVIEW_LIMITS.REPORT_DESCRIPTION_MAX)
    .optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type CreateReviewReportRequest = z.infer<
  typeof createReviewReportRequestSchema
>;

export const moderateReviewRequestSchema = z.object({
  action: z.enum(['publish', 'hide', 'reject', 'restore']),
  reason: z.string().trim().min(1).max(500),
  expectedVersion: z.coerce.number().int().min(0).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type ModerateReviewRequest = z.infer<typeof moderateReviewRequestSchema>;

export const resolveReviewReportRequestSchema = z.object({
  resolution: z.enum(['RESOLVED', 'DISMISSED']),
  note: z.string().trim().min(1).max(500),
  hideReview: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type ResolveReviewReportRequest = z.infer<
  typeof resolveReviewReportRequestSchema
>;

export const rebuildAggregatesRequestSchema = z.object({
  productId: z.string().trim().min(1).max(120).optional(),
});
export type RebuildAggregatesRequest = z.infer<
  typeof rebuildAggregatesRequestSchema
>;

export const listProductReviewsQuerySchema = paginationQuerySchema.extend({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  hasMedia: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v === true || v === 'true',
    ),
  verifiedOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v === true || v === 'true',
    ),
  sort: z
    .enum(['newest', 'highest', 'lowest', 'most_helpful'])
    .default('newest'),
});
export type ListProductReviewsQuery = z.infer<
  typeof listProductReviewsQuerySchema
>;

export const listAdminReviewsQuerySchema = paginationQuerySchema.extend({
  status: reviewStatusSchema.optional(),
  productId: z.string().trim().min(1).max(120).optional(),
  customerId: z.string().trim().min(1).max(120).optional(),
  reported: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v === true || v === 'true',
    ),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.enum(['newest', 'oldest', 'most_reported']).default('newest'),
});
export type ListAdminReviewsQuery = z.infer<typeof listAdminReviewsQuerySchema>;

export const listReviewReportsQuerySchema = paginationQuerySchema.extend({
  status: reviewReportStatusSchema.optional(),
  reviewId: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});
export type ListReviewReportsQuery = z.infer<
  typeof listReviewReportsQuerySchema
>;

export interface ReviewMediaDto {
  id: string;
  mediaId: string;
  kind: ReviewMediaKind;
  sortOrder: number;
  createdAt: string;
}

export interface ReviewReplyDto {
  id: string;
  content: string;
  staffId: string;
  staffDisplayName?: string;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
}

export interface ReviewDto {
  id: string;
  productId: string;
  skuId?: string;
  skuCode?: string;
  orderId: string;
  orderItemId: string;
  customerId?: string;
  displayName: string;
  rating: number;
  title?: string;
  content: string;
  verifiedPurchase: boolean;
  status: ReviewStatus;
  helpfulCount: number;
  reportCount: number;
  hasMedia: boolean;
  media: ReviewMediaDto[];
  reply?: ReviewReplyDto;
  version: number;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
}

export interface ProductRatingSummaryDto {
  productId: string;
  averageRating: number;
  averageRatingCents: number;
  totalReviews: number;
  verifiedReviews: number;
  mediaReviews: number;
  ratingCounts: {
    star1: number;
    star2: number;
    star3: number;
    star4: number;
    star5: number;
  };
  updatedAt: string;
}

export interface ReviewModerationHistoryDto {
  id: string;
  fromStatus?: ReviewStatus;
  toStatus: ReviewStatus;
  action: string;
  actorId: string;
  actorType: string;
  reason?: string;
  createdAt: string;
}

export interface ReviewReportDto {
  id: string;
  reviewId: string;
  reporterId: string;
  reason: ReviewReportReason;
  description?: string;
  status: ReviewReportStatus;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminReviewDetailDto extends ReviewDto {
  customerId: string;
  moderationHistory: ReviewModerationHistoryDto[];
  reports?: ReviewReportDto[];
}

/** Warranty claim & return (warranty-service owned) */
export const warrantyClaimStatusSchema = z.enum([
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
export type WarrantyClaimStatus = z.infer<typeof warrantyClaimStatusSchema>;

export const returnRequestStatusSchema = z.enum([
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'AWAITING_RETURN',
  'RECEIVED',
  'COMPLETED',
  'CANCELLED',
]);
export type ReturnRequestStatus = z.infer<typeof returnRequestStatusSchema>;

export const returnReasonSchema = z.enum([
  'DEFECTIVE',
  'WRONG_ITEM',
  'CHANGED_MIND',
  'DAMAGED_SHIPPING',
  'OTHER',
]);
export type ReturnReason = z.infer<typeof returnReasonSchema>;

export const warrantyIssueTypeSchema = z.enum([
  'DEFECT',
  'MALFUNCTION',
  'MISSING_PARTS',
  'OTHER',
]);
export type WarrantyIssueType = z.infer<typeof warrantyIssueTypeSchema>;

/** Warranty/return chỉ chấp nhận bằng chứng dạng ảnh */
export const warrantyMediaKindSchema = z.enum(['IMAGE']);
export type WarrantyMediaKind = z.infer<typeof warrantyMediaKindSchema>;

/** Placeholder mong muốn xử lý — không kích hoạt payment/inventory trực tiếp */
export const desiredResolutionSchema = z.enum([
  'REFUND',
  'EXCHANGE',
  'STORE_CREDIT',
]);
export type DesiredResolution = z.infer<typeof desiredResolutionSchema>;

export const WARRANTY_LIMITS = {
  MAX_IMAGES: 5,
  DESCRIPTION_MIN: 10,
  DESCRIPTION_MAX: 5000,
} as const;

export const createWarrantyClaimRequestSchema = z.object({
  orderId: z.string().trim().min(1).max(120),
  orderItemId: z.string().trim().min(1).max(120),
  issueType: warrantyIssueTypeSchema,
  description: z
    .string()
    .trim()
    .min(WARRANTY_LIMITS.DESCRIPTION_MIN)
    .max(WARRANTY_LIMITS.DESCRIPTION_MAX),
  serialNumber: z.string().trim().min(1).max(120).optional(),
  mediaIds: z
    .array(z.string().trim().min(1).max(120))
    .max(WARRANTY_LIMITS.MAX_IMAGES)
    .optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type CreateWarrantyClaimRequest = z.infer<
  typeof createWarrantyClaimRequestSchema
>;

export const createReturnRequestSchema = z.object({
  orderId: z.string().trim().min(1).max(120),
  orderItemId: z.string().trim().min(1).max(120),
  reason: returnReasonSchema,
  description: z
    .string()
    .trim()
    .min(WARRANTY_LIMITS.DESCRIPTION_MIN)
    .max(WARRANTY_LIMITS.DESCRIPTION_MAX),
  quantity: z.number().int().positive().max(999).default(1),
  desiredResolution: desiredResolutionSchema.default('REFUND'),
  mediaIds: z
    .array(z.string().trim().min(1).max(120))
    .max(WARRANTY_LIMITS.MAX_IMAGES)
    .optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type CreateReturnRequest = z.infer<typeof createReturnRequestSchema>;

export const attachWarrantyEvidenceRequestSchema = z.object({
  mediaId: z.string().trim().min(1).max(120),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type AttachWarrantyEvidenceRequest = z.infer<
  typeof attachWarrantyEvidenceRequestSchema
>;

export const warrantyClaimTransitionActionSchema = z.enum([
  'start_review',
  'approve',
  'reject',
  'start_repair',
  'complete',
  'cancel',
]);
export type WarrantyClaimTransitionAction = z.infer<
  typeof warrantyClaimTransitionActionSchema
>;

export const transitionWarrantyClaimRequestSchema = z.object({
  action: warrantyClaimTransitionActionSchema,
  reason: z.string().trim().max(500).optional(),
  expectedVersion: z.coerce.number().int().min(0).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type TransitionWarrantyClaimRequest = z.infer<
  typeof transitionWarrantyClaimRequestSchema
>;

export const returnRequestTransitionActionSchema = z.enum([
  'start_review',
  'approve',
  'reject',
  'mark_awaiting_return',
  'mark_received',
  'complete',
  'cancel',
]);
export type ReturnRequestTransitionAction = z.infer<
  typeof returnRequestTransitionActionSchema
>;

export const transitionReturnRequestSchema = z.object({
  action: returnRequestTransitionActionSchema,
  reason: z.string().trim().max(500).optional(),
  expectedVersion: z.coerce.number().int().min(0).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type TransitionReturnRequest = z.infer<
  typeof transitionReturnRequestSchema
>;

export const listWarrantyClaimsQuerySchema = paginationQuerySchema.extend({
  status: warrantyClaimStatusSchema.optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});
export type ListWarrantyClaimsQuery = z.infer<
  typeof listWarrantyClaimsQuerySchema
>;

export const listReturnRequestsQuerySchema = paginationQuerySchema.extend({
  status: returnRequestStatusSchema.optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});
export type ListReturnRequestsQuery = z.infer<
  typeof listReturnRequestsQuerySchema
>;

export const listAdminWarrantyClaimsQuerySchema = paginationQuerySchema.extend({
  status: warrantyClaimStatusSchema.optional(),
  customerId: z.string().trim().min(1).max(120).optional(),
  orderId: z.string().trim().min(1).max(120).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});
export type ListAdminWarrantyClaimsQuery = z.infer<
  typeof listAdminWarrantyClaimsQuerySchema
>;

export const listAdminReturnRequestsQuerySchema = paginationQuerySchema.extend({
  status: returnRequestStatusSchema.optional(),
  customerId: z.string().trim().min(1).max(120).optional(),
  orderId: z.string().trim().min(1).max(120).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});
export type ListAdminReturnRequestsQuery = z.infer<
  typeof listAdminReturnRequestsQuerySchema
>;

export interface WarrantyClaimMediaDto {
  id: string;
  mediaId: string;
  kind: WarrantyMediaKind;
  createdAt: string;
}

export interface WarrantyClaimHistoryDto {
  id: string;
  fromStatus?: WarrantyClaimStatus;
  toStatus: WarrantyClaimStatus;
  action: string;
  actorId: string;
  actorType: string;
  reason?: string;
  createdAt: string;
}

export interface WarrantyClaimDto {
  id: string;
  claimCode: string;
  orderId: string;
  orderCode: string;
  orderItemId: string;
  customerId?: string;
  productId: string;
  skuId?: string;
  skuCode?: string;
  productName: string;
  issueType: WarrantyIssueType;
  description: string;
  serialNumber?: string;
  status: WarrantyClaimStatus;
  media: WarrantyClaimMediaDto[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminWarrantyClaimDetailDto extends WarrantyClaimDto {
  customerId: string;
  history: WarrantyClaimHistoryDto[];
}

export interface ReturnRequestMediaDto {
  id: string;
  mediaId: string;
  kind: WarrantyMediaKind;
  createdAt: string;
}

export interface ReturnRequestHistoryDto {
  id: string;
  fromStatus?: ReturnRequestStatus;
  toStatus: ReturnRequestStatus;
  action: string;
  actorId: string;
  actorType: string;
  reason?: string;
  createdAt: string;
}

export interface ReturnRequestDto {
  id: string;
  returnCode: string;
  orderId: string;
  orderCode: string;
  orderItemId: string;
  customerId?: string;
  productId: string;
  skuId?: string;
  skuCode?: string;
  productName: string;
  reason: ReturnReason;
  description: string;
  quantity: number;
  desiredResolution: DesiredResolution;
  status: ReturnRequestStatus;
  media: ReturnRequestMediaDto[];
  orderSyncedStatus?: string;
  orderSyncedAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminReturnRequestDetailDto extends ReturnRequestDto {
  customerId: string;
  history: ReturnRequestHistoryDto[];
}

/** Support ticket (support-service owned) */
export const supportTicketStatusSchema = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'WAITING_STAFF',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
]);
export type SupportTicketStatus = z.infer<typeof supportTicketStatusSchema>;

export const supportTicketCategorySchema = z.enum([
  'ORDER',
  'PRODUCT',
  'PAYMENT',
  'SHIPPING',
  'WARRANTY',
  'ACCOUNT',
  'OTHER',
]);
export type SupportTicketCategory = z.infer<typeof supportTicketCategorySchema>;

export const supportTicketPrioritySchema = z.enum([
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
]);
export type SupportTicketPriority = z.infer<typeof supportTicketPrioritySchema>;

export const supportMediaKindSchema = z.enum(['IMAGE']);
export type SupportMediaKind = z.infer<typeof supportMediaKindSchema>;

export const supportMessageAuthorTypeSchema = z.enum(['CUSTOMER', 'STAFF']);
export type SupportMessageAuthorType = z.infer<
  typeof supportMessageAuthorTypeSchema
>;

export const SUPPORT_LIMITS = {
  MAX_ATTACHMENTS: 5,
  SUBJECT_MIN: 5,
  SUBJECT_MAX: 200,
  DESCRIPTION_MIN: 10,
  DESCRIPTION_MAX: 5000,
  MESSAGE_MIN: 1,
  MESSAGE_MAX: 5000,
} as const;

export const createSupportTicketRequestSchema = z.object({
  category: supportTicketCategorySchema,
  subject: z
    .string()
    .trim()
    .min(SUPPORT_LIMITS.SUBJECT_MIN)
    .max(SUPPORT_LIMITS.SUBJECT_MAX),
  description: z
    .string()
    .trim()
    .min(SUPPORT_LIMITS.DESCRIPTION_MIN)
    .max(SUPPORT_LIMITS.DESCRIPTION_MAX),
  priority: supportTicketPrioritySchema.optional().default('NORMAL'),
  orderId: z.string().trim().min(1).max(120).optional(),
  warrantyClaimId: z.string().trim().min(1).max(120).optional(),
  returnRequestId: z.string().trim().min(1).max(120).optional(),
  mediaIds: z
    .array(z.string().trim().min(1).max(120))
    .max(SUPPORT_LIMITS.MAX_ATTACHMENTS)
    .optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type CreateSupportTicketRequest = z.infer<
  typeof createSupportTicketRequestSchema
>;

export const addSupportTicketMessageRequestSchema = z.object({
  content: z
    .string()
    .trim()
    .min(SUPPORT_LIMITS.MESSAGE_MIN)
    .max(SUPPORT_LIMITS.MESSAGE_MAX),
  mediaIds: z
    .array(z.string().trim().min(1).max(120))
    .max(SUPPORT_LIMITS.MAX_ATTACHMENTS)
    .optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type AddSupportTicketMessageRequest = z.infer<
  typeof addSupportTicketMessageRequestSchema
>;

export const attachSupportTicketMediaRequestSchema = z.object({
  mediaId: z.string().trim().min(1).max(120),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type AttachSupportTicketMediaRequest = z.infer<
  typeof attachSupportTicketMediaRequestSchema
>;

export const supportTicketTransitionActionSchema = z.enum([
  'start',
  'wait_customer',
  'resolve',
  'close',
  'reopen',
  'cancel',
]);
export type SupportTicketTransitionAction = z.infer<
  typeof supportTicketTransitionActionSchema
>;

export const transitionSupportTicketRequestSchema = z.object({
  action: supportTicketTransitionActionSchema,
  reason: z.string().trim().max(500).optional(),
  expectedVersion: z.coerce.number().int().min(0).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type TransitionSupportTicketRequest = z.infer<
  typeof transitionSupportTicketRequestSchema
>;

export const assignSupportTicketRequestSchema = z.object({
  assigneeId: z.string().trim().min(1).max(120),
  expectedVersion: z.coerce.number().int().min(0).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type AssignSupportTicketRequest = z.infer<
  typeof assignSupportTicketRequestSchema
>;

export const updateSupportTicketPriorityRequestSchema = z.object({
  priority: supportTicketPrioritySchema,
  expectedVersion: z.coerce.number().int().min(0).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type UpdateSupportTicketPriorityRequest = z.infer<
  typeof updateSupportTicketPriorityRequestSchema
>;

export const cancelSupportTicketRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  expectedVersion: z.coerce.number().int().min(0).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type CancelSupportTicketRequest = z.infer<
  typeof cancelSupportTicketRequestSchema
>;

export const listSupportTicketsQuerySchema = paginationQuerySchema.extend({
  status: supportTicketStatusSchema.optional(),
  category: supportTicketCategorySchema.optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});
export type ListSupportTicketsQuery = z.infer<
  typeof listSupportTicketsQuerySchema
>;

export const listAdminSupportTicketsQuerySchema = paginationQuerySchema.extend({
  status: supportTicketStatusSchema.optional(),
  category: supportTicketCategorySchema.optional(),
  priority: supportTicketPrioritySchema.optional(),
  customerId: z.string().trim().min(1).max(120).optional(),
  assigneeId: z.string().trim().min(1).max(120).optional(),
  orderId: z.string().trim().min(1).max(120).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});
export type ListAdminSupportTicketsQuery = z.infer<
  typeof listAdminSupportTicketsQuerySchema
>;

export interface SupportTicketAttachmentDto {
  id: string;
  mediaId: string;
  kind: SupportMediaKind;
  messageId?: string;
  createdAt: string;
}

export interface SupportTicketMessageDto {
  id: string;
  authorId: string;
  authorType: SupportMessageAuthorType;
  content: string;
  attachments: SupportTicketAttachmentDto[];
  createdAt: string;
}

export interface SupportTicketHistoryDto {
  id: string;
  fromStatus?: SupportTicketStatus;
  toStatus: SupportTicketStatus;
  action: string;
  actorId: string;
  actorType: string;
  reason?: string;
  createdAt: string;
}

export interface SupportTicketDto {
  id: string;
  ticketCode: string;
  customerId?: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  orderId?: string;
  warrantyClaimId?: string;
  returnRequestId?: string;
  assigneeId?: string;
  attachments: SupportTicketAttachmentDto[];
  messageCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketDetailDto extends SupportTicketDto {
  customerId: string;
  messages: SupportTicketMessageDto[];
  history: SupportTicketHistoryDto[];
}

export type AdminSupportTicketDetailDto = SupportTicketDetailDto;

/** In-app + email notification (notification-service owned) */
export const NotificationChannels = ['IN_APP', 'EMAIL'] as const;
export type NotificationChannel = (typeof NotificationChannels)[number];

export const NotificationCategories = [
  'IDENTITY',
  'ORDER',
  'PAYMENT',
  'SHIPPING',
  'REVIEW',
  'WARRANTY',
  'SUPPORT',
  'SYSTEM',
] as const;
export type NotificationCategory = (typeof NotificationCategories)[number];

export const EmailDeliveryStatuses = [
  'PENDING',
  'SENT',
  'FAILED',
  'SKIPPED',
] as const;
export type EmailDeliveryStatus = (typeof EmailDeliveryStatuses)[number];

export const NOTIFICATION_LIMITS = {
  titleMax: 200,
  bodyMax: 4000,
  linkUrlMax: 500,
  pageSizeMax: 100,
  defaultPageSize: 20,
} as const;

export const notificationChannelSchema = z.enum(NotificationChannels);
export const notificationCategorySchema = z.enum(NotificationCategories);
export const emailDeliveryStatusSchema = z.enum(EmailDeliveryStatuses);

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(NOTIFICATION_LIMITS.pageSizeMax)
    .default(NOTIFICATION_LIMITS.defaultPageSize),
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v === true || v === 'true',
    ),
  category: notificationCategorySchema.optional(),
});
export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;

export const requestNotificationSchema = z.object({
  userId: z.string().min(1).max(64).optional(),
  email: z.string().email().optional(),
  category: notificationCategorySchema.default('SYSTEM'),
  templateKey: z.string().min(1).max(100),
  title: z.string().min(1).max(NOTIFICATION_LIMITS.titleMax).optional(),
  body: z.string().min(1).max(NOTIFICATION_LIMITS.bodyMax).optional(),
  linkUrl: z.string().max(NOTIFICATION_LIMITS.linkUrlMax).optional(),
  channels: z
    .array(notificationChannelSchema)
    .min(1)
    .default(['IN_APP', 'EMAIL']),
  data: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});
export type RequestNotificationInput = z.infer<
  typeof requestNotificationSchema
>;

export interface InAppNotificationDto {
  id: string;
  userId: string;
  category: NotificationCategory;
  templateKey: string;
  title: string;
  body: string;
  linkUrl?: string;
  readAt?: string;
  createdAt: string;
}

export interface UnreadCountDto {
  count: number;
}

export interface EmailDeliveryDto {
  id: string;
  toEmail: string;
  userId?: string;
  templateKey: string;
  subject: string;
  status: EmailDeliveryStatus;
  attempts: number;
  lastError?: string;
  sentAt?: string;
  createdAt: string;
}

export interface RequestNotificationResultDto {
  inApp?: InAppNotificationDto;
  email?: EmailDeliveryDto;
}

/** ===================== Reporting (reporting-service owned) ===================== */

export const REPORTING_LIMITS = {
  pageSizeMax: 100,
  defaultPageSize: 20,
  actionMax: 120,
  actorIdMax: 120,
  resourceTypeMax: 60,
  resourceIdMax: 120,
  serviceNameMax: 60,
  statusMax: 40,
  idMax: 120,
} as const;

const reportingIdQuery = z.string().trim().min(1).max(REPORTING_LIMITS.idMax);
const reportingStatusQuery = z
  .string()
  .trim()
  .min(1)
  .max(REPORTING_LIMITS.statusMax);

export const listOrderProjectionsQuerySchema = paginationQuerySchema.extend({
  status: reportingStatusQuery.optional(),
  customerId: reportingIdQuery.optional(),
});
export type ListOrderProjectionsQuery = z.infer<
  typeof listOrderProjectionsQuerySchema
>;

export const listPaymentProjectionsQuerySchema = paginationQuerySchema.extend({
  status: reportingStatusQuery.optional(),
  orderId: reportingIdQuery.optional(),
});
export type ListPaymentProjectionsQuery = z.infer<
  typeof listPaymentProjectionsQuerySchema
>;

export const listShipmentProjectionsQuerySchema = paginationQuerySchema.extend({
  status: reportingStatusQuery.optional(),
  orderId: reportingIdQuery.optional(),
});
export type ListShipmentProjectionsQuery = z.infer<
  typeof listShipmentProjectionsQuerySchema
>;

export const listReviewProjectionsQuerySchema = paginationQuerySchema.extend({
  status: reportingStatusQuery.optional(),
  productId: reportingIdQuery.optional(),
});
export type ListReviewProjectionsQuery = z.infer<
  typeof listReviewProjectionsQuerySchema
>;

export const listWarrantyClaimProjectionsQuerySchema =
  paginationQuerySchema.extend({
    status: reportingStatusQuery.optional(),
    customerId: reportingIdQuery.optional(),
  });
export type ListWarrantyClaimProjectionsQuery = z.infer<
  typeof listWarrantyClaimProjectionsQuerySchema
>;

export const listWarrantyReturnProjectionsQuerySchema =
  paginationQuerySchema.extend({
    status: reportingStatusQuery.optional(),
    customerId: reportingIdQuery.optional(),
  });
export type ListWarrantyReturnProjectionsQuery = z.infer<
  typeof listWarrantyReturnProjectionsQuerySchema
>;

export const listSupportTicketProjectionsQuerySchema =
  paginationQuerySchema.extend({
    status: reportingStatusQuery.optional(),
    customerId: reportingIdQuery.optional(),
  });
export type ListSupportTicketProjectionsQuery = z.infer<
  typeof listSupportTicketProjectionsQuerySchema
>;

export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().max(REPORTING_LIMITS.actionMax).optional(),
  actorId: reportingIdQuery.optional(),
  resourceType: z
    .string()
    .trim()
    .max(REPORTING_LIMITS.resourceTypeMax)
    .optional(),
  resourceId: reportingIdQuery.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export const dailyMetricsQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  domain: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(REPORTING_LIMITS.pageSizeMax)
    .default(REPORTING_LIMITS.defaultPageSize),
});
export type DailyMetricsQuery = z.infer<typeof dailyMetricsQuerySchema>;

export const recordAuditRequestSchema = z.object({
  action: z.string().trim().min(1).max(REPORTING_LIMITS.actionMax),
  actorId: z.string().trim().max(REPORTING_LIMITS.actorIdMax).optional(),
  actorRoles: z.array(z.string().trim().max(40)).optional(),
  resourceType: z
    .string()
    .trim()
    .max(REPORTING_LIMITS.resourceTypeMax)
    .optional(),
  resourceId: z.string().trim().max(REPORTING_LIMITS.resourceIdMax).optional(),
  serviceName: z
    .string()
    .trim()
    .max(REPORTING_LIMITS.serviceNameMax)
    .optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});
export type RecordAuditRequest = z.infer<typeof recordAuditRequestSchema>;

export interface OrderProjectionDto {
  orderId: string;
  orderCode?: string;
  customerId?: string;
  status: string;
  grandTotal: number;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
  lastEventType?: string;
  lastEventId?: string;
}

export interface PaymentProjectionDto {
  paymentId: string;
  orderId?: string;
  status: string;
  amount: number;
  method?: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  lastEventType?: string;
}

export interface ShipmentProjectionDto {
  shipmentId: string;
  orderId?: string;
  status: string;
  carrierCode?: string;
  trackingCode?: string;
  createdAt: string;
  updatedAt: string;
  lastEventType?: string;
}

export interface ReviewProjectionDto {
  reviewId: string;
  productId?: string;
  customerId?: string;
  status: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  lastEventType?: string;
}

export interface WarrantyClaimProjectionDto {
  claimId: string;
  orderId?: string;
  customerId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastEventType?: string;
}

export interface WarrantyReturnProjectionDto {
  returnId: string;
  orderId?: string;
  customerId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastEventType?: string;
}

export interface SupportTicketProjectionDto {
  ticketId: string;
  ticketCode?: string;
  customerId?: string;
  status: string;
  priority?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
  lastEventType?: string;
}

export interface DailyMetricDto {
  id: string;
  metricDate: string;
  domain: string;
  metricKey: string;
  value: number;
}

export interface AuditLogProjectionDto {
  id: string;
  sourceEventId?: string;
  action: string;
  actorId?: string;
  actorRoles?: string[];
  resourceType?: string;
  resourceId?: string;
  serviceName?: string;
  details?: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface RecordAuditResultDto {
  auditLog: AuditLogProjectionDto;
}

export interface DashboardSummaryDto {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  totalRevenue: number;
  totalPayments: number;
  paymentsByStatus: Record<string, number>;
  totalShipments: number;
  shipmentsByStatus: Record<string, number>;
  totalReviews: number;
  reviewsByStatus: Record<string, number>;
  totalWarrantyClaims: number;
  warrantyClaimsByStatus: Record<string, number>;
  totalWarrantyReturns: number;
  warrantyReturnsByStatus: Record<string, number>;
  totalSupportTickets: number;
  supportTicketsByStatus: Record<string, number>;
  generatedAt: string;
}

/** Identity — admin users / roles */
export const identityUserStatusSchema = z.enum([
  'PENDING_VERIFICATION',
  'ACTIVE',
  'DISABLED',
]);

export const identityRoleSchema = z.enum([
  'Customer',
  'Staff',
  'Manager',
  'Admin',
  'SuperAdmin',
]);

export const listAdminUsersQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional(),
  status: identityUserStatusSchema.optional(),
  role: identityRoleSchema.optional(),
  sort: z
    .enum(['createdAt_desc', 'createdAt_asc', 'email_asc', 'email_desc'])
    .default('createdAt_desc'),
});
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

export const patchAdminUserRequestSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  status: identityUserStatusSchema.optional(),
  roles: z.array(identityRoleSchema).min(1).max(5).optional(),
  // Lab mass-assignment may also pass unexpected keys; Zod strips unknown by default
});
export type PatchAdminUserRequest = z.infer<typeof patchAdminUserRequestSchema>;

export interface AdminUserDto {
  id: string;
  email: string;
  fullName: string;
  status: z.infer<typeof identityUserStatusSchema>;
  roles: Array<z.infer<typeof identityRoleSchema>>;
  emailVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Lab-only leak when shapePublicResource is bypassed */
  passwordHash?: string;
  internalCost?: number;
}
