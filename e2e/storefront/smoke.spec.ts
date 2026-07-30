import { test, expect } from '@playwright/test';

test.describe('storefront smoke', () => {
  test('trang chủ hiển thị thương hiệu NexaTech', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.ok() || response?.status() === 200).toBeTruthy();
    await expect(
      page.getByRole('link', { name: /NexaTech/i }).first(),
    ).toBeVisible();
  });

  test('điều hướng đăng nhập', async ({ page }) => {
    await page.goto('/dang-nhap');
    await expect(
      page.getByRole('heading', { name: /đăng nhập/i }),
    ).toBeVisible();
    await expect(
      page.locator('input[type="email"], input[name="email"]').first(),
    ).toBeVisible();
  });

  test('giỏ hàng guest mở được', async ({ page }) => {
    await page.goto('/gio-hang');
    await expect(
      page.getByRole('heading', { name: /giỏ hàng/i }),
    ).toBeVisible();
  });

  test('tìm kiếm có URL shareable', async ({ page }) => {
    await page.goto('/tim-kiem?q=iphone');
    await expect(page).toHaveURL(/tim-kiem/);
    await expect(page.locator('#nt-main-content')).toBeVisible();
  });
});
