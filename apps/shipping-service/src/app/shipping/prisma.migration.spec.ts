import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('shipping prisma migration', () => {
  it('locks provider to postgresql', () => {
    const lock = join(
      __dirname,
      '../../../prisma/migrations/migration_lock.toml',
    );
    expect(existsSync(lock)).toBe(true);
    expect(readFileSync(lock, 'utf8')).toContain('postgresql');
  });
});
