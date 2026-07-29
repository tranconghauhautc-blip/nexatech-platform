export type ErrorDetails = Record<string, unknown>;

export interface ErrorEnvelope {
  errorCode: string;
  message: string;
  details: ErrorDetails;
  traceId: string;
  timestamp: string;
}

export const ErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  CATALOG_PRODUCT_NOT_FOUND: 'CATALOG_PRODUCT_NOT_FOUND',
  CATALOG_CATEGORY_NOT_FOUND: 'CATALOG_CATEGORY_NOT_FOUND',
  CATALOG_BRAND_NOT_FOUND: 'CATALOG_BRAND_NOT_FOUND',
  CATALOG_SKU_NOT_FOUND: 'CATALOG_SKU_NOT_FOUND',
  CATALOG_SLUG_CONFLICT: 'CATALOG_SLUG_CONFLICT',
  MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND',
  MEDIA_FORBIDDEN: 'MEDIA_FORBIDDEN',
  MEDIA_INVALID_TYPE: 'MEDIA_INVALID_TYPE',
  MEDIA_TOO_LARGE: 'MEDIA_TOO_LARGE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes] | string;

const HTTP_STATUS_BY_CODE: Record<string, number> = {
  [ErrorCodes.VALIDATION_FAILED]: 400,
  [ErrorCodes.BAD_REQUEST]: 400,
  [ErrorCodes.MEDIA_INVALID_TYPE]: 400,
  [ErrorCodes.MEDIA_TOO_LARGE]: 400,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.MEDIA_FORBIDDEN]: 403,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.CATALOG_PRODUCT_NOT_FOUND]: 404,
  [ErrorCodes.CATALOG_CATEGORY_NOT_FOUND]: 404,
  [ErrorCodes.CATALOG_BRAND_NOT_FOUND]: 404,
  [ErrorCodes.CATALOG_SKU_NOT_FOUND]: 404,
  [ErrorCodes.MEDIA_NOT_FOUND]: 404,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.CATALOG_SLUG_CONFLICT]: 409,
  [ErrorCodes.RATE_LIMITED]: 429,
  [ErrorCodes.INTERNAL_ERROR]: 500,
};

export class AppError extends Error {
  readonly errorCode: ErrorCode;
  readonly details: ErrorDetails;
  readonly httpStatus: number;
  readonly traceId?: string;

  constructor(options: {
    errorCode: ErrorCode;
    message: string;
    details?: ErrorDetails;
    httpStatus?: number;
    traceId?: string;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'AppError';
    this.errorCode = options.errorCode;
    this.details = options.details ?? {};
    this.httpStatus =
      options.httpStatus ?? HTTP_STATUS_BY_CODE[options.errorCode] ?? 500;
    this.traceId = options.traceId;
  }
}

export function createErrorEnvelope(options: {
  errorCode: ErrorCode;
  message: string;
  details?: ErrorDetails;
  traceId: string;
  timestamp?: string;
}): ErrorEnvelope {
  return {
    errorCode: options.errorCode,
    message: options.message,
    details: options.details ?? {},
    traceId: options.traceId,
    timestamp: options.timestamp ?? new Date().toISOString(),
  };
}

export function toErrorEnvelope(
  error: unknown,
  traceId: string,
): ErrorEnvelope {
  if (error instanceof AppError) {
    return createErrorEnvelope({
      errorCode: error.errorCode,
      message: error.message,
      details: error.details,
      traceId: error.traceId ?? traceId,
    });
  }

  if (error instanceof Error) {
    return createErrorEnvelope({
      errorCode: ErrorCodes.INTERNAL_ERROR,
      message: 'Đã xảy ra lỗi hệ thống',
      details: { name: error.name },
      traceId,
    });
  }

  return createErrorEnvelope({
    errorCode: ErrorCodes.INTERNAL_ERROR,
    message: 'Đã xảy ra lỗi hệ thống',
    details: {},
    traceId,
  });
}

export function httpStatusForErrorCode(errorCode: ErrorCode): number {
  return HTTP_STATUS_BY_CODE[errorCode] ?? 500;
}
