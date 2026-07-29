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
