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
