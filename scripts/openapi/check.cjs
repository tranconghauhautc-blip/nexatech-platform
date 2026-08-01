#!/usr/bin/env node
'use strict';

/**
 * openapi:check — generate → combine → validate → diff
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const node = process.execPath;

function run(script) {
  console.log(`\n[openapi:check] → ${script}`);
  const result = spawnSync(node, [path.join(__dirname, script)], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run('generate.cjs');
run('combine.cjs');
run('validate.cjs');
run('diff.cjs');
console.log('\n[openapi:check] PASSED');
