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

/** Keys that must never appear in structured logs (token, password, OTP, payment signature, etc.). */
const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|authorization|api[_-]?key|otp|refresh|access[_-]?token|vnp[_-]?secure|hash[_-]?secret|signature|private[_-]?key|cookie|session)/i;

export function redactSensitiveData(
  input: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!input) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = '[REDACTED]';
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactSensitiveData(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}

/** Resolve min log level from env (LOG_LEVEL), default info. */
export function resolveLogLevelFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LogLevel {
  const raw = (env['LOG_LEVEL'] ?? 'info').toLowerCase();
  if (raw in LEVEL_WEIGHT) {
    return raw as LogLevel;
  }
  return 'info';
}

/** OpenTelemetry / collector env (no hard-coded production host). */
export function readOpenTelemetryEnv(env: NodeJS.ProcessEnv = process.env): {
  enabled: boolean;
  endpoint?: string;
  serviceName?: string;
  protocol?: string;
} {
  const endpoint = env['OTEL_EXPORTER_OTLP_ENDPOINT'];
  return {
    enabled: Boolean(endpoint) || env['OTEL_SDK_DISABLED'] === 'false',
    endpoint,
    serviceName: env['OTEL_SERVICE_NAME'],
    protocol: env['OTEL_EXPORTER_OTLP_PROTOCOL'] ?? 'http/protobuf',
  };
}

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
      data: redactSensitiveData({ ...rest, ...data }),
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
