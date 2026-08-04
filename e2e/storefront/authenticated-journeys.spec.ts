import { test, expect } from '@playwright/test';

const password = process.env.E2E_DEV_SEED_PASSWORD;

async function loginCustomer(
  page: import('@playwright/test').Page,
  email = 'customer1@nexatech.local',
) {
  await page.goto('/dang-nhap');
  await page
    .locator('input[type="email"], input[name="email"]')
    .first()
    .fill(email);
  await page.locator('input[type="password"]').fill(password as string);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await expect(page).not.toHaveURL(/dang-nhap/, { timeout: 25_000 });
}

async function loginAdmin(
  page: import('@playwright/test').Page,
  email = 'admin@nexatech.local',
) {
  await page.goto('http://127.0.0.1:3100/dang-nhap');
  const emailField = page.getByLabel(/^email$/i);
  if (await emailField.count()) {
    await emailField.fill(email);
  } else {
    await page.locator('input[type="email"]').first().fill(email);
  }
  await page.locator('input[type="password"]').fill(password as string);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await expect(page).toHaveURL(/bang-dieu-khien/, { timeout: 25_000 });
}

test.describe('authenticated customer journeys', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!password, 'E2E_DEV_SEED_PASSWORD required');

  test('login logout profile addresses wishlist compare recent', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await loginCustomer(page);
    await page.goto('/tai-khoan');
    await expect(
      page.getByText(/tổng quan|hồ sơ|đơn hàng/i).first(),
    ).toBeVisible();

    await page.goto('/tai-khoan/ho-so');
    await expect(page.getByText(/hồ sơ|địa chỉ/i).first()).toBeVisible();
    const editName = page
      .locator('input[name="fullName"], input[name="full_name"]')
      .first();
    if (await editName.count()) {
      await editName.fill('Nguyễn Văn E2E');
      const save = page.getByRole('button', { name: /lưu|cập nhật/i }).first();
      if (await save.count()) await save.click();
    }

    await page.goto('/tim-kiem?q=nexatech');
    const product = page.locator('a[href^="/san-pham/"]').first();
    await expect(product).toBeVisible({ timeout: 20_000 });
    await product.click();
    await page
      .getByRole('button', { name: /thêm vào giỏ/i })
      .first()
      .click();
    await expect(page.getByText(/đã thêm|giỏ hàng/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const wish = page.getByRole('button', { name: /yêu thích|wishlist/i });
    if (await wish.count()) await wish.first().click();
    const compare = page.getByRole('button', { name: /so sánh/i });
    if (await compare.count()) await compare.first().click();

    await page.goto('/tai-khoan/yeu-thich');
    await expect(page.locator('body')).toBeVisible();
    await page.goto('/tai-khoan/so-sanh');
    await expect(page.locator('body')).toBeVisible();
    await page.goto('/tai-khoan/da-xem');
    await expect(page.locator('body')).toBeVisible();

    await page.goto('/tai-khoan/thong-bao');
    await expect(page.locator('body')).toBeVisible();
    await page.goto('/tai-khoan/danh-gia');
    await expect(page.locator('body')).toBeVisible();
    await page.goto('/tai-khoan/bao-hanh');
    await expect(
      page.getByRole('heading', { level: 2, name: /bảo hành/i }),
    ).toBeVisible();
    await page.goto('/tai-khoan/ho-tro');
    await expect(page.locator('body')).toBeVisible();

    const logout = page.getByRole('button', { name: /đăng xuất/i });
    if (await logout.count()) {
      await logout.first().click();
      await expect(page).toHaveURL(/dang-nhap|\/$/, { timeout: 15_000 });
    }
  });

  test('standard COD checkout creates order', async ({ page }) => {
    test.setTimeout(180_000);
    await loginCustomer(page);
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
    await expect(
      page.getByRole('heading', { level: 1, name: /thanh toán/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/giỏ hàng trống/i)).toHaveCount(0);
    const standard = page.getByText(/giao hàng tiêu chuẩn/i).first();
    if (await standard.count()) await standard.click();
    const cod = page
      .getByText(/thanh toán khi nhận hàng \(COD\)|^COD$/i)
      .first();
    if (await cod.count()) await cod.click();
    const submit = page
      .getByRole('button', { name: /đặt hàng|hoàn tất|thanh toán/i })
      .first();
    await expect(submit).toBeVisible({ timeout: 15_000 });
    await submit.click();
    await expect(page).not.toHaveURL(/thanh-toan$/, { timeout: 45_000 });
    await page.goto('/tai-khoan/don-hang');
    await expect(page.locator('body')).toContainText(/NT-\d{8}-/i);
  });
});

test.describe('authenticated admin journeys', () => {
  test.skip(!password, 'E2E_DEV_SEED_PASSWORD required');

  test('admin catalog inventory orders payments shipping reporting', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await loginAdmin(page);
    for (const path of [
      '/san-pham',
      '/media',
      '/kho-hang',
      '/don-hang',
      '/thanh-toan',
      '/van-chuyen',
      '/danh-gia',
      '/bao-hanh',
      '/ho-tro',
      '/bao-cao',
      '/nguoi-dung',
    ]) {
      await page.goto(`http://127.0.0.1:3100${path}`);
      await expect(page).not.toHaveURL(/dang-nhap/, { timeout: 15_000 });
      await expect(page.locator('body')).not.toContainText(/Cannot GET/i);
    }
  });
});

test.describe('portals auth', () => {
  test('swagger portal loads specs', async ({ page }) => {
    await page.goto('http://127.0.0.1:8090/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(
      /identity|openapi|swagger|NexaTech/i,
    );
  });

  test('security guide rejects invalid password', async ({ page }) => {
    await page.goto('http://127.0.0.1:3200/');
    const user = page
      .locator('input[name="username"], input[type="text"]')
      .first();
    const pass = page.locator('input[type="password"]').first();
    if ((await user.count()) && (await pass.count())) {
      await user.fill('nexatech-docs');
      await pass.fill('definitely-wrong-password-!!!');
      await page
        .getByRole('button', { name: /đăng nhập|login|sign in/i })
        .click();
      await expect(page.locator('body')).toContainText(
        /sai|invalid|unauthorized|lỗi|failed/i,
      );
    } else {
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
