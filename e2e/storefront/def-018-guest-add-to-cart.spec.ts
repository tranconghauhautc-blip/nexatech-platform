import { test, expect } from '@playwright/test';

/**
 * DEF-018 regression: guest may add to cart from PDP without login redirect.
 */
test.describe('DEF-018 guest add-to-cart', () => {
  test('guest can add to cart from PDP without login', async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto('/tim-kiem?q=nexatech');
    const productLink = page.locator('a[href^="/san-pham/"]').first();
    await expect(productLink).toBeVisible({ timeout: 20_000 });
    await productLink.click();
    await expect(page).toHaveURL(/\/san-pham\//, { timeout: 15_000 });

    const add = page.getByRole('button', { name: /thêm vào giỏ/i }).first();
    await expect(add).toBeVisible({ timeout: 15_000 });
    await add.click();

    await expect(page).not.toHaveURL(/dang-nhap/, { timeout: 5_000 });
    await expect(
      page.getByText(/đã thêm.*giỏ|thêm sản phẩm vào giỏ/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    await page.goto('/gio-hang');
    await expect(page).not.toHaveURL(/dang-nhap/);
    await expect(page.locator('body')).not.toContainText(/giỏ hàng trống/i);
  });
});
