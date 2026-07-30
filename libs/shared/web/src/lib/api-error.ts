export interface ApiErrorDetails {
  [key: string]: unknown;
}

/** Envelope lỗi thống nhất trả về từ mọi backend NexaTech. */
export interface ApiErrorEnvelope {
  errorCode: string;
  message: string;
  details?: ApiErrorDetails;
  traceId: string;
  timestamp: string;
}

export function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record['errorCode'] === 'string' &&
    typeof record['message'] === 'string' &&
    typeof record['traceId'] === 'string'
  );
}

/** Lỗi phía client bao bọc envelope lỗi backend hoặc lỗi mạng/timeout. */
export class ApiError extends Error {
  readonly errorCode: string;
  readonly details: ApiErrorDetails;
  readonly traceId: string;
  readonly timestamp: string;
  readonly httpStatus: number;

  constructor(envelope: ApiErrorEnvelope, httpStatus: number) {
    super(envelope.message);
    this.name = 'ApiError';
    this.errorCode = envelope.errorCode;
    this.details = envelope.details ?? {};
    this.traceId = envelope.traceId;
    this.timestamp = envelope.timestamp;
    this.httpStatus = httpStatus;
  }

  toEnvelope(): ApiErrorEnvelope {
    return {
      errorCode: this.errorCode,
      message: this.message,
      details: this.details,
      traceId: this.traceId,
      timestamp: this.timestamp,
    };
  }
}

export const ApiErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
} as const;
