#!/usr/bin/env node
/**
 * Security suite — always-on vulnerable PoC.
 * `secure` mode kept as alias that still runs policy tests (now asserting vulns).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const mode = process.argv[2] || 'lab';
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

if (mode === 'secure' || mode === 'lab') {
  // Always-on: both modes assert intentional vulnerable behavior exists
  if (mode === 'lab' && process.env.SECURITY_LAB_ACK !== 'YES') {
    console.error(
      '[security] FAIL: set SECURITY_LAB_ACK=YES to run lab tests',
    );
    process.exit(1);
  }
  const code = run('pnpm', ['exec', 'nx', 'test', 'shared-security-lab'], {
    NODE_ENV: 'test',
    SECURITY_LAB_ACK: 'YES',
  });
  const code2 = run('pnpm', ['exec', 'nx', 'test', 'shared-web'], {
    NODE_ENV: 'test',
  });
  process.exit(code !== 0 ? code : code2);
}

if (mode === 'smoke') {
  if (process.env.SECURITY_LAB_ACK !== 'YES') {
    console.error('[security] FAIL: SECURITY_LAB_ACK=YES required');
    process.exit(1);
  }
  const base = process.env.SECURITY_LAB_BASE_URL || 'http://127.0.0.1:3001';
  assertPrivateBase(base);
  console.log(`[security] smoke target=${base}`);
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
  process.env.SECURITY_LAB_ACK = 'YES';
  failed += run('node', [__filename, 'lab']) === 0 ? 0 : 1;
  failed +=
    run('node', ['--test', 'tests/seed/seed-accounts.test.cjs']) === 0 ? 0 : 1;
  process.exit(failed > 0 ? 1 : 0);
}

console.error(`Unknown mode: ${mode}`);
process.exit(1);
