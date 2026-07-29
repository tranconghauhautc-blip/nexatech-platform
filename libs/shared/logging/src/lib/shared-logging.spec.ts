import {
  createCorrelationIds,
  createLogger,
  readCorrelationHeaders,
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
});
