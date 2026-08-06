/**
 * Handoff assertions against locally rendered Helm templates.
 * Expects deploy/checkpoints/{nexatech,kong}-rendered.yaml from helm template.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const ntPath = path.join(root, 'deploy/checkpoints/nexatech-rendered.yaml');
const kgPath = path.join(root, 'deploy/checkpoints/kong-rendered.yaml');

describe('helm handoff render assertions', () => {
  it('rendered manifests exist', () => {
    assert.ok(fs.existsSync(ntPath), 'nexatech-rendered.yaml missing — run helm template');
    assert.ok(fs.existsSync(kgPath), 'kong-rendered.yaml missing — run helm template');
  });

  it('swagger 8090 and security-guide 3200', () => {
    const nt = fs.readFileSync(ntPath, 'utf8').replace(/^\uFEFF/, '');
    assert.match(nt, /containerPort:\s*8090/);
    assert.match(nt, /containerPort:\s*3200/);
  });

  it('migrations are Jobs with prisma migrate deploy', () => {
    const nt = fs.readFileSync(ntPath, 'utf8').replace(/^\uFEFF/, '');
    assert.match(nt, /kind:\s*Job/);
    assert.match(nt, /prisma migrate deploy/);
  });

  it('app workloads can select app nodes via values overlay', () => {
    // Default values leave nodeSelector empty; staging/production overlays set role=app.
    const staging = fs.readFileSync(
      path.join(root, 'deploy/environments/staging/values.yaml'),
      'utf8',
    );
    const production = fs.readFileSync(
      path.join(root, 'deploy/environments/production/values.yaml'),
      'utf8',
    );
    assert.match(staging, /nexatech\.io\/role:\s*app/);
    assert.match(production, /nexatech\.io\/role:\s*app/);
  });

  it('kong targets dedicated node and ClusterIP admin', () => {
    const kg = fs.readFileSync(kgPath, 'utf8').replace(/^\uFEFF/, '');
    assert.match(kg, /nexatech\.io\/role:\s*kong/);
    assert.match(kg, /dedicated/);
    assert.match(kg, /NoSchedule/);
    assert.match(kg, /type:\s*ClusterIP/);
    assert.match(kg, /type:\s*LoadBalancer/);
    assert.match(kg, /8001/);
  });

  it('production values avoid localhost and docker hostnames', () => {
    const prod = fs.readFileSync(
      path.join(root, 'deploy/helm/nexatech/values-production.yaml'),
      'utf8',
    );
    const envProd = fs.readFileSync(
      path.join(root, 'deploy/environments/production/values.yaml'),
      'utf8',
    );
    for (const text of [prod, envProd]) {
      assert.doesNotMatch(text, /localhost/);
      assert.doesNotMatch(text, /127\.0\.0\.1/);
      assert.doesNotMatch(text, /postgres:5432/);
      assert.doesNotMatch(text, /@rabbitmq:/);
      assert.doesNotMatch(text, /@redis:/);
    }
  });
});
