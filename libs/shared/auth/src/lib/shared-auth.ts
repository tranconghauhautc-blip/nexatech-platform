export const Roles = {
  Customer: 'Customer',
  Staff: 'Staff',
  Manager: 'Manager',
  Admin: 'Admin',
  SuperAdmin: 'SuperAdmin',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

const ROLE_RANK: Record<Role, number> = {
  Customer: 1,
  Staff: 2,
  Manager: 3,
  Admin: 4,
  SuperAdmin: 5,
};

export const STAFF_ROLES: readonly Role[] = [
  Roles.Staff,
  Roles.Manager,
  Roles.Admin,
  Roles.SuperAdmin,
];

export interface JwtAccessClaims {
  sub: string;
  email: string;
  roles: Role[];
  sessionId: string;
  typ: 'access';
}

export interface JwtRefreshClaims {
  sub: string;
  sessionId: string;
  typ: 'refresh';
}

export function isRole(value: unknown): value is Role {
  return (
    typeof value === 'string' && Object.values(Roles).includes(value as Role)
  );
}

export function hasRole(roles: readonly Role[], required: Role): boolean {
  return roles.includes(required);
}

export function hasAnyRole(
  roles: readonly Role[],
  required: readonly Role[],
): boolean {
  return required.some((role) => roles.includes(role));
}

export function hasMinimumRole(roles: readonly Role[], minimum: Role): boolean {
  const minimumRank = ROLE_RANK[minimum];
  return roles.some((role) => ROLE_RANK[role] >= minimumRank);
}

export function isStaff(roles: readonly Role[]): boolean {
  return hasAnyRole(roles, STAFF_ROLES);
}

export function canAccessAdminPortal(roles: readonly Role[]): boolean {
  return isStaff(roles);
}
