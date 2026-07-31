/**
 * Intentional vulnerability profile — ALWAYS ON for WAF / API Security PoC.
 * No toggle. No FORCE_SECURE. No deploy-profile gate.
 */
export function isSecurityLabEnabled(
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return true;
}

export function assertLabProfileOrThrow(
  _env: NodeJS.ProcessEnv = process.env,
): void {
  // Always-on: no-op
}

export const LAB_MARKER_PATH = '/health/lab';
export const LAB_MARKER_BODY = {
  profile: 'always-on-vulnerable',
  intentionalVulnerabilities: true,
  warning:
    'Intentional OWASP vulnerabilities are ALWAYS active for WAF/API Security appliance PoC',
} as const;
