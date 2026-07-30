import { Roles } from '@nexatech/shared-auth';
import { filterAdminMenu } from './admin-menu';

describe('filterAdminMenu', () => {
  it('hides SuperAdmin-only items from Staff', () => {
    const items = filterAdminMenu([Roles.Staff]);
    expect(items.find((i) => i.href === '/nguoi-dung')).toBeUndefined();
    expect(items.find((i) => i.href === '/don-hang')).toBeDefined();
  });

  it('shows reporting for Manager+', () => {
    const staff = filterAdminMenu([Roles.Staff]);
    const manager = filterAdminMenu([Roles.Manager]);
    expect(staff.find((i) => i.href === '/bao-cao')).toBeUndefined();
    expect(manager.find((i) => i.href === '/bao-cao')).toBeDefined();
  });
});
