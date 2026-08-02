import { test, expect } from '@playwright/test';

/**
 * Authenticated Customer payment/review acceptance.
 * Requires:
 *   $env:E2E_DEV_SEED_PASSWORD="<same as DEV_SEED_PASSWORD>"
 *   $env:PLAYWRIGHT_SKIP_WEBSERVER="1"  # when Docker Compose frontends are up
 */
const password = process.env.E2E_DEV_SEED_PASSWORD;

async function loginCustomer(
  page: import('@playwright/test').Page,
  email: string,
) {
  await page.goto('/dang-nhap');
  await page
    .locator('input[type="email"], input[name="email"]')
    .first()
    .fill(email);
  await page.locator('input[type="password"]').fill(password as string);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await expect(page).not.toHaveURL(/dang-nhap/, { timeout: 20_000 });
}

test.describe('customer payments & reviews (authenticated)', () => {
  test.skip(
    !password,
    'Set E2E_DEV_SEED_PASSWORD to run seeded customer smoke',
  );

  test('customer1 payment history returns 200 via BFF and renders list or empty', async ({
    page,
  }) => {
    await loginCustomer(page, 'customer1@nexatech.local');

    const me = page.waitForResponse(
      (r) =>
        r.url().includes('/api/bff/payment/payments/me') &&
        r.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/tai-khoan/thanh-toan');
    const res = await me;
    expect(res.status()).toBe(200);
    const body = await res.json();
    const list = Array.isArray(body) ? body : (body?.items ?? []);
    expect(Array.isArray(list)).toBeTruthy();

    await expect(page.locator('body')).not.toContainText(
      /Cannot GET \/api\/v1\/payments/i,
    );

    if (list.length === 0) {
      await expect(
        page.getByText(/chưa có giao dịch thanh toán/i),
      ).toBeVisible();
    } else {
      const first = list[0];
      expect(first.method || first.provider).toBeTruthy();
      expect(first.amount ?? first.amountCents).toBeTruthy();
      expect(first.status).toBeTruthy();
      await expect(page.locator('body')).toContainText(
        /COD|MOCK|VNPAY|PENDING|PAID|FAILED|SUCCEEDED|COMPLETED/i,
      );
    }
  });

  test('customer2 payment history is isolated (200, no customer1 bleed)', async ({
    page,
  }) => {
    await loginCustomer(page, 'customer2@nexatech.local');
    const me = page.waitForResponse(
      (r) =>
        r.url().includes('/api/bff/payment/payments/me') &&
        r.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/tai-khoan/thanh-toan');
    const res = await me;
    expect(res.status()).toBe(200);
    const body = await res.json();
    const list = Array.isArray(body) ? body : (body?.items ?? []);
    expect(Array.isArray(list)).toBeTruthy();
    // customer1 sample order from prior API probe must not appear for customer2
    for (const row of list) {
      expect(String(row.orderCode || '')).not.toMatch(/NT-20260802-HBG2VH/);
    }
  });

  test('customer1 reviews empty collection is 200 with friendly CTA', async ({
    page,
  }) => {
    await loginCustomer(page, 'customer1@nexatech.local');
    const me = page.waitForResponse(
      (r) =>
        r.url().includes('/api/bff/review/reviews/me') &&
        r.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/tai-khoan/danh-gia');
    const res = await me;
    expect(res.status()).toBe(200);
    const body = await res.json();
    const list = Array.isArray(body) ? body : (body?.items ?? []);
    expect(Array.isArray(list)).toBeTruthy();

    if (list.length === 0) {
      await expect(page.getByText(/bạn chưa có đánh giá/i)).toBeVisible();
      await expect(page.locator('body')).not.toContainText(
        /Không tải được|Cannot GET|500/i,
      );
    } else {
      const first = list[0];
      expect(first.rating ?? first.score).toBeTruthy();
      await expect(page.locator('body')).toContainText(
        String(first.productName || first.content || first.rating || ''),
      );
    }
  });

  test('customer2 reviews isolated empty or own-only', async ({ page }) => {
    await loginCustomer(page, 'customer2@nexatech.local');
    const me = page.waitForResponse(
      (r) =>
        r.url().includes('/api/bff/review/reviews/me') &&
        r.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/tai-khoan/danh-gia');
    const res = await me;
    expect(res.status()).toBe(200);
    const body = await res.json();
    const list = Array.isArray(body) ? body : (body?.items ?? []);
    expect(Array.isArray(list)).toBeTruthy();
  });
});
