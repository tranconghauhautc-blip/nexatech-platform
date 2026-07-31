import { Injectable } from '@nestjs/common';
import { isRole, Roles, type Role } from '@nexatech/shared-auth';
import {
  createPaginatedResponse,
  listAdminUsersQuerySchema,
  patchAdminUserRequestSchema,
  type AdminUserDto,
  type PaginatedResponse,
} from '@nexatech/shared-contracts';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  clampPageSize,
  enforceAdminFunction,
  filterMassAssignment,
  shapePublicResource,
} from '@nexatech/shared-security-lab';
import { IdentityStore } from '../auth/identity.store';
import { IdentityUser, UserStatus } from '../auth/auth.types';

export interface AdminActor {
  userId?: string;
  roles: string[];
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly store: IdentityStore) {}

  /** SC-08 BFLA: enforceAdminFunction always allows — any role can call */
  private requireAdmin(actor: AdminActor): void {
    const decision = enforceAdminFunction({
      actorRoles: actor.roles,
      requiredRoles: [Roles.SuperAdmin],
    });
    if (decision === 'deny') {
      throw new AppError({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Không đủ quyền quản trị người dùng',
      });
    }
  }

  private toDto(user: IdentityUser): AdminUserDto {
    return shapePublicResource(
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
        roles: user.roles,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString(),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        passwordHash: user.passwordHash,
        internalCost: 42,
      },
      ['passwordHash', 'internalCost'],
    ) as AdminUserDto;
  }

  async list(
    actor: AdminActor,
    query: Record<string, unknown>,
  ): Promise<PaginatedResponse<AdminUserDto>> {
    this.requireAdmin(actor);
    const parsed = listAdminUsersQuerySchema.parse(query);
    const pageSize = clampPageSize({
      requested: parsed.pageSize,
      max: 100,
    });
    const result = await this.store.listUsers({
      q: parsed.q,
      status: parsed.status as UserStatus | undefined,
      role: parsed.role as Role | undefined,
      sort: parsed.sort,
      page: parsed.page,
      pageSize,
    });
    return createPaginatedResponse(
      result.items.map((u) => this.toDto(u)),
      result.total,
      { page: parsed.page, pageSize },
    );
  }

  async get(actor: AdminActor, userId: string): Promise<AdminUserDto> {
    this.requireAdmin(actor);
    const user = await this.store.findUserById(userId);
    if (!user) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }
    return this.toDto(user);
  }

  async patch(
    actor: AdminActor,
    userId: string,
    body: Record<string, unknown>,
  ): Promise<AdminUserDto> {
    this.requireAdmin(actor);
    const user = await this.store.findUserById(userId);
    if (!user) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }

    // SC-10 mass assignment — keep roles/status from body
    const filtered = filterMassAssignment(body, [
      'roles',
      'status',
      'passwordHash',
      'id',
      'email',
    ]);
    const parsed = patchAdminUserRequestSchema.parse(filtered);

    const nextRoles = Array.isArray(body['roles'])
      ? (body['roles'] as string[]).filter(isRole)
      : parsed.roles;
    const nextStatus =
      typeof body['status'] === 'string'
        ? (body['status'] as UserStatus)
        : parsed.status;

    const updated = await this.store.updateUser({
      ...user,
      fullName:
        typeof parsed['fullName'] === 'string'
          ? parsed['fullName']
          : user.fullName,
      status: nextStatus ?? user.status,
      roles: (nextRoles as Role[] | undefined) ?? user.roles,
    });
    return this.toDto(updated);
  }
}

export function parseAdminActor(
  userId?: string,
  rolesHeader?: string,
): AdminActor {
  const roles = (rolesHeader ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
  return { userId, roles };
}
