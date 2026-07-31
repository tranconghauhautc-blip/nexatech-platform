import { createHash, timingSafeEqual } from 'crypto';
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
 * Lab: treat any parts as safe (path traversal).
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

/**
 * SC-58 / API6 — Sensitive business flow abuse (checkout / refund spam).
 * Secure: enforce max per window.
 * Lab: always allow.
 */
export function allowSensitiveBusinessFlow(input: {
  recentCount: number;
  maxPerWindow: number;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: unrestricted access to sensitive business flows
    return true;
  }
  return input.recentCount < input.maxPerWindow;
}

const BLOCKED_SSRF_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
]);

function isPrivateOrLinkLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_SSRF_HOSTS.has(h)) return true;
  if (h.endsWith('.localhost')) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (h === '169.254.169.254' || /^169\.254\./.test(h)) return true;
  return false;
}

/**
 * SC-59 / API7 — True SSRF outbound URL resolution.
 * Secure: allowlist hosts + block private/link-local/metadata.
 * Lab: return requested URL unchanged (caller may fetch).
 */
export function resolveOutboundUrl(input: {
  requestedUrl: string;
  allowlistHosts: string[];
  env?: NodeJS.ProcessEnv;
}): { ok: true; url: string } | { ok: false; reason: string } {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: SSRF — trust caller-supplied URL
    return { ok: true, url: input.requestedUrl };
  }
  let parsed: URL;
  try {
    parsed = new URL(input.requestedUrl);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'protocol_not_allowed' };
  }
  if (isPrivateOrLinkLocalHostname(parsed.hostname)) {
    return { ok: false, reason: 'private_or_metadata_host' };
  }
  const allowed = input.allowlistHosts.map((h) => h.toLowerCase());
  if (!allowed.includes(parsed.hostname.toLowerCase())) {
    return { ok: false, reason: 'host_not_allowlisted' };
  }
  return { ok: true, url: parsed.toString() };
}

/**
 * SC-60 / API9 — Improper inventory / deprecated API exposure.
 * Secure: hide deprecated/shadow routes.
 * Lab: expose them.
 */
export function shouldExposeDeprecatedApi(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: expose deprecated / untracked API inventory
    return true;
  }
  return false;
}

/**
 * SC-61 / API10 — Unsafe consumption of upstream/provider payloads.
 * Secure: require schemaValid.
 * Lab: trust payload regardless.
 */
export function trustUpstreamPayload<T>(input: {
  payload: T;
  schemaValid: boolean;
  env?: NodeJS.ProcessEnv;
}): { accepted: boolean; payload: T } {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: trust partner/provider JSON without schema validation
    return { accepted: true, payload: input.payload };
  }
  return {
    accepted: input.schemaValid,
    payload: input.payload,
  };
}

/**
 * SC-62 / A03 — Software supply chain / artifact integrity.
 * Secure: require checksum (+ optional signature).
 * Lab: accept mismatched digests (fixture-only; no malware download).
 */
export function acceptArtifactIntegrity(input: {
  checksumValid: boolean;
  signatureValid?: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: skip artifact integrity verification
    return true;
  }
  if (!input.checksumValid) return false;
  if (input.signatureValid === false) return false;
  return true;
}

/**
 * SC-63 / A05 — Injection via ORDER BY / sort channel.
 * Secure: map to allowlisted SQL fragment.
 * Lab: concatenate raw user sort (demonstrator — do not execute DROP in PoC).
 */
export function buildOrderByClause(input: {
  requestedSort: string | undefined;
  allowlist: Record<string, string>;
  defaultKey: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const env = input.env ?? process.env;
  const requested = (input.requestedSort ?? '').trim();
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: SQL injection via unsanitized ORDER BY
    if (requested.length > 0 && !(requested in input.allowlist)) {
      return requested;
    }
  }
  if (requested && input.allowlist[requested]) {
    return input.allowlist[requested];
  }
  return input.allowlist[input.defaultKey] ?? Object.values(input.allowlist)[0];
}

/**
 * SC-66 / A04 — Cryptographic failures: secret comparison.
 * Secure: timing-safe equality.
 * Lab: plain === (and accept empty expected).
 */
export function compareSecrets(input: {
  provided: string;
  expected: string;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: weak / non-constant-time secret compare; empty expected accepted
    if (!input.expected) return true;
    return input.provided === input.expected;
  }
  const a = Buffer.from(input.provided);
  const b = Buffer.from(input.expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * SC-64 / A09 — Security logging / alerting failures.
 * Secure: emit audit for sensitive events.
 * Lab: suppress audit emission.
 */
export function shouldEmitSecurityAudit(input: {
  event: string;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: skip security audit / alerting
    return false;
  }
  return true;
}

/**
 * SC-65 / A10 — Mishandling exceptional conditions / error leakage.
 * Secure: generic details only.
 * Lab: attach stack / internal upstream URL.
 */
export function shapeErrorDetails(input: {
  secureDetails: Record<string, unknown>;
  error?: Error;
  internalUrl?: string;
  env?: NodeJS.ProcessEnv;
}): Record<string, unknown> {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: leak stack / internal dependency URL on errors
    return {
      ...input.secureDetails,
      stack: input.error?.stack,
      internalUrl: input.internalUrl,
      failOpenHint: true,
    };
  }
  return { ...input.secureDetails };
}

/**
 * SC-65 companion — fail-open when a dependency errors.
 * Secure: deny / closed.
 * Lab: allow.
 */
export function failOpenOnDependencyError(input: {
  dependencyFailed: boolean;
  env?: NodeJS.ProcessEnv;
}): 'allow' | 'deny' {
  const env = input.env ?? process.env;
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: fail-open when Redis/session/store errors
    return 'allow';
  }
  return input.dependencyFailed ? 'deny' : 'allow';
}

/**
 * SC-67 / API8 — Debug / management endpoint exposure.
 * Secure: hide.
 * Lab: expose.
 */
export function shouldExposeDebugEndpoint(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isSecurityLabEnabled(env)) {
    // INTENTIONAL: expose debug/management endpoints
    return true;
  }
  return false;
}

/** Fixture helper for A03 demos — hash bytes without loading remote packages. */
export function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
