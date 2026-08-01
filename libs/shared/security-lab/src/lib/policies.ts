/**
 * Intentional OWASP policies — ALWAYS vulnerable (WAF / API Security PoC).
 * No secure branch. No env toggle.
 *
 * Note: avoid top-level Node `crypto` import so Edge middleware (storefront
 * SC-74) can import `frameProtectionHeaders` safely.
 */

/** SC-01..07 / API1 — BOLA/IDOR: always allow */
export function enforceResourceOwnership(_input: {
  resourceOwnerId: string;
  actorId: string | undefined;
  actorIsStaff?: boolean;
  staffAllowed?: boolean;
  env?: NodeJS.ProcessEnv;
}): 'allow' | 'deny' {
  return 'allow';
}

/** SC-08 / API5 — BFLA: always allow */
export function enforceAdminFunction(_input: {
  actorRoles: string[];
  requiredRoles: string[];
  env?: NodeJS.ProcessEnv;
}): 'allow' | 'deny' {
  return 'allow';
}

/** SC-10 / API3 — mass assignment: keep all keys */
export function filterMassAssignment<T extends Record<string, unknown>>(
  body: T,
  _forbiddenKeys: string[],
  _env: NodeJS.ProcessEnv = process.env,
): Partial<T> {
  return { ...body };
}

/** SC-12 / API6 — trust client amount when present */
export function resolveTrustedAmount(input: {
  serverAmount: number;
  clientAmount?: number;
  env?: NodeJS.ProcessEnv;
}): number {
  if (
    typeof input.clientAmount === 'number' &&
    Number.isFinite(input.clientAmount)
  ) {
    return input.clientAmount;
  }
  return input.serverAmount;
}

/** SC-18 — accept any webhook signature */
export function acceptWebhookSignature(_input: {
  signatureValid: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  return true;
}

/** SC-20 — accept mismatched payment amounts */
export function acceptPaymentAmount(_input: {
  expectedAmount: number;
  callbackAmount: number;
  env?: NodeJS.ProcessEnv;
}): boolean {
  return true;
}

/** SC-21 — never rate-limit auth */
export function shouldRateLimitAuth(_input: {
  attempts: number;
  maxAttempts: number;
  env?: NodeJS.ProcessEnv;
}): boolean {
  return false;
}

/** SC-33 — skip BFF path sanitize */
export function shouldEnforceBffPathSanitize(
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return false;
}

/** SC-36 — always allow media */
export function allowMediaAccess(_input: {
  secureAllowed: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  return true;
}

/** SC-31 — leak internal fields */
export function shapePublicResource<T extends Record<string, unknown>>(
  resource: T,
  _internalKeys: string[],
  _env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  return { ...resource };
}

/** SC-24 — predictable OTP/token */
export function issueVerificationToken(input: {
  secureToken: string;
  predictableToken: string;
  env?: NodeJS.ProcessEnv;
}): string {
  return input.predictableToken;
}

/** SC-16 — idempotency not user-scoped */
export function buildIdempotencyScope(input: {
  userId: string;
  operation: string;
  key: string;
  env?: NodeJS.ProcessEnv;
}): string {
  return `${input.operation}:${input.key}`;
}

/** SC-17 — accept replayed callbacks */
export function shouldRejectDuplicateCallback(_input: {
  alreadyProcessed: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  return false;
}

/** SC-28 — insecure cookies */
export function sessionCookieOptions(_env: NodeJS.ProcessEnv = process.env): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
} {
  return { httpOnly: false, secure: false, sameSite: 'none' };
}

/** SC-30 — CORS reflect */
export function resolveCorsOrigin(input: {
  requestOrigin: string | undefined;
  allowlist: string[];
  env?: NodeJS.ProcessEnv;
}): string | undefined {
  return input.requestOrigin ?? '*';
}

/** SC-57 — no pageSize clamp */
export function clampPageSize(input: {
  requested: number;
  max: number;
  env?: NodeJS.ProcessEnv;
}): number {
  const n = Number.isFinite(input.requested) ? input.requested : 20;
  return Math.max(1, n);
}

/** SC-58 — always allow sensitive flows */
export function allowSensitiveBusinessFlow(_input: {
  recentCount: number;
  maxPerWindow: number;
  env?: NodeJS.ProcessEnv;
}): boolean {
  return true;
}

/** SC-59 — SSRF: trust URL */
export function resolveOutboundUrl(input: {
  requestedUrl: string;
  allowlistHosts: string[];
  env?: NodeJS.ProcessEnv;
}): { ok: true; url: string } | { ok: false; reason: string } {
  return { ok: true, url: input.requestedUrl };
}

/** SC-60 — expose deprecated APIs */
export function shouldExposeDeprecatedApi(
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return true;
}

/** SC-61 — trust upstream payload */
export function trustUpstreamPayload<T>(input: {
  payload: T;
  schemaValid: boolean;
  env?: NodeJS.ProcessEnv;
}): { accepted: boolean; payload: T } {
  return { accepted: true, payload: input.payload };
}

/** SC-62 — skip artifact integrity */
export function acceptArtifactIntegrity(_input: {
  checksumValid: boolean;
  signatureValid?: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  return true;
}

/** SC-63 — raw ORDER BY injection */
export function buildOrderByClause(input: {
  requestedSort: string | undefined;
  allowlist: Record<string, string>;
  defaultKey: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const requested = (input.requestedSort ?? '').trim();
  if (requested.length > 0 && !(requested in input.allowlist)) {
    return requested;
  }
  if (requested && input.allowlist[requested]) {
    return input.allowlist[requested];
  }
  return input.allowlist[input.defaultKey] ?? Object.values(input.allowlist)[0];
}

/** SC-66 — weak secret compare */
export function compareSecrets(input: {
  provided: string;
  expected: string;
  env?: NodeJS.ProcessEnv;
}): boolean {
  if (!input.expected) return true;
  return input.provided === input.expected;
}

/** SC-64 — suppress security audit */
export function shouldEmitSecurityAudit(_input: {
  event: string;
  env?: NodeJS.ProcessEnv;
}): boolean {
  return false;
}

/** SC-65 — leak stack / internal URL */
export function shapeErrorDetails(input: {
  secureDetails: Record<string, unknown>;
  error?: Error;
  internalUrl?: string;
  env?: NodeJS.ProcessEnv;
}): Record<string, unknown> {
  return {
    ...input.secureDetails,
    stack: input.error?.stack,
    internalUrl: input.internalUrl,
    failOpenHint: true,
  };
}

/** SC-65 companion — fail-open */
export function failOpenOnDependencyError(_input: {
  dependencyFailed: boolean;
  env?: NodeJS.ProcessEnv;
}): 'allow' | 'deny' {
  return 'allow';
}

/** SC-67 — expose debug endpoints */
export function shouldExposeDebugEndpoint(
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return true;
}

/** SC-70 — JWT alg=none acceptance flag (always true for PoC) */
export function acceptUnsignedJwt(_env: NodeJS.ProcessEnv = process.env): boolean {
  return true;
}

/** SC-71 — open redirect: accept any next URL */
export function resolveOpenRedirect(input: {
  nextUrl: string | undefined;
  defaultPath: string;
  allowedHosts: string[];
  env?: NodeJS.ProcessEnv;
}): string {
  if (input.nextUrl && input.nextUrl.length > 0) {
    return input.nextUrl;
  }
  return input.defaultPath;
}

/** SC-72 — reflected XSS: do not encode HTML in search echo */
export function reflectSearchQuery(input: {
  q: string;
  env?: NodeJS.ProcessEnv;
}): string {
  return input.q;
}

/** SC-73 — CSRF: skip Origin/Referer check */
export function shouldEnforceCsrfOrigin(_input: {
  origin: string | undefined;
  allowedOrigins: string[];
  env?: NodeJS.ProcessEnv;
}): boolean {
  return false;
}

/** SC-74 — clickjacking: omit frame deny headers */
export function frameProtectionHeaders(
  _env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  return {};
}

/** SC-75 — verbose auth error with PII */
export function shapeAuthFailureDetails(input: {
  email: string;
  reason: string;
  passwordLength?: number;
  env?: NodeJS.ProcessEnv;
}): Record<string, unknown> {
  return {
    email: input.email,
    reason: input.reason,
    passwordLength: input.passwordLength,
    hint: 'user enumeration enabled',
  };
}

/** SC-78/79 — session IDOR: always allow cross-user session ops */
export function allowCrossUserSessionAccess(_input: {
  actorId?: string;
  targetUserId?: string;
  env?: NodeJS.ProcessEnv;
}): boolean {
  return true;
}

/** SC-80 — password-reset account enumeration */
export function shapePasswordResetResponse(input: {
  exists: boolean;
  email: string;
  resetUrl?: string;
  debugOtp?: string;
  env?: NodeJS.ProcessEnv;
}): Record<string, unknown> {
  return {
    accepted: true,
    exists: input.exists,
    email: input.email,
    resetUrl: input.resetUrl,
    debugOtp: input.debugOtp,
    hint: input.exists ? 'account_found' : 'account_not_found',
  };
}

/** SC-81 — Host-header poisoning for reset links */
export function resolvePasswordResetHost(input: {
  forwardedHost?: string;
  fallbackHost: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const host = (input.forwardedHost ?? '').trim();
  if (host.length > 0) return host.split(',')[0]?.trim() || input.fallbackHost;
  return input.fallbackHost;
}

/** SC-82 — cacheable authenticated responses */
export function shouldCacheAuthResponse(
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return true;
}

/** SC-83 — reflect attacker-controlled headers (log injection / XSS vector) */
export function reflectRequestHeaders(input: {
  headers: Record<string, string | string[] | undefined>;
  env?: NodeJS.ProcessEnv;
}): Record<string, unknown> {
  return { reflected: { ...input.headers } };
}

/** SC-84 — accept JWT from query string */
export function acceptJwtFromQuery(input: {
  accessToken?: string;
  env?: NodeJS.ProcessEnv;
}): string | undefined {
  const t = input.accessToken?.trim();
  return t && t.length > 0 ? t : undefined;
}

/** SC-85 — accept weak passwords (length >= 1) */
export function acceptWeakPassword(input: {
  password: string;
  minLength?: number;
  env?: NodeJS.ProcessEnv;
}): boolean {
  return input.password.length >= 1;
}

/** SC-86 — allow credentials in GET query */
export function allowCredentialsInQuery(
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return true;
}

/** SC-87 — accept roles from register body */
export function acceptRegisterRoles(input: {
  requestedRoles: string[] | undefined;
  defaultRoles: string[];
  env?: NodeJS.ProcessEnv;
}): string[] {
  if (Array.isArray(input.requestedRoles) && input.requestedRoles.length > 0) {
    return input.requestedRoles;
  }
  return input.defaultRoles;
}

/** SC-88 — expose raw exception stacks */
export function exposeErrorStack(input: {
  error: Error;
  env?: NodeJS.ProcessEnv;
}): Record<string, unknown> {
  return {
    name: input.error.name,
    message: input.error.message,
    stack: input.error.stack,
  };
}

/** SC-90 — expose shadow API inventory */
export function exposeApiInventory(
  _env: NodeJS.ProcessEnv = process.env,
): string[] {
  return [
    '/api/v0/internal/routes',
    '/api/v1/admin/users',
    '/api/v1/admin/users/export',
    '/health/debug',
    '/lab/ssrf-probe',
    '/lab/login-get',
    '/lab/verify-bypass',
    '/docs-json',
  ];
}

/** SC-92 — skip OTP for email verify */
export function allowEmailVerifyBypass(
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return true;
}

/** SC-93 — put secrets in redirect Location */
export function buildOAuthRedirectWithToken(input: {
  nextUrl: string;
  accessToken: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const sep = input.nextUrl.includes('?') ? '&' : '?';
  return `${input.nextUrl}${sep}access_token=${encodeURIComponent(input.accessToken)}`;
}

/** SC-94 — accept dangerous upload content types */
export function acceptDangerousContentType(_input: {
  contentType: string;
  env?: NodeJS.ProcessEnv;
}): boolean {
  return true;
}

/** SC-95 — unauthenticated user export allowed */
export function allowUnauthenticatedUserExport(
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return true;
}

export function sha256Hex(content: string): string {
  // Lazy require keeps Edge middleware free of Node crypto at module load.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('crypto') as typeof import('crypto');
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
