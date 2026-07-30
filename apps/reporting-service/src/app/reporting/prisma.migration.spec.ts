import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('reporting prisma migration', () => {
  it('locks provider to postgresql', () => {
    const lock = join(
      __dirname,
      '../../../prisma/migrations/migration_lock.toml',
    );
    expect(existsSync(lock)).toBe(true);
    expect(readFileSync(lock, 'utf8')).toContain('postgresql');
  });

  it('includes init migration sql with all projection and inbox tables', () => {
    const migration = join(
      __dirname,
      '../../../prisma/migrations/20260730140000_init_reporting/migration.sql',
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, 'utf8');

    expect(sql).toContain('CREATE TABLE "OrderProjection"');
    expect(sql).toContain('CREATE TABLE "PaymentProjection"');
    expect(sql).toContain('CREATE TABLE "ShipmentProjection"');
    expect(sql).toContain('CREATE TABLE "ReviewProjection"');
    expect(sql).toContain('CREATE TABLE "WarrantyClaimProjection"');
    expect(sql).toContain('CREATE TABLE "WarrantyReturnProjection"');
    expect(sql).toContain('CREATE TABLE "SupportTicketProjection"');
    expect(sql).toContain('CREATE TABLE "DailyMetric"');
    expect(sql).toContain('CREATE TABLE "AuditLogProjection"');
    expect(sql).toContain('CREATE TABLE "ProcessedEvent"');
    expect(sql).toContain('CREATE TABLE "ReportingIdempotency"');
    expect(sql).toContain('CREATE TABLE "AuditLog"');

    expect(sql).toContain(
      'CONSTRAINT "OrderProjection_pkey" PRIMARY KEY ("orderId")',
    );
    expect(sql).toContain(
      'CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("eventId")',
    );
    expect(sql).toContain(
      'CONSTRAINT "ReportingIdempotency_pkey" PRIMARY KEY ("key")',
    );
  });

  it('enforces the DailyMetric unique constraint on (metricDate, domain, metricKey)', () => {
    const migration = join(
      __dirname,
      '../../../prisma/migrations/20260730140000_init_reporting/migration.sql',
    );
    const sql = readFileSync(migration, 'utf8');
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "DailyMetric_metricDate_domain_metricKey_key" ON "DailyMetric"\("metricDate", "domain", "metricKey"\)/,
    );
  });

  it('enforces AuditLogProjection.sourceEventId uniqueness for idempotent inserts', () => {
    const migration = join(
      __dirname,
      '../../../prisma/migrations/20260730140000_init_reporting/migration.sql',
    );
    const sql = readFileSync(migration, 'utf8');
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "AuditLogProjection_sourceEventId_key" ON "AuditLogProjection"\("sourceEventId"\)/,
    );
  });
});
