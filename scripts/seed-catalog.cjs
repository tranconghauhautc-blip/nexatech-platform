/**
 * Seed ~100 ACTIVE catalog products for local/demo (M16).
 * Usage:
 *   cd apps/catalog-service && npx prisma generate
 *   $env:CATALOG_DATABASE_URL='postgresql://nexatech_catalog:changeme@localhost:5432/nexatech_catalog'
 *   node scripts/seed-catalog.cjs
 */
const { createRequire } = require('module');
const path = require('path');
const requireFromCatalog = createRequire(
  path.join(__dirname, '../apps/catalog-service/package.json'),
);

// Prefer generated client path used by the service
let PrismaClient;
try {
  ({ PrismaClient } = require('../apps/catalog-service/src/generated/prisma'));
} catch {
  ({ PrismaClient } = requireFromCatalog('@prisma/client'));
}

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: 'dien-thoai', name: 'Điện thoại', sortOrder: 1 },
  { slug: 'laptop', name: 'Laptop', sortOrder: 2 },
  { slug: 'may-tinh-bang', name: 'Máy tính bảng', sortOrder: 3 },
  { slug: 'dong-ho-thong-minh', name: 'Đồng hồ thông minh', sortOrder: 4 },
  { slug: 'tai-nghe-loa', name: 'Tai nghe & loa', sortOrder: 5 },
  { slug: 'phu-kien', name: 'Phụ kiện', sortOrder: 6 },
];

const BRANDS = [
  'apple',
  'samsung',
  'xiaomi',
  'oppo',
  'vivo',
  'asus',
  'dell',
  'hp',
  'lenovo',
  'sony',
  'jbl',
  'anker',
].map((slug) => ({
  slug,
  name: slug.charAt(0).toUpperCase() + slug.slice(1),
}));

const TEMPLATES = [
  { categorySlug: 'dien-thoai', prefix: 'Điện thoại', basePrice: 8_990_000 },
  { categorySlug: 'laptop', prefix: 'Laptop', basePrice: 18_990_000 },
  {
    categorySlug: 'may-tinh-bang',
    prefix: 'Máy tính bảng',
    basePrice: 9_490_000,
  },
  {
    categorySlug: 'dong-ho-thong-minh',
    prefix: 'Đồng hồ',
    basePrice: 4_490_000,
  },
  { categorySlug: 'tai-nghe-loa', prefix: 'Tai nghe', basePrice: 1_990_000 },
  { categorySlug: 'phu-kien', prefix: 'Phụ kiện', basePrice: 390_000 },
];

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  const categoryRows = [];
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, sortOrder: c.sortOrder, isActive: true },
      create: c,
    });
    categoryRows.push(row);
  }

  const brandRows = [];
  for (const b of BRANDS) {
    const row = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name, isActive: true },
      create: b,
    });
    brandRows.push(row);
  }

  let created = 0;
  let index = 1;
  while (created < 100) {
    for (const tpl of TEMPLATES) {
      if (created >= 100) break;
      const category = categoryRows.find((c) => c.slug === tpl.categorySlug);
      const brand = brandRows[created % brandRows.length];
      const name = `${tpl.prefix} NexaTech ${brand.name} ${String(index).padStart(3, '0')}`;
      const slug = slugify(name);
      const product = await prisma.product.upsert({
        where: { slug },
        update: {
          name,
          description: `${name} — sản phẩm demo NexaTech (seed M16).`,
          status: 'ACTIVE',
          searchText: `${name} ${brand.name} ${category.name}`,
        },
        create: {
          slug,
          name,
          description: `${name} — sản phẩm demo NexaTech (seed M16).`,
          categoryId: category.id,
          brandId: brand.id,
          status: 'ACTIVE',
          searchText: `${name} ${brand.name} ${category.name}`,
        },
      });

      const skuCode = `NT-${tpl.categorySlug.slice(0, 3).toUpperCase()}-${String(index).padStart(4, '0')}`;
      const sku = await prisma.sku.upsert({
        where: { skuCode },
        update: { name: `${name} - Mặc định`, productId: product.id },
        create: {
          productId: product.id,
          skuCode,
          name: `${name} - Mặc định`,
          attributes: { color: 'Đen', storage: '128GB' },
        },
      });

      const amount = tpl.basePrice + (created % 17) * 100_000;
      await prisma.price.upsert({
        where: { skuId: sku.id },
        update: { amount, currency: 'VND' },
        create: { skuId: sku.id, amount, currency: 'VND' },
      });

      created += 1;
      index += 1;
    }
  }

  console.log(
    `Seeded ${created} products across ${categoryRows.length} categories.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
