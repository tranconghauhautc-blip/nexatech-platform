import { Role } from '@nexatech/shared-auth';

export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'DISABLED';

export interface IdentityUser {
  id: string;
  email: string;
  emailVerifiedAt?: Date;
  status: UserStatus;
  fullName: string;
  passwordHash?: string;
  roles: Role[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  userAgent?: string;
  createdAt: Date;
}

export interface OtpChallenge {
  id: string;
  email: string;
  purpose: 'email_verify' | 'password_reset' | 'login';
  codeHash: string;
  expiresAt: Date;
  consumedAt?: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}
