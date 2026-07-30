import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('review prisma migration', () => {
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
      '../../../prisma/migrations/20260730030000_init_review/migration.sql',
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, 'utf8');
    expect(sql).toContain('CREATE TABLE "Review"');
    expect(sql).toContain('CREATE TABLE "ProductRatingAggregate"');
    expect(sql).toContain('CREATE TABLE "OutboxEvent"');
  });
});
