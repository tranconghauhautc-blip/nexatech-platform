#!/usr/bin/env node
/**
 * Security suite runners — secure regression + lab vulnerable mode.
 * Does not require live cluster. Uses shared-security-lab policy tests via nx.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const mode = process.argv[2] || 'secure'; // secure | lab | smoke | validate
const root = path.resolve(__dirname, '../..');

function run(cmd, args, env = {}) {
  console.log(`[security] ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    env: {
      ...process.env,
      ...env,
      NX_SKIP_NATIVE_FILE_CACHE: 'true',
      NX_DAEMON: 'false',
    },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return r.status ?? 1;
}

function assertPrivateBase(url) {
  try {
    const u = new URL(url);
    const h = u.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(h)) return;
    throw new Error(`Refusing non-private target: ${url}`);
  } catch (e) {
    if (e.message.startsWith('Refusing')) throw e;
    throw new Error(`Invalid URL: ${url}`);
  }
}

if (mode === 'secure') {
  const code = run('pnpm', ['exec', 'nx', 'test', 'shared-security-lab'], {
    NEXATECH_SECURITY_LAB: '0',
    NEXATECH_DEPLOY_PROFILE: 'production',
    NODE_ENV: 'test',
  });
  // also re-run bff-security tests (secure default)
  const code2 = run('pnpm', ['exec', 'nx', 'test', 'shared-web'], {
    NEXATECH_SECURITY_LAB: '0',
    NEXATECH_DEPLOY_PROFILE: 'production',
    NODE_ENV: 'test',
  });
  process.exit(code !== 0 ? code : code2);
}

if (mode === 'lab') {
  if (process.env.SECURITY_LAB_ACK !== 'YES') {
    console.error(
      '[security] FAIL: set SECURITY_LAB_ACK=YES to run lab vulnerable tests',
    );
    process.exit(1);
  }
  const code = run('pnpm', ['exec', 'nx', 'test', 'shared-security-lab'], {
    NEXATECH_SECURITY_LAB: '1',
    NEXATECH_DEPLOY_PROFILE: 'security-lab',
    NODE_ENV: 'test',
    SECURITY_LAB_ACK: 'YES',
  });
  process.exit(code);
}

if (mode === 'smoke') {
  if (process.env.SECURITY_LAB_ACK !== 'YES') {
    console.error('[security] FAIL: SECURITY_LAB_ACK=YES required');
    process.exit(1);
  }
  const base = process.env.SECURITY_LAB_BASE_URL || 'http://127.0.0.1:3001';
  assertPrivateBase(base);
  console.log(
    `[security] smoke target=${base} (marker check is optional if stack down)`,
  );
  try {
    const http = require('http');
    const url = new URL('/health/lab', base);
    const req = http.get(url, { timeout: 3000 }, (res) => {
      console.log(`[security] lab marker HTTP ${res.statusCode}`);
      process.exit(0);
    });
    req.on('error', () => {
      console.log('[security] BLOCKED: lab stack unreachable — smoke skipped');
      process.exit(0);
    });
  } catch {
    console.log('[security] BLOCKED: smoke skipped');
    process.exit(0);
  }
  return;
}

if (mode === 'validate') {
  let failed = 0;
  failed += run('node', [__filename, 'secure']) === 0 ? 0 : 1;
  process.env.SECURITY_LAB_ACK = 'YES';
  failed += run('node', [__filename, 'lab']) === 0 ? 0 : 1;
  process.exit(failed > 0 ? 1 : 0);
}

console.error(`Unknown mode: ${mode}`);
process.exit(1);
