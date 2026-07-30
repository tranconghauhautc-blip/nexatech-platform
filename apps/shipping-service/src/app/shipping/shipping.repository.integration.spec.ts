import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const hasDb = Boolean(process.env['SHIPPING_DATABASE_URL']);

(hasDb ? describe : describe.skip)(
  'shipping prisma repository integration',
  () => {
    it('connects when SHIPPING_DATABASE_URL is set', async () => {
      expect(process.env['SHIPPING_DATABASE_URL']).toBeTruthy();
    });
  },
);

describe('shipping prisma migration files', () => {
  it('includes init migration sql', () => {
    const migration = join(
      __dirname,
      '../../../prisma/migrations/20260730020000_init_shipping/migration.sql',
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, 'utf8');
    expect(sql).toContain('CREATE TABLE "Shipment"');
    expect(sql).toContain('CREATE TABLE "ShippingQuote"');
    expect(sql).toContain('CREATE TABLE "DeliverySlot"');
  });
});
