import { Roles } from '@nexatech/shared-auth';
import { filterMenuByRoles, ADMIN_MENU_ITEMS } from '../src/lib/menu';

describe('admin menu RBAC', () => {
  it('hides SuperAdmin users menu from Staff', () => {
    const items = filterMenuByRoles(ADMIN_MENU_ITEMS, [Roles.Staff]);
    expect(items.find((i) => i.href === '/nguoi-dung')).toBeUndefined();
    expect(items.find((i) => i.href === '/don-hang')).toBeDefined();
  });

  it('shows reporting for Manager+', () => {
    const staff = filterMenuByRoles(ADMIN_MENU_ITEMS, [Roles.Staff]);
    const manager = filterMenuByRoles(ADMIN_MENU_ITEMS, [Roles.Manager]);
    expect(staff.find((i) => i.href === '/bao-cao')).toBeUndefined();
    expect(manager.find((i) => i.href === '/bao-cao')).toBeDefined();
  });
});
