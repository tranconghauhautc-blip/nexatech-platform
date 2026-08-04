#!/usr/bin/env node
/**
 * Cross-platform Helm lint via Docker (no local helm binary required).
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const charts = path.join(root, 'deploy', 'helm');

function lint(chart) {
  const args = [
    'run',
    '--rm',
    '-v',
    `${charts}:/charts`,
    'alpine/helm:3.16.4',
    'lint',
    `/charts/${chart}`,
  ];
  console.log(`[helm:lint] ${chart}`);
  const result = spawnSync('docker', args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

lint('nexatech');
lint('kong');
console.log('[helm:lint] PASSED');
