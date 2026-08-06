/**
 * Regression: Kong declarative configs must nest routes under services.
 * Kong 3.9+ DB-less rejects top-level routes with service: { name } refs
 * ("service.id missing primary key").
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const files = [
  'infra/kong/kong.yml',
  'infra/kong/kong.production.yml',
];

function loadYamlLite(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return text;
}

describe('kong declarative nesting', () => {
  for (const rel of files) {
    it(`${rel} nests routes under services (no top-level routes key)`, () => {
      const text = loadYamlLite(path.join(root, rel));
      // Top-level "routes:" block is forbidden for Kong 3.9+ compatibility.
      const topLevelRoutes = /^routes:\s*$/m.test(text);
      assert.equal(
        topLevelRoutes,
        false,
        `${rel} must not declare top-level routes; nest under services`,
      );
      assert.match(text, /services:\s*\n/, `${rel} must declare services`);
      assert.match(
        text,
        /^\s{4}routes:\s*$/m,
        `${rel} must nest routes under each service (4-space indent)`,
      );
      assert.doesNotMatch(
        text,
        /^\s+service:\s*\n\s+name:\s+/m,
        `${rel} must not use nested service.name foreign refs on routes`,
      );
      assert.match(text, /_format_version:\s*['"]?3\.0['"]?/);
    });
  }
});
