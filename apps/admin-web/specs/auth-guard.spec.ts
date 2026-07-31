import { Roles } from '@nexatech/shared-auth';
import {
  decideAdminAccess,
  isSecurityLabUiEnabled,
  minimumRoleForPath,
} from '../src/lib/auth-guard';

describe('decideAdminAccess', () => {
  const staffSession = {
    userId: 'u1',
    email: 'staff@nexatech.local',
    roles: [Roles.Staff],
    accessToken: 'x',
    refreshToken: 'y',
    sessionId: 's1',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  };

  it('redirects anonymous users on protected routes to unauthorized', () => {
    const d = decideAdminAccess(null, '/nguoi-dung');
    expect(d.action).toBe('redirect');
    if (d.action === 'redirect') {
      expect(d.destination).toContain('/unauthorized');
    }
  });

  it('allows public unauthorized and forbidden pages', () => {
    expect(decideAdminAccess(null, '/unauthorized').action).toBe('allow');
    expect(decideAdminAccess(null, '/forbidden').action).toBe('allow');
  });

  it('blocks Staff from SuperAdmin users page', () => {
    const d = decideAdminAccess(staffSession, '/nguoi-dung');
    expect(d.action).toBe('redirect');
    if (d.action === 'redirect') {
      expect(d.destination).toContain('/forbidden');
    }
  });

  it('allows Staff dashboard', () => {
    expect(decideAdminAccess(staffSession, '/bang-dieu-khien').action).toBe(
      'allow',
    );
  });

  it('always allows security-lab UI (always-on vulnerable PoC)', () => {
    expect(isSecurityLabUiEnabled()).toBe(true);
    expect(decideAdminAccess(staffSession, '/security-lab').action).toBe(
      'allow',
    );
  });

  it('maps menu paths to minimum roles', () => {
    expect(minimumRoleForPath('/nguoi-dung')).toBe(Roles.SuperAdmin);
    expect(minimumRoleForPath('/san-pham')).toBe(Roles.Manager);
    expect(minimumRoleForPath('/kho-hang')).toBe(Roles.Staff);
  });
});
