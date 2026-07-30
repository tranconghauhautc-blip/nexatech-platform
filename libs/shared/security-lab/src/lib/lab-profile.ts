/**
 * Security-lab profile detection.
 *
 * Lab mode is enabled ONLY when BOTH are set:
 *   NEXATECH_SECURITY_LAB=1
 *   NEXATECH_DEPLOY_PROFILE=security-lab
 *
 * Production images/values must set:
 *   NEXATECH_SECURITY_LAB=0
 *   NEXATECH_DEPLOY_PROFILE=production
 *
 * Must NEVER be toggled by HTTP header/cookie/query/body.
 */
export function isSecurityLabEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env['NEXATECH_SECURITY_LAB'] === '1' &&
    env['NEXATECH_DEPLOY_PROFILE'] === 'security-lab'
  );
}

export function assertLabProfileOrThrow(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isSecurityLabEnabled(env)) {
    throw new Error(
      'Security lab feature requires NEXATECH_SECURITY_LAB=1 and NEXATECH_DEPLOY_PROFILE=security-lab',
    );
  }
}

export const LAB_MARKER_PATH = '/health/lab';
export const LAB_MARKER_BODY = {
  profile: 'security-lab',
  intentionalVulnerabilities: true,
  warning: 'Isolated lab only — not production',
} as const;
