import { createId } from '@nexatech/shared-platform';
import {
  AuthSession,
  IdentityUser,
  OtpChallenge,
  UserStatus,
} from './auth.types';
import { Role, Roles } from '@nexatech/shared-auth';

export interface IdentityStore {
  findUserByEmail(email: string): Promise<IdentityUser | null>;
  findUserById(id: string): Promise<IdentityUser | null>;
  createUser(input: {
    email: string;
    fullName: string;
    passwordHash: string;
    roles?: Role[];
    status?: UserStatus;
  }): Promise<IdentityUser>;
  updateUser(user: IdentityUser): Promise<IdentityUser>;
  createSession(input: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    userAgent?: string;
  }): Promise<AuthSession>;
  updateSession(session: AuthSession): Promise<AuthSession>;
  findSessionById(id: string): Promise<AuthSession | null>;
  listSessionsByUser(userId: string): Promise<AuthSession[]>;
  revokeSession(id: string): Promise<void>;
  createOtp(
    input: Omit<OtpChallenge, 'id' | 'consumedAt'>,
  ): Promise<OtpChallenge>;
  findLatestOtp(
    email: string,
    purpose: OtpChallenge['purpose'],
  ): Promise<OtpChallenge | null>;
  consumeOtp(id: string): Promise<void>;
}

export class InMemoryIdentityStore implements IdentityStore {
  private users = new Map<string, IdentityUser>();
  private usersByEmail = new Map<string, string>();
  private sessions = new Map<string, AuthSession>();
  private otps: OtpChallenge[] = [];

  async findUserByEmail(email: string): Promise<IdentityUser | null> {
    const id = this.usersByEmail.get(email.toLowerCase());
    return id ? (this.users.get(id) ?? null) : null;
  }

  async findUserById(id: string): Promise<IdentityUser | null> {
    return this.users.get(id) ?? null;
  }

  async createUser(input: {
    email: string;
    fullName: string;
    passwordHash: string;
    roles?: Role[];
    status?: UserStatus;
  }): Promise<IdentityUser> {
    const now = new Date();
    const user: IdentityUser = {
      id: createId(),
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      passwordHash: input.passwordHash,
      roles: input.roles ?? [Roles.Customer],
      status: input.status ?? 'PENDING_VERIFICATION',
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user.id);
    return user;
  }

  async updateUser(user: IdentityUser): Promise<IdentityUser> {
    const next = { ...user, updatedAt: new Date() };
    this.users.set(next.id, next);
    this.usersByEmail.set(next.email, next.id);
    return next;
  }

  async createSession(input: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    userAgent?: string;
  }): Promise<AuthSession> {
    const session: AuthSession = {
      id: createId(),
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
      userAgent: input.userAgent,
      createdAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async updateSession(session: AuthSession): Promise<AuthSession> {
    this.sessions.set(session.id, session);
    return session;
  }

  async findSessionById(id: string): Promise<AuthSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async listSessionsByUser(userId: string): Promise<AuthSession[]> {
    return [...this.sessions.values()].filter(
      (s) => s.userId === userId && !s.revokedAt,
    );
  }

  async revokeSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) {
      return;
    }
    this.sessions.set(id, { ...session, revokedAt: new Date() });
  }

  async createOtp(
    input: Omit<OtpChallenge, 'id' | 'consumedAt'>,
  ): Promise<OtpChallenge> {
    const otp: OtpChallenge = { ...input, id: createId() };
    this.otps.push(otp);
    return otp;
  }

  async findLatestOtp(
    email: string,
    purpose: OtpChallenge['purpose'],
  ): Promise<OtpChallenge | null> {
    const matches = this.otps
      .filter(
        (o) =>
          o.email === email.toLowerCase() &&
          o.purpose === purpose &&
          !o.consumedAt,
      )
      .sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime());
    return matches[0] ?? null;
  }

  async consumeOtp(id: string): Promise<void> {
    const idx = this.otps.findIndex((o) => o.id === id);
    if (idx >= 0) {
      this.otps[idx] = { ...this.otps[idx], consumedAt: new Date() };
    }
  }
}
