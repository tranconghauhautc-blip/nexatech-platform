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
