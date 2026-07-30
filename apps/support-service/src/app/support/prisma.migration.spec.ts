import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('support prisma migration', () => {
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
      '../../../prisma/migrations/20260730120000_init_support/migration.sql',
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, 'utf8');
    expect(sql).toContain('CREATE TABLE "SupportTicket"');
    expect(sql).toContain('CREATE TABLE "SupportTicketAttachment"');
    expect(sql).toContain('CREATE TABLE "SupportTicketMessage"');
    expect(sql).toContain('CREATE TABLE "SupportTicketHistory"');
    expect(sql).toContain('CREATE TABLE "SupportIdempotency"');
    expect(sql).toContain('CREATE TABLE "OutboxEvent"');
    expect(sql).toContain('CREATE TABLE "AuditLog"');
  });
});
