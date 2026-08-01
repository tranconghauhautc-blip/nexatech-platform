import { test, expect } from '@playwright/test';
import { Roles } from '@nexatech/shared-auth';

/**
 * 4-role admin login/logout + RBAC smoke.
 * Requires seeded accounts and operator password:
 *   $env:E2E_DEV_SEED_PASSWORD="<same as DEV_SEED_PASSWORD>"
 *   $env:PLAYWRIGHT_SKIP_WEBSERVER="1"   # when using Docker Compose frontends
 */
const password = process.env.E2E_DEV_SEED_PASSWORD;

const ACCOUNTS = [
  {
    email: 'staff@nexatech.local',
    role: Roles.Staff,
    canProducts: false,
    canUsers: false,
    canAudit: false,
  },
  {
    email: 'manager@nexatech.local',
    role: Roles.Manager,
    canProducts: true,
    canUsers: false,
    canAudit: false,
  },
  {
    email: 'admin@nexatech.local',
    role: Roles.Admin,
    canProducts: true,
    canUsers: false,
    canAudit: true,
  },
  {
    email: 'superadmin@nexatech.local',
    role: Roles.SuperAdmin,
    canProducts: true,
    canUsers: true,
    canAudit: true,
  },
] as const;

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/dang-nhap');
  await page.getByLabel(/^email$/i).fill(email);
  await page.locator('input[type="password"]').fill(password as string);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await expect(page).toHaveURL(/bang-dieu-khien/, { timeout: 20_000 });
  // Ensure shell rendered (roles applied) — not a bounce back to login
  await expect(page.getByText('Admin Portal').first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page).not.toHaveURL(/dang-nhap/);
}

async function logout(page: import('@playwright/test').Page) {
  const logoutBtn = page.getByRole('button', { name: /đăng xuất|logout/i });
  if (await logoutBtn.count()) {
    await logoutBtn.first().click();
  } else {
    // Fallback: call logout API and clear cookies via navigation
    await page.request.post('/api/auth/logout');
    await page.goto('/bang-dieu-khien');
  }
  await expect(page).toHaveURL(/dang-nhap|unauthorized/, { timeout: 15_000 });
}

test.describe('admin 4-role login / RBAC', () => {
  test.skip(!password, 'Set E2E_DEV_SEED_PASSWORD to run seeded role smoke');

  for (const account of ACCOUNTS) {
    test(`${account.role} login, menu RBAC, logout`, async ({ page }) => {
      await login(page, account.email);

      // Staff must not see Manager+ product menu (href more stable than label)
      const products = page.locator('a[href="/san-pham"]');
      if (account.canProducts) {
        await expect(products.first()).toBeVisible({ timeout: 10_000 });
      } else {
        await expect(products).toHaveCount(0);
      }

      const users = page.locator('a[href="/nguoi-dung"]');
      if (account.canUsers) {
        await expect(users.first()).toBeVisible();
      } else {
        await expect(users).toHaveCount(0);
      }

      const audit = page.locator('a[href="/nhat-ky"]');
      if (account.canAudit) {
        await expect(audit.first()).toBeVisible();
      } else {
        await expect(audit).toHaveCount(0);
      }

      // Route guard: Staff/Admin cannot open SuperAdmin-only users page
      if (!account.canUsers) {
        await page.goto('/nguoi-dung');
        await expect(page).toHaveURL(/forbidden|dang-nhap|unauthorized/);
      }

      await logout(page);
      await page.goto('/bang-dieu-khien');
      await expect(page).toHaveURL(/dang-nhap|unauthorized/);
    });
  }

  test('Admin does not get SuperAdmin-only users menu by default', async ({
    page,
  }) => {
    test.skip(!password, 'seed password required');
    await login(page, 'admin@nexatech.local');
    await expect(page.locator('a[href="/nguoi-dung"]')).toHaveCount(0);
    await page.goto('/nguoi-dung');
    // Authenticated below role → /forbidden; missing session → /unauthorized
    await expect(page).toHaveURL(/forbidden|unauthorized/);
  });
});
