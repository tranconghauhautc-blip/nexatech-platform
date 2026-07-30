import {
  createCorrelationIds,
  createLogger,
  readCorrelationHeaders,
  readOpenTelemetryEnv,
  redactSensitiveData,
  resolveLogLevelFromEnv,
} from './shared-logging';

describe('shared-logging', () => {
  it('creates correlation ids and reads headers', () => {
    const ids = createCorrelationIds();
    expect(ids.requestId).toBeTruthy();
    expect(ids.traceId).toBeTruthy();

    const fromHeaders = readCorrelationHeaders({
      'x-request-id': 'r-1',
      'x-trace-id': 't-1',
    });
    expect(fromHeaders).toEqual({ requestId: 'r-1', traceId: 't-1' });
  });

  it('emits structured logs above min level', () => {
    const records: unknown[] = [];
    const logger = createLogger(
      { service: 'identity-service', requestId: 'r', traceId: 't' },
      {
        minLevel: 'info',
        sink: (record) => records.push(record),
      },
    );

    logger.debug('hidden');
    logger.info('visible', { userId: 'u-1' });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      level: 'info',
      message: 'visible',
      service: 'identity-service',
      requestId: 'r',
      traceId: 't',
      data: { userId: 'u-1' },
    });
  });

  it('redacts sensitive keys from log data', () => {
    const records: Array<{ data?: Record<string, unknown> }> = [];
    const logger = createLogger(
      { service: 'payment-service' },
      { sink: (record) => records.push(record) },
    );
    logger.info('pay', {
      password: 'secret',
      otp: '123456',
      vnp_SecureHash: 'abc',
      orderId: 'o-1',
    });
    expect(records[0].data).toEqual({
      password: '[REDACTED]',
      otp: '[REDACTED]',
      vnp_SecureHash: '[REDACTED]',
      orderId: 'o-1',
    });
    expect(redactSensitiveData({ accessToken: 'x' })).toEqual({
      accessToken: '[REDACTED]',
    });
  });

  it('reads log level and OTEL env without hard-coded hosts', () => {
    expect(resolveLogLevelFromEnv({ LOG_LEVEL: 'debug' })).toBe('debug');
    expect(resolveLogLevelFromEnv({})).toBe('info');
    const otel = readOpenTelemetryEnv({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-collector:4318',
      OTEL_SERVICE_NAME: 'identity-service',
    });
    expect(otel.enabled).toBe(true);
    expect(otel.endpoint).toBe('http://otel-collector:4318');
    expect(otel.serviceName).toBe('identity-service');
  });
});
