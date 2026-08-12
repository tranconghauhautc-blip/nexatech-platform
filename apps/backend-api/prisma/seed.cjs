/**
 * VulnCart seed — admin + demo products.
 * Run: DATABASE_URL=... node prisma/seed.cjs
 */
const { PrismaClient } = require('../src/generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      passwordHash,
      role: 'ADMIN',
      enabled: true,
      displayName: 'VulnCart Admin',
    },
    create: {
      username: adminUsername,
      passwordHash,
      displayName: 'VulnCart Admin',
      role: 'ADMIN',
      enabled: true,
    },
  });

  const demoHash = await bcrypt.hash('user123', 10);
  await prisma.user.upsert({
    where: { username: 'demo' },
    update: {},
    create: {
      username: 'demo',
      passwordHash: demoHash,
      displayName: 'Demo User',
      role: 'USER',
      enabled: true,
    },
  });

  const count = await prisma.product.count();
  if (count === 0) {
    const products = [
      { name: 'Phone X1', description: 'Demo smartphone', price: 9990000, stock: 25 },
      { name: 'Laptop Pro 14', description: 'Demo laptop', price: 24990000, stock: 10 },
      { name: 'Tablet Air', description: 'Demo tablet', price: 12990000, stock: 15 },
      { name: 'Watch S', description: 'Demo smartwatch', price: 5990000, stock: 40 },
      { name: 'Buds Neo', description: 'Demo earbuds', price: 1990000, stock: 100 },
      { name: 'Speaker Mini', description: 'Demo speaker', price: 1490000, stock: 50 },
      { name: 'Case Clear', description: 'Phone case', price: 199000, stock: 200 },
      { name: 'Charger 65W', description: 'USB-C charger', price: 590000, stock: 80 },
    ];
    for (const p of products) {
      await prisma.product.create({ data: p });
    }
  }

  console.log('VulnCart seed OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
