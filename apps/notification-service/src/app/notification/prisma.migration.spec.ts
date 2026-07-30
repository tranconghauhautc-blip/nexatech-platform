import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('notification prisma migration', () => {
  it('locks provider to postgresql', () => {
    const lock = join(
      __dirname,
      '../../../prisma/migrations/migration_lock.toml',
    );
    expect(existsSync(lock)).toBe(true);
    expect(readFileSync(lock, 'utf8')).toContain('postgresql');
  });

  it('includes init migration sql with expected tables and enums', () => {
    const migration = join(
      __dirname,
      '../../../prisma/migrations/20260730130000_init_notification/migration.sql',
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, 'utf8');

    expect(sql).toContain('CREATE TYPE "NotificationCategory"');
    expect(sql).toContain('CREATE TYPE "EmailDeliveryStatus"');
    expect(sql).toContain('CREATE TYPE "NotificationChannel"');

    expect(sql).toContain('CREATE TABLE "InAppNotification"');
    expect(sql).toContain('CREATE TABLE "EmailDelivery"');
    expect(sql).toContain('CREATE TABLE "ProcessedEvent"');
    expect(sql).toContain('CREATE TABLE "NotificationIdempotency"');
    expect(sql).toContain('CREATE TABLE "AuditLog"');

    expect(sql).toContain(
      'CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("eventId")',
    );
  });
});
