import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('warranty prisma migration', () => {
  it('locks provider to postgresql', () => {
    const lock = join(
      __dirname,
      '../../../prisma/migrations/migration_lock.toml',
    );
    expect(existsSync(lock)).toBe(true);
    expect(readFileSync(lock, 'utf8')).toContain('postgresql');
  });

  it('includes init migration sql', () => {
    const migration = join(
      __dirname,
      '../../../prisma/migrations/20260730110000_init_warranty/migration.sql',
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, 'utf8');
    expect(sql).toContain('CREATE TABLE "WarrantyClaim"');
    expect(sql).toContain('CREATE TABLE "WarrantyClaimMedia"');
    expect(sql).toContain('CREATE TABLE "WarrantyClaimHistory"');
    expect(sql).toContain('CREATE TABLE "ReturnRequest"');
    expect(sql).toContain('CREATE TABLE "ReturnRequestMedia"');
    expect(sql).toContain('CREATE TABLE "ReturnRequestHistory"');
    expect(sql).toContain('CREATE TABLE "WarrantyIdempotency"');
    expect(sql).toContain('CREATE TABLE "OutboxEvent"');
    expect(sql).toContain('CREATE TABLE "AuditLog"');
  });
});
