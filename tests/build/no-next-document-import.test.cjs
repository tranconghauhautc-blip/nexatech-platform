#!/usr/bin/env node
'use strict';

/**
 * Regression guard: App Router apps must not import next/document.
 * Illegal imports cause Windows production prerender failures on /404.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
const apps = ['apps/storefront-web/src', 'apps/admin-web/src'];
const banned = /from\s+['"]next\/document['"]|require\(\s*['"]next\/document['"]\s*\)/;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, files);
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const offenders = [];
for (const app of apps) {
  for (const file of walk(path.join(root, app))) {
    const src = fs.readFileSync(file, 'utf8');
    if (banned.test(src)) {
      offenders.push(path.relative(root, file));
    }
  }
}

assert.deepStrictEqual(
  offenders,
  [],
  `Forbidden next/document imports:\n${offenders.join('\n')}`,
);
console.log('no-next-document-import: OK');
