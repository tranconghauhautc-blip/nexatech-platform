/**
 * M15 scaffold generator — writes storefront + admin + shared-web core files.
 * Run: node scripts/m15-scaffold.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r\n/g, '\n'), 'utf8');
  console.log('W', rel);
}

// ─── shared-web ───────────────────────────────────────────────
write(
  'libs/shared/web/project.json',
  `{
  "name": "shared-web",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/shared/web/src",
  "projectType": "library",
  "tags": ["scope:shared", "type:util", "scope:frontend"],
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "libs/shared/web/jest.config.ts",
        "passWithNoTests": true
      }
    }
  }
}
`,
);

write(
  'libs/shared/web/tsconfig.json',
  `{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.lib.json" }, { "path": "./tsconfig.spec.json" }]
}
`,
);

write(
  'libs/shared/web/tsconfig.lib.json',
  `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["jest.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"]
}
`,
);

write(
  'libs/shared/web/tsconfig.spec.json',
  `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "module": "commonjs",
    "types": ["jest", "node"]
  },
  "include": [
    "jest.config.ts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/**/*.d.ts"
  ]
}
`,
);

write(
  'libs/shared/web/jest.config.ts',
  `export default {
  displayName: 'shared-web',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/shared/web',
};
`,
);

write(
  'libs/shared/web/eslint.config.mjs',
  `import baseConfig from '../../../eslint.config.mjs';

export default [...baseConfig];
`,
);

write(
  'libs/shared/web/src/index.ts',
  `export * from './lib/format';
export * from './lib/api-client';
export * from './lib/service-urls';
export * from './lib/admin-menu';
`,
);

write(
  'libs/shared/web/src/lib/format.ts',
  `const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function formatVnd(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '—';
  }
  return vndFormatter.format(Math.round(amount));
}

export function formatDateTimeVn(
  value: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
    ...options,
  }).format(date);
}

export function formatDateVn(value: string | Date): string {
  return formatDateTimeVn(value, { dateStyle: 'medium', timeStyle: undefined });
}
`,
);

write(
  'libs/shared/web/src/lib/format.spec.ts',
  `import { formatDateTimeVn, formatVnd } from './format';

describe('formatVnd', () => {
  it('formats integer VND', () => {
    expect(formatVnd(1_990_000)).toMatch(/1\\.990\\.000/);
    expect(formatVnd(1_990_000)).toMatch(/₫|VND|đ/i);
  });

  it('handles non-finite', () => {
    expect(formatVnd(Number.NaN)).toBe('—');
  });
});

describe('formatDateTimeVn', () => {
  it('formats ISO in Vietnam timezone', () => {
    const text = formatDateTimeVn('2026-07-30T10:00:00.000Z');
    expect(text).not.toBe('—');
    expect(text.length).toBeGreaterThan(5);
  });
});
`,
);

write(
  'libs/shared/web/src/lib/api-client.ts',
  `export interface ErrorEnvelope {
  errorCode: string;
  message: string;
  details?: unknown;
  traceId?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  readonly errorCode: string;
  readonly status: number;
  readonly details?: unknown;
  readonly traceId?: string;
  readonly timestamp?: string;

  constructor(status: number, envelope: ErrorEnvelope) {
    super(envelope.message || 'Đã xảy ra lỗi');
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = envelope.errorCode || 'UNKNOWN_ERROR';
    this.details = envelope.details;
    this.traceId = envelope.traceId;
    this.timestamp = envelope.timestamp;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return \`nt-\${Date.now()}-\${Math.random().toString(16).slice(2)}\`;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly getHeaders?: ApiClientOptions['getHeaders'];

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.getHeaders = options.getHeaders;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    init?: RequestInit,
  ): Promise<T> {
    const requestId = createId();
    const traceId = createId();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'x-request-id': requestId,
      'x-trace-id': traceId,
      ...(await this.getHeaders?.()),
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(\`\${this.baseUrl}\${path}\`, {
        ...init,
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      const data = text ? (JSON.parse(text) as unknown) : null;
      if (!response.ok) {
        const envelope = (data ?? {
          errorCode: 'HTTP_ERROR',
          message: response.statusText || 'Yêu cầu thất bại',
        }) as ErrorEnvelope;
        throw new ApiError(response.status, envelope);
      }
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(408, {
          errorCode: 'REQUEST_TIMEOUT',
          message: 'Hết thời gian chờ phản hồi từ máy chủ',
          traceId,
        });
      }
      throw new ApiError(500, {
        errorCode: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Lỗi mạng',
        traceId,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  get<T>(path: string, init?: RequestInit) {
    return this.request<T>('GET', path, undefined, init);
  }

  post<T>(path: string, body?: unknown, init?: RequestInit) {
    return this.request<T>('POST', path, body, init);
  }

  patch<T>(path: string, body?: unknown, init?: RequestInit) {
    return this.request<T>('PATCH', path, body, init);
  }

  put<T>(path: string, body?: unknown, init?: RequestInit) {
    return this.request<T>('PUT', path, body, init);
  }

  delete<T>(path: string, init?: RequestInit) {
    return this.request<T>('DELETE', path, undefined, init);
  }
}

export function mapApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Đã xảy ra lỗi không xác định';
}
`,
);

write(
  'libs/shared/web/src/lib/api-client.spec.ts',
  `import { ApiClient, ApiError } from './api-client';

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
        }),
    }) as unknown as typeof fetch;

    const client = new ApiClient({ baseUrl: 'http://example.test' });
    await expect(client.get('/x')).rejects.toMatchObject({
      errorCode: 'VALIDATION_ERROR',
      status: 400,
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
});
`,
);

write(
  'libs/shared/web/src/lib/service-urls.ts',
  `export const BFF_SERVICE_ENV: Record<string, string> = {
  identity: 'IDENTITY_SERVICE_URL',
  customer: 'CUSTOMER_SERVICE_URL',
  catalog: 'CATALOG_SERVICE_URL',
  media: 'MEDIA_SERVICE_URL',
  inventory: 'INVENTORY_SERVICE_URL',
  cart: 'CART_SERVICE_URL',
  order: 'ORDER_SERVICE_URL',
  payment: 'PAYMENT_SERVICE_URL',
  shipping: 'SHIPPING_SERVICE_URL',
  review: 'REVIEW_SERVICE_URL',
  warranty: 'WARRANTY_SERVICE_URL',
  support: 'SUPPORT_SERVICE_URL',
  notification: 'NOTIFICATION_SERVICE_URL',
  reporting: 'REPORTING_SERVICE_URL',
};

export const DEFAULT_SERVICE_PORTS: Record<string, number> = {
  identity: 3001,
  customer: 3002,
  catalog: 3003,
  media: 3004,
  inventory: 3005,
  cart: 3006,
  order: 3007,
  payment: 3008,
  shipping: 3009,
  review: 3010,
  warranty: 3011,
  support: 3012,
  notification: 3013,
  reporting: 3014,
};

export function resolveServiceBaseUrl(service: string): string {
  const envKey = BFF_SERVICE_ENV[service];
  if (envKey) {
    const fromEnv = process.env[envKey];
    if (fromEnv && fromEnv.trim()) {
      return fromEnv.replace(/\\/$/, '');
    }
  }
  const port = DEFAULT_SERVICE_PORTS[service];
  if (!port) {
    throw new Error(\`Unknown BFF service: \${service}\`);
  }
  return \`http://127.0.0.1:\${port}\`;
}

export function getPublicApiBaseUrl(): string {
  return (
    process.env['NEXT_PUBLIC_API_BASE_URL']?.replace(/\\/$/, '') ||
    '/api/bff'
  );
}
`,
);

write(
  'libs/shared/web/src/lib/admin-menu.ts',
  `import {
  Roles,
  hasMinimumRole,
  type Role,
} from '@nexatech/shared-auth';

export interface AdminMenuItem {
  href: string;
  label: string;
  minimumRole: Role;
}

export const ADMIN_MENU_ITEMS: readonly AdminMenuItem[] = [
  { href: '/bang-dieu-khien', label: 'Bảng điều khiển', minimumRole: Roles.Staff },
  { href: '/san-pham', label: 'Sản phẩm', minimumRole: Roles.Staff },
  { href: '/danh-muc', label: 'Danh mục', minimumRole: Roles.Staff },
  { href: '/thuong-hieu', label: 'Thương hiệu', minimumRole: Roles.Staff },
  { href: '/thong-so', label: 'Thông số', minimumRole: Roles.Manager },
  { href: '/kho-hang', label: 'Tồn kho', minimumRole: Roles.Staff },
  { href: '/cua-hang-kho', label: 'Kho & cửa hàng', minimumRole: Roles.Staff },
  { href: '/don-hang', label: 'Đơn hàng', minimumRole: Roles.Staff },
  { href: '/thanh-toan', label: 'Thanh toán', minimumRole: Roles.Staff },
  { href: '/van-chuyen', label: 'Vận chuyển', minimumRole: Roles.Staff },
  { href: '/danh-gia', label: 'Đánh giá', minimumRole: Roles.Staff },
  { href: '/bao-hanh', label: 'Bảo hành / đổi trả', minimumRole: Roles.Staff },
  { href: '/ho-tro', label: 'Hỗ trợ', minimumRole: Roles.Staff },
  { href: '/thong-bao', label: 'Thông báo', minimumRole: Roles.Staff },
  { href: '/bao-cao', label: 'Báo cáo', minimumRole: Roles.Manager },
  { href: '/nhat-ky', label: 'Nhật ký audit', minimumRole: Roles.Manager },
  { href: '/media', label: 'Media', minimumRole: Roles.Staff },
  { href: '/nguoi-dung', label: 'Người dùng', minimumRole: Roles.SuperAdmin },
] as const;

export function filterAdminMenu(roles: readonly Role[]): AdminMenuItem[] {
  return ADMIN_MENU_ITEMS.filter((item) =>
    hasMinimumRole(roles, item.minimumRole),
  );
}
`,
);

write(
  'libs/shared/web/src/lib/admin-menu.spec.ts',
  `import { Roles } from '@nexatech/shared-auth';
import { filterAdminMenu } from './admin-menu';

describe('filterAdminMenu', () => {
  it('hides SuperAdmin-only items from Staff', () => {
    const items = filterAdminMenu([Roles.Staff]);
    expect(items.find((i) => i.href === '/nguoi-dung')).toBeUndefined();
    expect(items.find((i) => i.href === '/don-hang')).toBeDefined();
  });

  it('shows reporting for Manager+', () => {
    const staff = filterAdminMenu([Roles.Staff]);
    const manager = filterAdminMenu([Roles.Manager]);
    expect(staff.find((i) => i.href === '/bao-cao')).toBeUndefined();
    expect(manager.find((i) => i.href === '/bao-cao')).toBeDefined();
  });
});
`,
);

console.log('shared-web done');
