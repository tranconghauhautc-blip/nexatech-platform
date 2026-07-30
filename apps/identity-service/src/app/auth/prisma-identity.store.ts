import { Role } from '@nexatech/shared-auth';
import {
  AuthSession,
  IdentityUser,
  OtpChallenge,
  UserStatus,
} from './auth.types';
import { IdentityStore } from './identity.store';
import { PrismaService } from './prisma.service';

function mapUser(row: {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  status: string;
  fullName: string;
  passwordHash: string | null;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}): IdentityUser {
  return {
    id: row.id,
    email: row.email,
    emailVerifiedAt: row.emailVerifiedAt ?? undefined,
    status: row.status as UserStatus,
    fullName: row.fullName,
    passwordHash: row.passwordHash ?? undefined,
    roles: row.roles as Role[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSession(row: {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  device: { userAgent: string | null } | null;
}): AuthSession {
  return {
    id: row.id,
    userId: row.userId,
    refreshTokenHash: row.refreshTokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt ?? undefined,
    userAgent: row.device?.userAgent ?? undefined,
    createdAt: row.createdAt,
  };
}

function mapOtp(row: {
  id: string;
  email: string;
  purpose: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
}): OtpChallenge {
  return {
    id: row.id,
    email: row.email,
    purpose: row.purpose as OtpChallenge['purpose'],
    codeHash: row.codeHash,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt ?? undefined,
  };
}

export class PrismaIdentityStore implements IdentityStore {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<IdentityUser | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return row ? mapUser(row) : null;
  }

  async findUserById(id: string): Promise<IdentityUser | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? mapUser(row) : null;
  }

  async createUser(input: {
    email: string;
    fullName: string;
    passwordHash: string;
    roles?: Role[];
    status?: UserStatus;
  }): Promise<IdentityUser> {
    const row = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        passwordHash: input.passwordHash,
        roles: input.roles ?? ['Customer'],
        status: input.status ?? 'PENDING_VERIFICATION',
      },
    });
    return mapUser(row);
  }

  async updateUser(user: IdentityUser): Promise<IdentityUser> {
    const row = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.email.toLowerCase(),
        fullName: user.fullName,
        passwordHash: user.passwordHash ?? null,
        roles: user.roles,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt ?? null,
      },
    });
    return mapUser(row);
  }

  async createSession(input: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    userAgent?: string;
  }): Promise<AuthSession> {
    let deviceId: string | undefined;
    if (input.userAgent) {
      const device = await this.prisma.device.create({
        data: {
          userId: input.userId,
          userAgent: input.userAgent,
        },
      });
      deviceId = device.id;
    }
    const row = await this.prisma.session.create({
      data: {
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        deviceId,
      },
      include: { device: true },
    });
    return mapSession(row);
  }

  async updateSession(session: AuthSession): Promise<AuthSession> {
    const row = await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: session.refreshTokenHash,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt ?? null,
      },
      include: { device: true },
    });
    return mapSession(row);
  }

  async findSessionById(id: string): Promise<AuthSession | null> {
    const row = await this.prisma.session.findUnique({
      where: { id },
      include: { device: true },
    });
    return row ? mapSession(row) : null;
  }

  async listSessionsByUser(userId: string): Promise<AuthSession[]> {
    const rows = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      include: { device: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapSession);
  }

  async revokeSession(id: string): Promise<void> {
    try {
      await this.prisma.session.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
    } catch {
      // session missing — no-op (parity with in-memory store)
    }
  }

  async createOtp(
    input: Omit<OtpChallenge, 'id' | 'consumedAt'>,
  ): Promise<OtpChallenge> {
    const row = await this.prisma.otpChallenge.create({
      data: {
        email: input.email.toLowerCase(),
        purpose: input.purpose,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
      },
    });
    return mapOtp(row);
  }

  async findLatestOtp(
    email: string,
    purpose: OtpChallenge['purpose'],
  ): Promise<OtpChallenge | null> {
    const row = await this.prisma.otpChallenge.findFirst({
      where: {
        email: email.toLowerCase(),
        purpose,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    return row ? mapOtp(row) : null;
  }

  async consumeOtp(id: string): Promise<void> {
    await this.prisma.otpChallenge.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
}
