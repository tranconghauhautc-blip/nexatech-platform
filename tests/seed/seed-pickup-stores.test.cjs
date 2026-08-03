const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('seed-pickup-stores script', () => {
  const scriptPath = path.join(
    __dirname,
    '..',
    '..',
    'scripts',
    'seed-pickup-stores.cjs',
  );

  it('exists and targets HCM-NGUYEN-HUE without mutating HN-MAIN', () => {
    const src = fs.readFileSync(scriptPath, 'utf8');
    assert.match(src, /HCM-NGUYEN-HUE/);
    assert.match(src, /NexaTech Nguyễn Huệ|NexaTech Nguyen Hue/);
    assert.match(src, /pickupEnabled:\s*true/);
    assert.match(src, /leaving warehouse/);
    assert.match(src, /NEXATECH_ALLOW_DEV_SEED/);
    assert.doesNotMatch(src, /HN-MAIN.*(PATCH|update|delete)/i);
  });
});
