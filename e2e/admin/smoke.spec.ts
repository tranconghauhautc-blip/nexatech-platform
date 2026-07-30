import { test, expect } from '@playwright/test';

test.describe('admin smoke & guard', () => {
  test('trang đăng nhập admin', async ({ page }) => {
    await page.goto('/dang-nhap');
    await expect(
      page.getByRole('heading', { name: /đăng nhập/i }),
    ).toBeVisible();
  });

  test('route guard chuyển về đăng nhập khi chưa auth', async ({ page }) => {
    await page.goto('/bang-dieu-khien');
    await expect(page).toHaveURL(/dang-nhap/);
  });

  test('robots disallow is present in markup path', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toMatch(/Disallow:\s*\//i);
  });
});
