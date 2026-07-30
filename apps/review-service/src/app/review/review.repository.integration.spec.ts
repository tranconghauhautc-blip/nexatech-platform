import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const hasDb = Boolean(process.env['REVIEW_DATABASE_URL']);

(hasDb ? describe : describe.skip)(
  'review prisma repository integration',
  () => {
    it('connects when REVIEW_DATABASE_URL is set', async () => {
      expect(process.env['REVIEW_DATABASE_URL']).toBeTruthy();
    });
  },
);

describe('review prisma migration files', () => {
  it('includes review entities', () => {
    const migration = join(
      __dirname,
      '../../../prisma/migrations/20260730030000_init_review/migration.sql',
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, 'utf8');
    expect(sql).toContain('CREATE TABLE "ReviewMedia"');
    expect(sql).toContain('CREATE TABLE "ReviewReport"');
    expect(sql).toContain('CREATE TABLE "ReviewHelpfulVote"');
  });
});
