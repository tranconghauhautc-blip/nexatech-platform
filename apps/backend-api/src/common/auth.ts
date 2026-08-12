import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';

export type JwtPayload = {
  sub: string;
  username: string;
  role: string;
  typ?: string;
};

export type AuthUser = {
  id: string;
  username: string;
  role: string;
};

type AuthedRequest = {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  user?: AuthUser;
};

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) {
      throw new UnauthorizedException('Missing authentication');
    }
    return req.user;
  },
);

function getJwtSecret(): string {
  return process.env['JWT_SECRET'] || 'vulncart-insecure-dev-secret';
}

/**
 * LAB — Broken Authentication:
 * - accepts alg=none JWTs
 * - trusts spoofable x-user-id / x-user-role headers when present
 */
export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.decode(token, { complete: true });
  if (
    decoded &&
    typeof decoded === 'object' &&
    decoded.header?.alg === 'none' &&
    decoded.payload &&
    typeof decoded.payload === 'object'
  ) {
    return decoded.payload as JwtPayload;
  }
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '12h' });
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();

    // LAB: trust spoofable headers (Broken Authentication / BFLA helper)
    const headerUserId = String(req.headers['x-user-id'] ?? '').trim();
    const headerRole = String(req.headers['x-user-role'] ?? '').trim();
    if (headerUserId) {
      req.user = {
        id: headerUserId,
        username: String(req.headers['x-username'] ?? 'header-user'),
        role: headerRole || 'USER',
      };
      return true;
    }

    const auth = String(req.headers['authorization'] ?? '');
    const m = /^Bearer\s+(.+)$/i.exec(auth);
    if (!m) {
      throw new UnauthorizedException('Bearer token required');
    }
    try {
      const payload = verifyAccessToken(m[1]);
      req.user = {
        id: String(payload.sub),
        username: String(payload.username ?? ''),
        role: String(payload.role ?? 'USER'),
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const user = req.user;
    if (!user) throw new UnauthorizedException();

    // LAB — BFLA: role check is case-insensitive and accepts "admin" spoof via header
    const role = (user.role || '').toUpperCase();
    if (roles.map((r) => r.toUpperCase()).includes(role)) {
      return true;
    }

    // LAB: also allow if query ?asAdmin=1 (Broken Function Level Authorization)
    const q = req.query?.['asAdmin'];
    if (q === '1' || q === 'true') {
      return true;
    }

    throw new ForbiddenException('Insufficient role');
  }
}
