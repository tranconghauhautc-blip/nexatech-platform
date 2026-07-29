import {
  AppError,
  ErrorCodes,
  createErrorEnvelope,
  httpStatusForErrorCode,
  toErrorEnvelope,
} from './shared-errors';

describe('shared-errors', () => {
  it('builds a unified error envelope', () => {
    const envelope = createErrorEnvelope({
      errorCode: ErrorCodes.NOT_FOUND,
      message: 'Không tìm thấy sản phẩm',
      details: { productId: 'p1' },
      traceId: 'trace-1',
      timestamp: '2026-07-29T00:00:00.000Z',
    });

    expect(envelope).toEqual({
      errorCode: 'NOT_FOUND',
      message: 'Không tìm thấy sản phẩm',
      details: { productId: 'p1' },
      traceId: 'trace-1',
      timestamp: '2026-07-29T00:00:00.000Z',
    });
  });

  it('maps AppError to envelope and status', () => {
    const error = new AppError({
      errorCode: ErrorCodes.FORBIDDEN,
      message: 'Không có quyền truy cập',
      details: { role: 'Customer' },
      traceId: 't-2',
    });

    expect(error.httpStatus).toBe(403);
    expect(httpStatusForErrorCode(ErrorCodes.UNAUTHORIZED)).toBe(401);
    expect(toErrorEnvelope(error, 'fallback')).toMatchObject({
      errorCode: 'FORBIDDEN',
      traceId: 't-2',
      details: { role: 'Customer' },
    });
  });

  it('hides unknown error details behind INTERNAL_ERROR', () => {
    const envelope = toErrorEnvelope(new Error('boom'), 't-3');
    expect(envelope.errorCode).toBe(ErrorCodes.INTERNAL_ERROR);
    expect(envelope.message).toBe('Đã xảy ra lỗi hệ thống');
    expect(envelope.traceId).toBe('t-3');
  });
});
