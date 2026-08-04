import { test, expect } from '@playwright/test';

/**
 * Runtime acceptance: real COD store-pickup order for customer1.
 * Requires E2E_DEV_SEED_PASSWORD and Docker Compose frontends.
 */
const password = process.env.E2E_DEV_SEED_PASSWORD;

test.describe('pickup COD acceptance', () => {
  // Avoid racing authenticated-journeys COD on the same customer cart.
  test.describe.configure({ mode: 'serial' });
  test.skip(!password, 'needs E2E_DEV_SEED_PASSWORD');

  test('customer1 creates one COD pickup order at HCM-NGUYEN-HUE', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await page.goto('/dang-nhap');
    await page
      .locator('input[type="email"], input[name="email"]')
      .first()
      .fill('customer1@nexatech.local');
    await page.locator('input[type="password"]').fill(password as string);
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await expect(page).not.toHaveURL(/dang-nhap/, { timeout: 20_000 });

    await page.goto('/tai-khoan/don-hang');
    await expect(page.getByText(/đang tải đơn hàng/i)).toHaveCount(0, {
      timeout: 20_000,
    });
    await page.waitForTimeout(500);
    const beforeText = await page.locator('body').innerText();
    const beforeMatches = beforeText.match(/NT-\d{8}-[A-Z0-9]+/gi) || [];
    const beforeSet = new Set(beforeMatches.map((m) => m.toUpperCase()));

    await page.goto('/san-pham/dong-ho-nexatech-oppo-100');
    await expect(page.getByText(/còn hàng/i).first()).toBeVisible({
      timeout: 20_000,
    });
    const add = page.getByRole('button', { name: /thêm vào giỏ/i }).first();
    await expect(add).toBeEnabled({ timeout: 15_000 });
    await add.click();
    await expect(page.getByText(/đã thêm sản phẩm vào giỏ/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.goto('/thanh-toan');
    await expect(page).toHaveURL(/thanh-toan/, { timeout: 15_000 });
    await expect(
      page.getByRole('heading', { level: 1, name: /thanh toán/i }),
    ).toBeVisible({ timeout: 20_000 });
    const pickup = page.getByText(/nhận tại cửa hàng/i).first();
    await expect(pickup).toBeVisible({ timeout: 15_000 });
    await pickup.click();
    await expect(
      page.getByText(/Không có cửa hàng nhận hàng khả dụng/i),
    ).toHaveCount(0);
    await expect(page.locator('input[name="storeId"]')).toHaveCount(0);
    const store = page.getByText(/NexaTech Nguyễn Huệ|HCM-NGUYEN-HUE/i).first();
    await expect(store).toBeVisible({ timeout: 10_000 });
    await store.click();

    const cod = page.getByText(/^COD$|thanh toán khi nhận|tiền mặt/i).first();
    if ((await cod.count()) > 0) {
      await cod.click();
    }

    const submit = page
      .getByRole('button', { name: /đặt hàng|hoàn tất|thanh toán/i })
      .first();
    await expect(submit).toBeVisible();
    await submit.click();
    await expect(page).not.toHaveURL(/thanh-toan$/, { timeout: 30_000 });
    expect(page.url()).toMatch(/don-hang|tai-khoan|thanh-cong|success/i);

    await page.goto('/tai-khoan/don-hang');
    await expect(page.getByText(/đang tải đơn hàng/i)).toHaveCount(0, {
      timeout: 20_000,
    });
    await page.waitForTimeout(500);
    const afterText = await page.locator('body').innerText();
    const afterMatches = afterText.match(/NT-\d{8}-[A-Z0-9]+/gi) || [];
    const afterUnique = [...new Set(afterMatches.map((m) => m.toUpperCase()))];
    const newOrders = afterUnique.filter((n) => !beforeSet.has(n));
    expect(newOrders.length).toBeGreaterThanOrEqual(1);

    const detailLink = page.locator('a', { hasText: /^Chi tiết$/i }).first();
    await expect(detailLink).toBeVisible({ timeout: 10_000 });
    await detailLink.click();
    await expect(page).toHaveURL(/\/tai-khoan\/don-hang\/.+/, {
      timeout: 15_000,
    });
    await expect(
      page.getByText(/NexaTech Nguyễn Huệ|HCM-NGUYEN-HUE/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/02838221234/i).first()).toBeVisible();
    const detail = await page.locator('body').innerText();
    expect(detail).toMatch(/Nguyễn Huệ|địa chỉ|cửa hàng|Nhận tại/i);
    expect(detail).not.toMatch(/thiếu shipment|shipment bắt buộc|Cannot GET/i);

    await page.goto('/gio-hang');
    await page.waitForTimeout(1000);
    const cart = await page.locator('body').innerText();
    expect(cart).toMatch(/trống|không có sản phẩm|giỏ hàng trống|0 sản phẩm/i);

    await page.goto('/dang-xuat').catch(() => undefined);
    await page.goto('/dang-nhap');
    await page
      .locator('input[type="email"], input[name="email"]')
      .first()
      .fill('customer2@nexatech.local');
    await page.locator('input[type="password"]').fill(password as string);
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await expect(page).not.toHaveURL(/dang-nhap/, { timeout: 20_000 });
    await page.goto('/tai-khoan/don-hang');
    await page.waitForTimeout(1500);
    const c2 = await page.locator('body').innerText();
    for (const num of afterUnique) {
      if (!beforeMatches.includes(num)) {
        expect(c2).not.toContain(num);
      }
    }
  });
});
