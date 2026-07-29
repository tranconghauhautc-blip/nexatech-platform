import {
  Roles,
  canAccessAdminPortal,
  hasAnyRole,
  hasMinimumRole,
  hasRole,
  isRole,
  isStaff,
} from './shared-auth';

describe('shared-auth', () => {
  it('validates roles and membership', () => {
    expect(isRole('Admin')).toBe(true);
    expect(isRole('Guest')).toBe(false);
    expect(hasRole([Roles.Customer], Roles.Customer)).toBe(true);
    expect(hasAnyRole([Roles.Staff], [Roles.Manager, Roles.Staff])).toBe(true);
  });

  it('enforces role rank for admin operations', () => {
    expect(hasMinimumRole([Roles.Manager], Roles.Staff)).toBe(true);
    expect(hasMinimumRole([Roles.Staff], Roles.Admin)).toBe(false);
    expect(isStaff([Roles.Customer])).toBe(false);
    expect(canAccessAdminPortal([Roles.Admin])).toBe(true);
  });
});
