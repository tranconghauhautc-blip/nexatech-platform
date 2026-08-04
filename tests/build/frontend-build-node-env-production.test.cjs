'use strict';

/**
 * Regression: frontend build targets must force NODE_ENV=production so Windows
 * host builds do not inherit development from .env.e2e* and fail /404 prerender.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
const projects = [
  'apps/storefront-web/project.json',
  'apps/admin-web/project.json',
];

for (const rel of projects) {
  const raw = fs.readFileSync(path.join(root, rel), 'utf8');
  const json = JSON.parse(raw);
  const command = json?.targets?.build?.options?.command ?? '';
  assert.match(
    command,
    /NODE_ENV=production/,
    `${rel} build.target must force NODE_ENV=production`,
  );
  assert.match(
    command,
    /next build/,
    `${rel} build.target must run next build`,
  );
}

console.log('frontend-build-node-env-production: OK');
