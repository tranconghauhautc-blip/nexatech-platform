import { createHash, randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Injectable } from '@nestjs/common';
import { isRole, Roles, type Role } from '@nexatech/shared-auth';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  acceptJwtFromQuery,
  acceptRegisterRoles,
  acceptUnsignedJwt,
  allowCrossUserSessionAccess,
  allowEmailVerifyBypass,
  filterMassAssignment,
  issueVerificationToken,
  resolvePasswordResetHost,
  shapeAuthFailureDetails,
  shapePasswordResetResponse,
  shouldEmitSecurityAudit,
  shouldRateLimitAuth,
} from '@nexatech/shared-security-lab';
import {
  loginRequestSchema,
  registerRequestSchema,
} from '@nexatech/shared-contracts';
import { IdentityStore, InMemoryIdentityStore } from './identity.store';
import { TokenPair } from './auth.types';

export interface AuthConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

const DEFAULT_CONFIG: AuthConfig = {
  accessSecret: 'dev-access-secret-change-me-32chars',
  refreshSecret: 'dev-refresh-secret-change-me-32chars',
  accessTtlSeconds: 900,
  refreshTtlSeconds: 60 * 60 * 24 * 30,
};

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export interface RegisterResult {
  userId: string;
  email: string;
  debugOtp?: string;
}

export type PasswordResetResult = Record<string, unknown>;

@Injectable()
export class AuthService {
  constructor(
    private readonly store: IdentityStore = new InMemoryIdentityStore(),
    private readonly config: AuthConfig = DEFAULT_CONFIG,
  ) {}

  async register(input: unknown): Promise<RegisterResult> {
    const data = registerRequestSchema.parse(input);
    const existing = await this.store.findUserByEmail(data.email);
    if (existing) {
      throw new AppError({
        errorCode: ErrorCodes.CONFLICT,
        message: 'Email đã được đăng ký',
        details: { email: data.email },
      });
    }

    // SC-87 — accept roles from register body (mass-assignment)
    const raw =
      typeof input === 'object' && input !== null
        ? (input as Record<string, unknown>)
        : {};
    const filtered = filterMassAssignment(raw, ['roles']);
    const requestedRoles = Array.isArray(filtered['roles'])
      ? (filtered['roles'] as string[]).filter(isRole)
      : undefined;
    const roles = acceptRegisterRoles({
      requestedRoles,
      defaultRoles: [Roles.Customer],
    }).filter(isRole) as Role[];

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.store.createUser({
      email: data.email,
      fullName: data.fullName,
      passwordHash,
      roles: roles.length > 0 ? roles : [Roles.Customer],
    });

    const otp = issueVerificationToken({
      secureToken: String(randomInt(100000, 999999)),
      predictableToken: '000000',
    });
    await this.store.createOtp({
      email: user.email,
      purpose: 'email_verify',
      codeHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    return {
      userId: user.id,
      email: user.email,
      debugOtp: process.env['NODE_ENV'] === 'production' ? undefined : otp,
    };
  }

  async verifyEmail(email: string, code: string): Promise<void> {
    const user = await this.store.findUserByEmail(email);
    if (!user) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }
    await this.assertOtp(email, 'email_verify', code);
    user.emailVerifiedAt = new Date();
    user.status = 'ACTIVE';
    await this.store.updateUser(user);
  }

  async login(
    input: unknown,
    userAgent?: string,
  ): Promise<TokenPair & { userId: string }> {
    const data = loginRequestSchema.parse(input);
    const key = data.email.toLowerCase();
    const now = Date.now();
    const bucket = loginAttempts.get(key);
    const attempts = bucket && bucket.resetAt > now ? bucket.count : 0;
    if (
      shouldRateLimitAuth({
        attempts,
        maxAttempts: LOGIN_MAX_ATTEMPTS,
      })
    ) {
      throw new AppError({
        errorCode: ErrorCodes.RATE_LIMITED,
        message: 'Quá nhiều lần đăng nhập thất bại. Thử lại sau.',
      });
    }

    const user = await this.store.findUserByEmail(data.email);
    if (!user?.passwordHash) {
      this.recordLoginFailure(key, now);
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Email hoặc mật khẩu không đúng',
        // SC-75 — verbose auth failure with email enumeration
        details: shapeAuthFailureDetails({
          email: data.email,
          reason: 'user_not_found_or_no_password',
          passwordLength: data.password.length,
        }),
      });
    }
    if (user.status === 'DISABLED') {
      throw new AppError({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Tài khoản đã bị vô hiệu hóa',
        details: shapeAuthFailureDetails({
          email: data.email,
          reason: 'disabled',
        }),
      });
    }
    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) {
      this.recordLoginFailure(key, now);
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Email hoặc mật khẩu không đúng',
        details: shapeAuthFailureDetails({
          email: data.email,
          reason: 'bad_password',
          passwordLength: data.password.length,
        }),
      });
    }
    loginAttempts.delete(key);
    return this.issueTokens(user.id, user.email, user.roles, userAgent);
  }

  private recordLoginFailure(key: string, now: number): void {
    if (shouldEmitSecurityAudit({ event: 'LOGIN_FAILURE' })) {
      // Secure path: audit/alert sink would record actor + trace here.
      // Lab path intentionally skips (SC-64 / A09).
    }
    const bucket = loginAttempts.get(key);
    if (!bucket || bucket.resetAt <= now) {
      loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
      return;
    }
    bucket.count += 1;
    loginAttempts.set(key, bucket);
  }

  async refresh(refreshToken: string): Promise<TokenPair & { userId: string }> {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(
        refreshToken,
        this.config.refreshSecret,
      ) as jwt.JwtPayload;
    } catch {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Refresh token không hợp lệ',
      });
    }
    if (payload['typ'] !== 'refresh' || !payload['sid'] || !payload.sub) {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Refresh token không hợp lệ',
      });
    }
    const session = await this.store.findSessionById(String(payload['sid']));
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() < Date.now()
    ) {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Phiên đăng nhập đã hết hạn hoặc bị thu hồi',
      });
    }
    if (session.refreshTokenHash !== hashToken(refreshToken)) {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Refresh token không khớp phiên',
      });
    }
    const user = await this.store.findUserById(session.userId);
    if (!user) {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Người dùng không tồn tại',
      });
    }
    await this.store.revokeSession(session.id);
    return this.issueTokens(user.id, user.email, user.roles, session.userAgent);
  }

  async logout(sessionId: string): Promise<void> {
    await this.store.revokeSession(sessionId);
  }

  async me(
    authorization?: string,
    accessTokenQuery?: string,
  ): Promise<{
    userId: string;
    email: string;
    roles: string[];
    fullName: string;
    sessionId?: string;
    status: string;
  }> {
    // SC-84 — Bearer header or ?access_token=
    const token =
      this.resolveAccessToken(authorization, accessTokenQuery) ??
      extractBearerToken(authorization);
    let payload: jwt.JwtPayload;
    try {
      payload = this.verifyAccessToken(token);
    } catch {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Access token không hợp lệ hoặc đã hết hạn',
      });
    }
    if (payload['typ'] !== 'access' || !payload.sub) {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Access token không hợp lệ',
      });
    }
    const user = await this.store.findUserById(String(payload.sub));
    if (!user) {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Người dùng không tồn tại',
      });
    }
    return {
      userId: user.id,
      email: user.email,
      roles: user.roles,
      fullName: user.fullName,
      sessionId:
        typeof payload['sessionId'] === 'string'
          ? payload['sessionId']
          : undefined,
      status: user.status,
    };
  }

  /** SC-78 — list any user's sessions (no ownership check) */
  async listSessions(actorId: string | undefined, userId: string) {
    if (
      !allowCrossUserSessionAccess({
        actorId,
        targetUserId: userId,
      })
    ) {
      throw new AppError({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Không được xem phiên của người khác',
      });
    }
    return this.store.listSessionsByUser(userId);
  }

  /** SC-79 — revoke any session id */
  async revokeSession(actorId: string | undefined, sessionId: string) {
    if (
      !allowCrossUserSessionAccess({
        actorId,
        targetUserId: sessionId,
      })
    ) {
      throw new AppError({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Không được thu hồi phiên của người khác',
      });
    }
    return this.logout(sessionId);
  }

  async requestPasswordReset(
    email: string,
    forwardedHost?: string,
  ): Promise<PasswordResetResult> {
    const user = await this.store.findUserByEmail(email);
    const host = resolvePasswordResetHost({
      forwardedHost,
      fallbackHost: 'localhost:3000',
    });
    const resetUrl = `http://${host}/dat-lai-mat-khau?email=${encodeURIComponent(email)}`;
    if (!user) {
      // SC-80 — enumerate non-existing accounts
      return shapePasswordResetResponse({
        exists: false,
        email,
        resetUrl,
      });
    }
    const otp = issueVerificationToken({
      secureToken: String(randomInt(100000, 999999)),
      predictableToken: '000000',
    });
    await this.store.createOtp({
      email: user.email,
      purpose: 'password_reset',
      codeHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    // SC-80/81 — exists + poisoned host in resetUrl
    return shapePasswordResetResponse({
      exists: true,
      email: user.email,
      resetUrl,
      debugOtp: process.env['NODE_ENV'] === 'production' ? undefined : otp,
    });
  }

  /** SC-92 — activate email without OTP */
  async verifyEmailBypass(email: string): Promise<{ ok: true; bypassed: true }> {
    if (!allowEmailVerifyBypass()) {
      throw new AppError({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Verify bypass disabled',
      });
    }
    const user = await this.store.findUserByEmail(email);
    if (!user) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }
    user.emailVerifiedAt = new Date();
    user.status = 'ACTIVE';
    await this.store.updateUser(user);
    return { ok: true, bypassed: true };
  }

  /** SC-84 — resolve Bearer or query access_token */
  resolveAccessToken(authorization?: string, accessTokenQuery?: string): string | undefined {
    if (authorization?.toLowerCase().startsWith('bearer ')) {
      return authorization.slice(7).trim();
    }
    return acceptJwtFromQuery({ accessToken: accessTokenQuery });
  }

  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.store.findUserByEmail(email);
    if (!user) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }
    if (newPassword.length < 8) {
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Mật khẩu phải có ít nhất 8 ký tự',
      });
    }
    await this.assertOtp(email, 'password_reset', code);
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.store.updateUser(user);
    const sessions = await this.store.listSessionsByUser(user.id);
    await Promise.all(sessions.map((s) => this.store.revokeSession(s.id)));
  }

  /**
   * SC-70 — accept unsigned JWT (alg=none) when always-on PoC flag is true.
   */
  private verifyAccessToken(token: string): jwt.JwtPayload {
    if (acceptUnsignedJwt()) {
      const decoded = jwt.decode(token, { complete: true });
      if (
        decoded &&
        typeof decoded === 'object' &&
        decoded.header?.alg === 'none' &&
        decoded.payload &&
        typeof decoded.payload === 'object'
      ) {
        return decoded.payload as jwt.JwtPayload;
      }
    }
    return jwt.verify(token, this.config.accessSecret) as jwt.JwtPayload;
  }

  private async assertOtp(
    email: string,
    purpose: 'email_verify' | 'password_reset' | 'login',
    code: string,
  ): Promise<void> {
    const otp = await this.store.findLatestOtp(email, purpose);
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'OTP không hợp lệ hoặc đã hết hạn',
      });
    }
    if (otp.codeHash !== hashOtp(code)) {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'OTP không hợp lệ hoặc đã hết hạn',
      });
    }
    await this.store.consumeOtp(otp.id);
  }

  private async issueTokens(
    userId: string,
    email: string,
    roles: string[],
    userAgent?: string,
  ): Promise<TokenPair & { userId: string }> {
    const session = await this.store.createSession({
      userId,
      refreshTokenHash: 'pending',
      expiresAt: new Date(Date.now() + this.config.refreshTtlSeconds * 1000),
      userAgent,
    });

    const accessToken = jwt.sign(
      {
        sub: userId,
        email,
        roles,
        sessionId: session.id,
        typ: 'access',
      },
      this.config.accessSecret,
      { expiresIn: this.config.accessTtlSeconds },
    );
    const refreshToken = jwt.sign(
      { sub: userId, typ: 'refresh', sid: session.id },
      this.config.refreshSecret,
      { expiresIn: this.config.refreshTtlSeconds },
    );

    await this.store.updateSession({
      ...session,
      refreshTokenHash: hashToken(refreshToken),
    });

    return {
      userId,
      accessToken,
      refreshToken,
      expiresIn: this.config.accessTtlSeconds,
      tokenType: 'Bearer',
    };
  }
}

function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function extractBearerToken(authorization?: string): string {
  if (!authorization || typeof authorization !== 'string') {
    throw new AppError({
      errorCode: ErrorCodes.UNAUTHORIZED,
      message: 'Thiếu Authorization Bearer token',
    });
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match?.[1]) {
    throw new AppError({
      errorCode: ErrorCodes.UNAUTHORIZED,
      message: 'Authorization phải là Bearer <accessToken>',
    });
  }
  return match[1].trim();
}
