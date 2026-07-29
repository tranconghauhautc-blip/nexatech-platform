import { execSync } from 'node:child_process';
import path from 'node:path';
import { PrismaService } from './prisma.service';

const describeIfDb = process.env['MEDIA_DATABASE_URL']
  ? describe
  : describe.skip;

describeIfDb('media prisma migration', () => {
  const serviceDir = path.join(__dirname, '../../..');

  it('applies migrations successfully', () => {
    execSync('npx prisma migrate deploy', {
      cwd: serviceDir,
      env: process.env,
      stdio: 'pipe',
    });
  });

  it('records migration in _prisma_migrations', async () => {
    const prisma = new PrismaService();
    await prisma.$connect();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE migration_name = '20260729130000_init_media'
    `;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await prisma.$disconnect();
  });
});
