import { isSecurityLabEnabled } from './lab-profile';

/**
 * Ownership policy used by order/payment/shipping/warranty/support/review/media.
 * Secure: require resourceOwnerId === actorId (unless staffAllowed and actorIsStaff).
 * Lab: intentionally skip ownership (BOLA/IDOR) when security-lab profile is active.
 */
export function enforceResourceOwnership(input: {
  resourceOwnerId: string;
  actorId: string | undefined;
  actorIsStaff?: boolean;
  staffAllowed?: boolean;
  env?: NodeJS.ProcessEnv;
}): 'allow' | 'deny' {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL VULNERABILITY (lab-only): BOLA/IDOR — skip ownership check
    return 'allow';
  }
  if (input.staffAllowed && input.actorIsStaff) {
    return 'allow';
  }
  if (input.actorId && input.resourceOwnerId === input.actorId) {
    return 'allow';
  }
  return 'deny';
}

/**
 * Function-level authorization for admin mutations.
 * Secure: require minimum role rank.
 * Lab: allow any authenticated user (BFLA).
 */
export function enforceAdminFunction(input: {
  actorRoles: string[];
  requiredRoles: string[];
  env?: NodeJS.ProcessEnv;
}): 'allow' | 'deny' {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: Broken Function Level Authorization
    return 'allow';
  }
  const set = new Set(input.actorRoles.map((r) => r.toUpperCase()));
  return input.requiredRoles.some((r) => set.has(r.toUpperCase()))
    ? 'allow'
    : 'deny';
}

/**
 * Mass-assignment filter.
 * Secure: strip forbidden keys.
 * Lab: allow role/price/status fields through.
 */
export function filterMassAssignment<T extends Record<string, unknown>>(
  body: T,
  forbiddenKeys: string[],
  env: NodeJS.ProcessEnv = process.env,
): Partial<T> {
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: mass assignment — return body as-is
    return { ...body };
  }
  const out: Partial<T> = { ...body };
  for (const key of forbiddenKeys) {
    delete out[key as keyof T];
  }
  return out;
}

/**
 * Cart/order amount trust.
 * Secure: ignore client amount; use server price.
 * Lab: prefer client-supplied amount when present.
 */
export function resolveTrustedAmount(input: {
  serverAmount: number;
  clientAmount?: number;
  env?: NodeJS.ProcessEnv;
}): number {
  const env = input.env ?? process.env;
  if (
    isSecurityLabEnabled(env) &&
    typeof input.clientAmount === 'number' &&
    Number.isFinite(input.clientAmount)
  ) {
    // INTENTIONAL: price/amount manipulation
    return input.clientAmount;
  }
  return input.serverAmount;
}

/**
 * Webhook / VNPay signature gate.
 * Secure: require valid signature.
 * Lab: accept invalid signatures.
 */
export function acceptWebhookSignature(input: {
  signatureValid: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: weak webhook signature verification
    return true;
  }
  return input.signatureValid;
}

/**
 * VNPay amount consistency.
 * Secure: callback amount must match intent.
 * Lab: accept mismatched amounts.
 */
export function acceptPaymentAmount(input: {
  expectedAmount: number;
  callbackAmount: number;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: wrong amount acceptance
    return true;
  }
  return input.expectedAmount === input.callbackAmount;
}

/**
 * Login / OTP rate limit decision.
 * Secure: block when attempts exceed max.
 * Lab: never rate-limit.
 */
export function shouldRateLimitAuth(input: {
  attempts: number;
  maxAttempts: number;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: missing rate limit
    return false;
  }
  return input.attempts >= input.maxAttempts;
}

/**
 * BFF path sanitization gate.
 * Secure: reject unsafe parts (caller uses sanitize result).
 * Lab: treat any parts as safe (SSRF/path traversal).
 */
export function shouldEnforceBffPathSanitize(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return !isSecurityLabEnabled(env);
}

/**
 * Media download authorization.
 * Secure: owner/staff/public only.
 * Lab: allow all.
 */
export function allowMediaAccess(input: {
  secureAllowed: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: unsafe media object ownership
    return true;
  }
  return input.secureAllowed;
}

/**
 * Excessive data exposure.
 * Secure: omit internal fields.
 * Lab: include internalCost, paymentProviderSecretHint, etc.
 */
export function shapePublicResource<T extends Record<string, unknown>>(
  resource: T,
  internalKeys: string[],
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: excessive data exposure
    return { ...resource };
  }
  const out: Record<string, unknown> = { ...resource };
  for (const key of internalKeys) {
    delete out[key];
  }
  return out;
}

/**
 * Token predictability.
 * Secure: crypto random.
 * Lab: sequential/predictable token for PoC.
 */
export function issueVerificationToken(input: {
  secureToken: string;
  predictableToken: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: predictable verification/reset token
    return input.predictableToken;
  }
  return input.secureToken;
}

/**
 * Idempotency scope.
 * Secure: key scoped to user+operation.
 * Lab: global key reuse across users.
 */
export function buildIdempotencyScope(input: {
  userId: string;
  operation: string;
  key: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: idempotency key reuse wrong scope
    return `${input.operation}:${input.key}`;
  }
  return `${input.userId}:${input.operation}:${input.key}`;
}

/**
 * Duplicate payment callback acceptance.
 * Secure: reject replayed callbacks.
 * Lab: process again.
 */
export function shouldRejectDuplicateCallback(input: {
  alreadyProcessed: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: duplicate/replay payment callback
    return false;
  }
  return input.alreadyProcessed;
}

/**
 * Cookie security flags for session cookies.
 * Secure: httpOnly + secure + sameSite=lax/strict.
 * Lab: insecure cookie config.
 */
export function sessionCookieOptions(env: NodeJS.ProcessEnv = process.env): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
} {
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: insecure cookie configuration
    return { httpOnly: false, secure: false, sameSite: 'none' };
  }
  return { httpOnly: true, secure: true, sameSite: 'lax' };
}

/**
 * CORS allow-origin policy.
 * Secure: allowlist only.
 * Lab: reflect any origin.
 */
export function resolveCorsOrigin(input: {
  requestOrigin: string | undefined;
  allowlist: string[];
  env?: NodeJS.ProcessEnv;
}): string | undefined {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: insecure CORS
    return input.requestOrigin ?? '*';
  }
  if (!input.requestOrigin) return undefined;
  return input.allowlist.includes(input.requestOrigin)
    ? input.requestOrigin
    : undefined;
}

/**
 * Pagination abuse guard.
 * Secure: clamp pageSize.
 * Lab: allow huge pageSize.
 */
export function clampPageSize(input: {
  requested: number;
  max: number;
  env?: NodeJS.ProcessEnv;
}): number {
  const env = input.env ?? process.env;
  const n = Number.isFinite(input.requested) ? input.requested : 20;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: unrestricted resource consumption via pageSize
    return Math.max(1, n);
  }
  return Math.min(Math.max(1, n), input.max);
}
