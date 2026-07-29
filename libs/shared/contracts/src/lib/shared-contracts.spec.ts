import {
  CATEGORY_SLUGS,
  createHealthResponse,
  createPaginatedResponse,
  loginRequestSchema,
  paginationQuerySchema,
  registerRequestSchema,
} from './shared-contracts';

describe('shared-contracts', () => {
  it('parses pagination with defaults and clamps pageSize', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationQuerySchema.parse({ page: '2', pageSize: '50' })).toEqual({
      page: 2,
      pageSize: 50,
    });
    expect(() => paginationQuerySchema.parse({ pageSize: 101 })).toThrow();
  });

  it('builds paginated and health responses', () => {
    const page = createPaginatedResponse([{ id: '1' }], 45, {
      page: 2,
      pageSize: 20,
    });
    expect(page.meta.totalPages).toBe(3);
    expect(createHealthResponse('catalog-service').status).toBe('ok');
  });

  it('validates auth payloads and category catalog scope', () => {
    expect(
      registerRequestSchema.parse({
        email: 'user@nexatech.vn',
        password: 'Secret123',
        fullName: 'Nguyễn Văn A',
      }).email,
    ).toBe('user@nexatech.vn');
    expect(() =>
      loginRequestSchema.parse({ email: 'bad', password: 'x' }),
    ).toThrow();
    expect(CATEGORY_SLUGS).toContain('dien-thoai');
    expect(CATEGORY_SLUGS).not.toContain('sim');
  });
});
