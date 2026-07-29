import {
  CORRELATION_HEADERS,
  createRequestId,
  createTraceId,
} from '@nexatech/shared-platform';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LogContext {
  service: string;
  requestId?: string;
  traceId?: string;
  [key: string]: unknown;
}

export interface StructuredLogRecord {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  requestId?: string;
  traceId?: string;
  data?: Record<string, unknown>;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
};

export function createCorrelationIds(input?: {
  requestId?: string;
  traceId?: string;
}): { requestId: string; traceId: string } {
  return {
    requestId: input?.requestId || createRequestId(),
    traceId: input?.traceId || createTraceId(),
  };
}

export function readCorrelationHeaders(
  headers: Record<string, string | string[] | undefined>,
): { requestId?: string; traceId?: string } {
  const read = (name: string): string | undefined => {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  return {
    requestId: read(CORRELATION_HEADERS.requestId),
    traceId: read(CORRELATION_HEADERS.traceId),
  };
}

export function createLogger(
  context: LogContext,
  options: {
    minLevel?: LogLevel;
    sink?: (record: StructuredLogRecord) => void;
  } = {},
) {
  const minLevel = options.minLevel ?? 'info';
  const sink =
    options.sink ??
    ((record: StructuredLogRecord) => {
      // Structured stdout for containers / log collectors.
      console.log(JSON.stringify(record));
    });

  const write = (
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
  ) => {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) {
      return;
    }
    const { service, requestId, traceId, ...rest } = context;
    sink({
      level,
      message,
      timestamp: new Date().toISOString(),
      service,
      requestId,
      traceId,
      data: { ...rest, ...data },
    });
  };

  return {
    child(extra: Record<string, unknown>) {
      return createLogger({ ...context, ...extra }, options);
    },
    fatal: (message: string, data?: Record<string, unknown>) =>
      write('fatal', message, data),
    error: (message: string, data?: Record<string, unknown>) =>
      write('error', message, data),
    warn: (message: string, data?: Record<string, unknown>) =>
      write('warn', message, data),
    info: (message: string, data?: Record<string, unknown>) =>
      write('info', message, data),
    debug: (message: string, data?: Record<string, unknown>) =>
      write('debug', message, data),
    trace: (message: string, data?: Record<string, unknown>) =>
      write('trace', message, data),
  };
}
