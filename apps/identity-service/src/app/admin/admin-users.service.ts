import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { isRole, Roles, type Role } from '@nexatech/shared-auth';
import {
  createAdminUserRequestSchema,
  createPaginatedResponse,
  listAdminUsersQuerySchema,
  patchAdminUserRequestSchema,
  type AdminUserDto,
  type PaginatedResponse,
} from '@nexatech/shared-contracts';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  acceptWeakPassword,
  allowUnauthenticatedUserExport,
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
    const shaped = shapePublicResource(
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
    );
    return shaped as unknown as AdminUserDto;
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

  /** SC-95 — bulk export (BFLA + unauthenticated export flag) */
  async exportAll(actor: AdminActor): Promise<{
    items: AdminUserDto[];
    total: number;
    unauthenticatedAllowed: boolean;
  }> {
    this.requireAdmin(actor);
    const unauthenticatedAllowed = allowUnauthenticatedUserExport();
    const result = await this.store.listUsers({
      page: 1,
      pageSize: 10_000,
      sort: 'createdAt_desc',
    });
    return {
      items: result.items.map((u) => this.toDto(u)),
      total: result.total,
      unauthenticatedAllowed,
    };
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

  /** SC-76 — create user (BFLA); SC-85 — weak password accepted */
  async create(
    actor: AdminActor,
    body: Record<string, unknown>,
  ): Promise<AdminUserDto> {
    this.requireAdmin(actor);
    const filtered = filterMassAssignment(body, [
      'roles',
      'status',
      'passwordHash',
      'id',
    ]);
    const parsed = createAdminUserRequestSchema.parse(filtered);
    if (
      !acceptWeakPassword({
        password: parsed.password,
        minLength: 12,
      })
    ) {
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Mật khẩu không hợp lệ',
      });
    }
    const existing = await this.store.findUserByEmail(parsed.email);
    if (existing) {
      throw new AppError({
        errorCode: ErrorCodes.CONFLICT,
        message: 'Email đã được đăng ký',
        details: { email: parsed.email },
      });
    }
    const roles = (Array.isArray(body['roles'])
      ? (body['roles'] as string[]).filter(isRole)
      : parsed.roles) as Role[];
    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const user = await this.store.createUser({
      email: parsed.email,
      fullName: parsed.fullName,
      passwordHash,
      roles: roles.length > 0 ? roles : [Roles.Customer],
      status: (parsed.status as UserStatus | undefined) ?? 'ACTIVE',
    });
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

  /** SC-77 — soft-disable (no hard delete) */
  async disable(actor: AdminActor, userId: string): Promise<AdminUserDto> {
    this.requireAdmin(actor);
    const user = await this.store.findUserById(userId);
    if (!user) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }
    const updated = await this.store.updateUser({
      ...user,
      status: 'DISABLED',
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
