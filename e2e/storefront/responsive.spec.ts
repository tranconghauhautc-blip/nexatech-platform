import { test, expect } from '@playwright/test';

test.describe('storefront responsive', () => {
  test('header usable on mobile viewport', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('link', { name: /NexaTech/i }).first(),
    ).toBeVisible();
  });
});
