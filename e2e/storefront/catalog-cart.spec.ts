import { test, expect } from '@playwright/test';

test.describe('storefront listing & cart', () => {
  test('danh mục hoặc tìm kiếm render trạng thái hợp lệ', async ({ page }) => {
    await page.goto('/tim-kiem?q=nexatech');
    const body = page.locator('body');
    await expect(body).toBeVisible();
    // Accept product grid, empty, or error — never blank crash
    await expect(body).not.toHaveText(/Application error/i);
  });

  test('checkout page loads without voucher UI', async ({ page }) => {
    await page.goto('/thanh-toan');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/voucher|flash sale/i);
  });
});
