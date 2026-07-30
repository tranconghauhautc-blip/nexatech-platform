import { defineConfig, devices } from '@playwright/test';

const storefrontBase =
  process.env.PLAYWRIGHT_STOREFRONT_URL ?? 'http://127.0.0.1:3000';
const adminBase = process.env.PLAYWRIGHT_ADMIN_URL ?? 'http://127.0.0.1:3100';

const startLocal =
  process.env.PLAYWRIGHT_SKIP_WEBSERVER !== '1' &&
  !process.env.PLAYWRIGHT_STOREFRONT_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: startLocal
    ? [
        {
          command:
            'cross-env NX_SKIP_NATIVE_FILE_CACHE=true NX_DAEMON=false pnpm exec nx dev storefront-web --port=3000',
          url: storefrontBase,
          reuseExistingServer: true,
          timeout: 180_000,
        },
        {
          command:
            'cross-env NX_SKIP_NATIVE_FILE_CACHE=true NX_DAEMON=false ADMIN_SESSION_SECRET=change-me-admin-session-secret-min-16 JWT_ACCESS_SECRET=change-me-access-secret-min-32-chars pnpm exec nx dev admin-web --port=3100',
          url: adminBase,
          reuseExistingServer: true,
          timeout: 180_000,
        },
      ]
    : undefined,
  projects: [
    {
      name: 'storefront-chromium',
      testMatch: /storefront\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: storefrontBase,
      },
    },
    {
      name: 'admin-chromium',
      testMatch: /admin\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: adminBase,
      },
    },
    {
      name: 'storefront-mobile',
      testMatch: /storefront\/responsive\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        baseURL: storefrontBase,
      },
    },
  ],
});
