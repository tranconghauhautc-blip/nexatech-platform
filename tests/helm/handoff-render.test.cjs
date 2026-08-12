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
const ghcrValues = path.join(root, 'deploy/environments/staging/values-ghcr.yaml');

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

  it('migrations are Jobs with prisma migrate deploy and POSIX set -eu', () => {
    const nt = fs.readFileSync(ntPath, 'utf8').replace(/^\uFEFF/, '');
    assert.match(nt, /kind:\s*Job/);
    assert.match(nt, /prisma migrate deploy/);
    assert.match(nt, /set -eu/);
    assert.doesNotMatch(nt, /set -euo pipefail/);
  });

  it('ServiceAccount is a pre-install hook before migrate Jobs', () => {
    const nt = fs.readFileSync(ntPath, 'utf8').replace(/^\uFEFF/, '');
    assert.match(nt, /kind:\s*ServiceAccount/);
    assert.match(nt, /helm\.sh\/hook:\s*pre-install,pre-upgrade/);
    assert.match(nt, /helm\.sh\/hook-weight:\s*"?-10"?/);
    assert.match(nt, /helm\.sh\/hook-weight:\s*"?-5"?/);
    const saMatch = nt.match(
      /kind: ServiceAccount\nmetadata:\n(?:.*\n)*? {4}helm\.sh\/hook-delete-policy: ([^\n]+)/,
    );
    assert.ok(saMatch, 'ServiceAccount hook-delete-policy missing');
    assert.equal(saMatch[1].trim(), 'before-hook-creation');
  });

  it('GHCR staging overlay uses public-friendly empty imagePullSecrets by default', () => {
    const text = fs.readFileSync(ghcrValues, 'utf8');
    assert.match(text, /imageRegistry:\s*ghcr\.io/);
    assert.match(text, /imageRepository:\s*tranconghauhautc-blip\/nexatech/);
    assert.match(text, /imageTag:\s*'0\.17\.0'/);
    assert.match(text, /migrationImageTag:\s*'0\.17\.1-migrate'/);
    assert.match(text, /imagePullSecrets:\s*\[\]/);
    assert.match(text, /host:\s*'192\.168\.3\.50'/);
    assert.match(text, /loadBalancerIP:\s*'192\.168\.4\.204'/);
    assert.match(text, /otel:[\s\S]*enabled:\s*false/);
    assert.doesNotMatch(text, /CHANGE_ME/);
  });

  it('entry selector and proxy targets use app Service names', () => {
    const nt = fs.readFileSync(ntPath, 'utf8').replace(/^\uFEFF/, '');
    assert.match(nt, /proxy_pass http:\/\/storefront-web:/);
    assert.match(nt, /proxy_pass http:\/\/admin-web:/);
    assert.match(nt, /proxy_pass http:\/\/identity-service:/);
    assert.match(nt, /app\.kubernetes\.io\/name:\s*nexatech-entry/);
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
    assert.doesNotMatch(prod, /CHANGE_ME/);
  });
});
