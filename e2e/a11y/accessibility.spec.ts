import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Full accessibility gate — fails on serious/critical axe violations.
 * Runs against live storefront/admin/swagger/security-guide.
 *
 * Third-party exclusions (documented):
 * - Swagger portal: `#swagger-ui` is swagger-ui-dist (uncontrolled nested-interactive /
 *   color-contrast / unlabeled controls). We still axe the wrapper header via
 *   `.include('body > header')` and `.exclude('#swagger-ui')`.
 */

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

type AxeScope = {
  /** CSS selectors to include (AxeBuilder.include). */
  include?: string[];
  /** CSS selectors to exclude (AxeBuilder.exclude) — third-party only. */
  exclude?: string[];
};

async function waitForStablePage(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const title = document.title?.trim() ?? '';
      const busy = document.querySelector('[aria-busy="true"]');
      return title.length > 0 && !busy;
    },
    undefined,
    { timeout: 20_000 },
  );
}

async function assertNoCriticalAxe(
  page: import('@playwright/test').Page,
  label: string,
  scope?: AxeScope,
) {
  await waitForStablePage(page);
  let builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
  ]);
  for (const sel of scope?.include ?? []) {
    builder = builder.include(sel);
  }
  for (const sel of scope?.exclude ?? []) {
    builder = builder.exclude(sel);
  }
  const results = await builder.analyze();
  const blocking = results.violations.filter((v) =>
    ['serious', 'critical'].includes(v.impact ?? ''),
  );
  expect(
    blocking,
    `${label}: ${blocking.map((v) => `${v.id}(${v.impact})`).join(', ')}`,
  ).toEqual([]);
}

test.describe('accessibility axe suite', () => {
  for (const vp of viewports) {
    test.describe(`${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('storefront home', async ({ page }) => {
        await page.goto('/');
        await assertNoCriticalAxe(page, `home@${vp.name}`);
      });

      test('storefront search listing', async ({ page }) => {
        await page.goto('/tim-kiem?q=nexatech');
        await assertNoCriticalAxe(page, `listing@${vp.name}`);
      });

      test('storefront login', async ({ page }) => {
        await page.goto('/dang-nhap');
        await assertNoCriticalAxe(page, `login@${vp.name}`);
      });

      test('storefront register', async ({ page }) => {
        await page.goto('/dang-ky');
        await assertNoCriticalAxe(page, `register@${vp.name}`);
      });

      test('storefront cart', async ({ page }) => {
        await page.goto('/gio-hang');
        await assertNoCriticalAxe(page, `cart@${vp.name}`);
      });

      test('admin login', async ({ page }) => {
        await page.goto('http://127.0.0.1:3100/dang-nhap');
        await assertNoCriticalAxe(page, `admin-login@${vp.name}`);
      });
    });
  }

  test('swagger portal', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:8090/');
    // Exclude third-party swagger-ui-dist; keep wrapper banner in scope.
    await assertNoCriticalAxe(page, 'swagger', {
      include: ['body > header'],
      exclude: ['#swagger-ui'],
    });
  });

  test('security guide login', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:3200/');
    await assertNoCriticalAxe(page, 'security-guide');
  });
});

test.describe('accessibility authenticated pages', () => {
  const password = process.env.E2E_DEV_SEED_PASSWORD;
  test.skip(!password, 'E2E_DEV_SEED_PASSWORD required');

  async function loginCustomer(page: import('@playwright/test').Page) {
    await page.goto('/dang-nhap');
    await page
      .locator('input[type="email"], input[name="email"]')
      .first()
      .fill('customer1@nexatech.local');
    await page.locator('input[type="password"]').fill(password as string);
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await expect(page).not.toHaveURL(/dang-nhap/, { timeout: 20_000 });
  }

  async function loginAdmin(page: import('@playwright/test').Page) {
    await page.goto('http://127.0.0.1:3100/dang-nhap');
    await page.getByLabel(/^email$/i).fill('admin@nexatech.local');
    await page.locator('input[type="password"]').fill(password as string);
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await expect(page).toHaveURL(/bang-dieu-khien/, { timeout: 20_000 });
  }

  const authPages = [
    { path: '/tai-khoan', label: 'account-overview' },
    { path: '/tai-khoan/ho-so', label: 'profile' },
    { path: '/tai-khoan/don-hang', label: 'orders' },
    { path: '/tai-khoan/danh-gia', label: 'reviews' },
    { path: '/tai-khoan/bao-hanh', label: 'warranty' },
    { path: '/tai-khoan/ho-tro', label: 'support' },
    { path: '/tai-khoan/thong-bao', label: 'notifications' },
    { path: '/thanh-toan', label: 'checkout' },
  ] as const;

  for (const p of authPages) {
    test(`customer ${p.label} desktop`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginCustomer(page);
      await page.goto(p.path);
      await assertNoCriticalAxe(page, p.label);
    });
  }

  test('product detail desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/san-pham/dong-ho-nexatech-oppo-100');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/còn hàng|tạm hết hàng/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole('button', { name: /thêm vào giỏ/i }).first(),
    ).toBeEnabled({ timeout: 20_000 });
    await assertNoCriticalAxe(page, 'pdp');
  });

  test('admin dashboard and orders', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAdmin(page);
    await assertNoCriticalAxe(page, 'admin-dashboard');
    await page.goto('http://127.0.0.1:3100/don-hang');
    await assertNoCriticalAxe(page, 'admin-orders');
  });
});
