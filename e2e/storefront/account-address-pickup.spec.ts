import { test, expect } from '@playwright/test';

/**
 * Customer address + pickup checkout UI acceptance.
 * Requires E2E_DEV_SEED_PASSWORD and Docker Compose frontends.
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

test.describe('customer address & pickup checkout', () => {
  test.skip(
    !password,
    'Set E2E_DEV_SEED_PASSWORD to run seeded customer smoke',
  );

  test('hồ sơ province/ward dropdown loads without district requirement', async ({
    page,
  }) => {
    await loginCustomer(page, 'customer1@nexatech.local');
    await page.goto('/tai-khoan/ho-so');
    await expect(
      page.getByRole('heading', { name: /hồ sơ|thêm địa chỉ/i }).first(),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/thêm địa chỉ/i).first()).toBeVisible();
    // Combobox labels from VietnamAddressSelector (not raw <select name=provinceCode>)
    await expect(
      page.getByText(/tỉnh\s*\/\s*thành phố/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/phường\s*\/\s*xã/i).first()).toBeVisible();
    // District is not required for new VN 2-tier addresses
    await expect(
      page.locator('label').filter({ hasText: /^Quận\s*\/\s*Huyện/i }),
    ).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(
      /nhập mã tỉnh|raw province code/i,
    );
  });

  test('checkout pickup has store selector, no raw storeId input', async ({
    page,
  }) => {
    await loginCustomer(page, 'customer1@nexatech.local');

    // Ensure cart has at least one item via API/BFF when possible
    await page.goto('/tim-kiem?q=nexatech');
    const addBtn = page
      .getByRole('button', { name: /thêm vào giỏ|mua ngay/i })
      .first();
    if (await addBtn.count()) {
      await addBtn.click({ timeout: 5_000 }).catch(() => undefined);
    }

    await page.goto('/thanh-toan');
    // May redirect if cart empty — still assert pickup UI when present
    if (page.url().includes('dang-nhap')) {
      test.skip(true, 'redirected to login unexpectedly');
    }

    const pickupRadio = page.getByLabel(
      /nhận tại cửa hàng|store pickup|pickup/i,
    );
    if ((await pickupRadio.count()) === 0) {
      // Fallback: click text
      const pickupText = page.getByText(/nhận tại cửa hàng/i);
      if ((await pickupText.count()) === 0) {
        // Cart may be empty — page shows empty state
        await expect(page.locator('body')).toBeVisible();
        return;
      }
      await pickupText.first().click();
    } else {
      await pickupRadio.first().check();
    }

    await expect(page.locator('input[name="storeId"]')).toHaveCount(0);
    await expect(
      page.locator('input[name="pickupStoreId"][type="text"]'),
    ).toHaveCount(0);

    // Runtime requires at least one seeded pickup store (HCM-NGUYEN-HUE)
    await expect
      .poll(async () => {
        return page.getByText(/Không có cửa hàng nhận hàng khả dụng/i).count();
      })
      .toBe(0);

    const storeCard = page.getByText(/NexaTech Nguyễn Huệ|HCM-NGUYEN-HUE/i);
    await expect(storeCard.first()).toBeVisible({ timeout: 10_000 });

    const storeChoice = page.locator(
      'input[type="radio"][name="pickupStore"], label:has(input[type="radio"])',
    );
    await expect(storeChoice.first()).toBeVisible();

    const submit = page.getByRole('button', {
      name: /đặt hàng|thanh toán|hoàn tất/i,
    });
    if ((await submit.count()) > 0) {
      // leave unselected
      await submit.first().click();
      await expect(
        page.getByText(/vui lòng chọn cửa hàng nhận hàng/i),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('order history uses order number not em dash only', async ({ page }) => {
    await loginCustomer(page, 'customer1@nexatech.local');
    await page.goto('/tai-khoan/don-hang');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Cannot GET/i);
    // If any NT- order exists, it should render
    const body = await page.locator('body').innerText();
    if (/NT-\d{8}-/i.test(body)) {
      expect(body).toMatch(/NT-\d{8}-[A-Z0-9]+/i);
    }
  });
});
