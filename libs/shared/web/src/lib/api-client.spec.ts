import { ApiClient } from './api-client';
import { ApiError, ApiErrorCodes } from './api-error';

describe('ApiClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps error envelope', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () =>
        JSON.stringify({
          errorCode: 'VALIDATION_ERROR',
          message: 'Dữ liệu không hợp lệ',
          traceId: 't-1',
          timestamp: new Date().toISOString(),
        }),
    }) as unknown as typeof fetch;

    const client = new ApiClient({ baseUrl: 'http://example.test' });
    await expect(client.request('/x')).rejects.toMatchObject({
      errorCode: 'VALIDATION_ERROR',
      httpStatus: 400,
      message: 'Dữ liệu không hợp lệ',
    } satisfies Partial<ApiError>);
  });

  it('returns JSON on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    }) as unknown as typeof fetch;

    const client = new ApiClient({ baseUrl: 'http://example.test' });
    await expect(client.get<{ ok: boolean }>('/ok')).resolves.toEqual({
      ok: true,
    });
  });

  it('maps timeout', async () => {
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }) as unknown as typeof fetch;

    const client = new ApiClient({
      baseUrl: 'http://example.test',
      timeoutMs: 1,
    });
    await expect(client.get('/slow')).rejects.toMatchObject({
      errorCode: ApiErrorCodes.TIMEOUT,
    });
  });
});
