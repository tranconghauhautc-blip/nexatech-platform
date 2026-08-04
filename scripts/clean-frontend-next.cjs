#!/usr/bin/env node
'use strict';

/**
 * Remove Next.js `.next` output dirs before production builds.
 * Stale Windows `.next` caches can worsen prerender failures, but the primary
 * host-build failure mode is inheriting NODE_ENV=development (e.g. from
 * .env.e2e*) which makes Next prerender /404 via Pages `/_error` and throw:
 *   Error: <Html> should not be imported outside of pages/_document
 * Source does not import next/document. next.config.js forces NODE_ENV=production.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const targets = [
  path.join(root, 'apps/storefront-web/.next'),
  path.join(root, 'apps/admin-web/.next'),
];

for (const dir of targets) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`[clean-frontend-next] removed ${path.relative(root, dir)}`);
  } else {
    console.log(`[clean-frontend-next] skip missing ${path.relative(root, dir)}`);
  }
}
