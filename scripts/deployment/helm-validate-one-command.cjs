#!/usr/bin/env node
/**
 * Validate nexatech Helm chart for one-command install readiness.
 * Uses Docker alpine/helm — no local helm binary required.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const charts = path.join(root, 'deploy', 'helm');
const envStaging = path.join(root, 'deploy', 'environments', 'staging');
const checkpoints = path.join(root, 'deploy', 'checkpoints');
const helmImage = 'alpine/helm:3.16.4';

function run(args, opts = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    shell: false,
    ...opts,
  });
  return result;
}

function fail(msg) {
  console.error(`[helm:validate] FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`[helm:validate] PASS: ${msg}`);
}

function helm(args) {
  return run([
    'run',
    '--rm',
    '-v',
    `${charts}:/charts`,
    '-v',
    `${envStaging}:/env-staging`,
    '-v',
    `${checkpoints}:/checkpoints`,
    helmImage,
    ...args,
  ]);
}

fs.mkdirSync(checkpoints, { recursive: true });

console.log('[helm:validate] lint nexatech');
{
  const r = helm(['lint', '/charts/nexatech']);
  if (r.status !== 0) {
    console.error(r.stdout || '', r.stderr || '');
    fail('helm lint nexatech');
  }
  pass('helm lint nexatech');
}

console.log('[helm:validate] template with values-ghcr.yaml');
{
  const r = helm([
    'template',
    'nexatech',
    '/charts/nexatech',
    '-n',
    'nexatech',
    '-f',
    '/env-staging/values-ghcr.yaml',
  ]);
  if (r.status !== 0) {
    console.error(r.stdout || '', r.stderr || '');
    fail('helm template values-ghcr');
  }
  const out = r.stdout || '';
  fs.writeFileSync(path.join(checkpoints, 'nexatech-rendered.yaml'), out, 'utf8');

  const checks = [
    ['ServiceAccount hook', /kind: ServiceAccount[\s\S]*helm\.sh\/hook: pre-install,pre-upgrade[\s\S]*hook-weight: "-10"/],
    ['migrate hook weight', /hook-weight: "-5"/],
    ['POSIX set -eu', /set -eu/],
    ['no pipefail', (t) => !/set -euo pipefail/.test(t)],
    ['GHCR identity image', /ghcr\.io\/tranconghauhautc-blip\/nexatech\/identity-service:0\.17\.0/],
    ['GHCR migrate image', /ghcr\.io\/tranconghauhautc-blip\/nexatech\/identity-service:0\.17\.1-migrate/],
    ['entry VIP', /loadBalancerIP: "192\.168\.4\.204"/],
    ['redis PVC local-path', /storageClassName: "local-path"/],
    ['otel disabled in configmap/deploy', (t) => !/OTEL_EXPORTER_OTLP_ENDPOINT/.test(t)],
    ['storefront proxy', /proxy_pass http:\/\/storefront-web:3000/],
    ['admin proxy', /proxy_pass http:\/\/admin-web:3100/],
    ['no hardcoded ghcr-pull', (t) => !/name: ghcr-pull/.test(t)],
    ['networkpolicy entry external', /allow-entry-external/],
  ];

  for (const [name, rule] of checks) {
    const ok = typeof rule === 'function' ? rule(out) : rule.test(out);
    if (!ok) fail(`rendered check: ${name}`);
    pass(`rendered check: ${name}`);
  }

  // Duplicate resource name detection (kind+name within rendered release, excluding hooks duplicates ok)
  const names = new Map();
  const docs = out.split(/^---$/m);
  for (const doc of docs) {
    const kind = (doc.match(/^kind:\s*(.+)$/m) || [])[1];
    const name = (doc.match(/^ {0,2}name:\s*(.+)$/m) || [])[1];
    if (!kind || !name) continue;
    const key = `${kind.trim()}/${name.trim()}`;
    names.set(key, (names.get(key) || 0) + 1);
  }
  const dups = [...names.entries()].filter(([, c]) => c > 1);
  if (dups.length) {
    fail(`duplicate resources: ${dups.map(([k, c]) => `${k}x${c}`).join(', ')}`);
  }
  pass(`no duplicate kind/name (${names.size} resources)`);
}

// Kong render kept for handoff tests
console.log('[helm:validate] template kong');
{
  const r = helm(['template', 'kong', '/charts/kong', '-n', 'nexatech']);
  if (r.status !== 0) {
    console.error(r.stdout || '', r.stderr || '');
    fail('helm template kong');
  }
  fs.writeFileSync(path.join(checkpoints, 'kong-rendered.yaml'), r.stdout || '', 'utf8');
  pass('helm template kong');
}

console.log('[helm:validate] PASSED');
