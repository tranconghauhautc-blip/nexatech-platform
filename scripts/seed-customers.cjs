/**
 * DEV/local seed for exactly 2 Storefront Customer accounts.
 *
 * Guards (all required):
 *   - NODE_ENV !== production
 *   - NEXATECH_ALLOW_DEV_SEED=YES
 *   - DEV_SEED_PASSWORD=<operator-defined strong password>
 *   - IDENTITY_DATABASE_URL
 *   - CUSTOMER_DATABASE_URL
 *
 * Optional:
 *   - DEV_SEED_RESET_PASSWORD=YES — reset password hashes for these customers only
 *
 * Idempotent. Does NOT modify the 4 internal seed accounts. Does NOT reset DBs.
 *
 * PowerShell:
 *   $env:NODE_ENV="development"
 *   $env:NEXATECH_ALLOW_DEV_SEED="YES"
 *   $env:DEV_SEED_PASSWORD="<operator-defined-strong-password>"
 *   $env:IDENTITY_DATABASE_URL="postgresql://nexatech_identity:changeme@localhost:5432/nexatech_identity"
 *   $env:CUSTOMER_DATABASE_URL="postgresql://nexatech_customer:changeme@localhost:5432/nexatech_customer"
 *   pnpm seed:customers
 */
const {
  DEV_CUSTOMERS,
  validateCustomerSeedTargets,
  validateSeedGuards,
  validatePasswordPolicy,
  hashPassword,
  shouldResetPassword,
  redactPasswordHint,
  planIdentityUpsert,
  planProfileUpsert,
  assertDatabaseUrls,
  isInternalEmail,
} = require('./lib/seed-customers-core.cjs');

function die(message) {
  console.error(`[seed:customers] ERROR: ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[seed:customers] ${message}`);
}

function loadIdentityPrisma() {
  try {
    return require('../apps/identity-service/src/generated/prisma')
      .PrismaClient;
  } catch {
    try {
      return require('@prisma/client').PrismaClient;
    } catch {
      die(
        'Identity Prisma client not found. Run: pnpm exec prisma generate --schema=apps/identity-service/prisma/schema.prisma',
      );
    }
  }
}

function loadCustomerPrisma() {
  try {
    return require('../apps/customer-service/src/generated/prisma')
      .PrismaClient;
  } catch {
    try {
      return require('@prisma/client').PrismaClient;
    } catch {
      die(
        'Customer Prisma client not found. Run: pnpm exec prisma generate --schema=apps/customer-service/prisma/schema.prisma',
      );
    }
  }
}

async function upsertDefaultAddress(customerPrisma, profileId, addressData) {
  const existingDefault = await customerPrisma.address.findFirst({
    where: { customerId: profileId, isDefault: true },
  });
  if (existingDefault) {
    await customerPrisma.address.update({
      where: { id: existingDefault.id },
      data: addressData,
    });
    return existingDefault.id;
  }
  const any = await customerPrisma.address.findFirst({
    where: { customerId: profileId },
    orderBy: { createdAt: 'asc' },
  });
  if (any) {
    await customerPrisma.address.update({
      where: { id: any.id },
      data: { ...addressData, isDefault: true },
    });
    return any.id;
  }
  const created = await customerPrisma.address.create({
    data: { customerId: profileId, ...addressData },
  });
  return created.id;
}

async function seedOneCustomer(
  identityPrisma,
  customerPrisma,
  customer,
  passwordHash,
  resetRequested,
) {
  if (isInternalEmail(customer.email)) {
    throw new Error(`Refusing to modify internal account ${customer.email}`);
  }

  const existingIdentity = await identityPrisma.user.findUnique({
    where: { email: customer.email },
  });
  const identityPlan = planIdentityUpsert(
    existingIdentity,
    customer,
    passwordHash,
    resetRequested,
  );
  if (identityPlan.action === 'refuse-internal') {
    throw new Error(identityPlan.message);
  }

  let identityRow;
  let createdIdentity = false;
  if (identityPlan.action === 'create') {
    identityRow = await identityPrisma.user.create({ data: identityPlan.data });
    createdIdentity = true;
  } else {
    identityRow = await identityPrisma.user.update({
      where: { email: customer.email },
      data: identityPlan.data,
    });
  }

  try {
    const existingProfile = await customerPrisma.customerProfile.findUnique({
      where: { userId: identityRow.id },
      include: { addresses: true },
    });
    const profilePlan = planProfileUpsert(
      existingProfile,
      customer,
      identityRow.id,
    );

    let profileRow;
    if (profilePlan.action === 'create') {
      profileRow = await customerPrisma.customerProfile.create({
        data: {
          ...profilePlan.profile,
          addresses: {
            create: [profilePlan.address],
          },
          preference: {
            create: {
              locale: 'vi-VN',
              marketingOptIn: false,
            },
          },
        },
      });
    } else {
      profileRow = await customerPrisma.customerProfile.update({
        where: { id: profilePlan.profileId },
        data: profilePlan.profile,
      });
      await upsertDefaultAddress(
        customerPrisma,
        profileRow.id,
        profilePlan.address,
      );
    }

    return {
      email: identityRow.email,
      fullName: identityRow.fullName,
      userId: identityRow.id,
      profileId: profileRow.id,
      role: customer.role,
      identityAction: identityPlan.action,
      profileAction: profilePlan.action,
      status: identityRow.status,
      emailVerifiedAt: identityRow.emailVerifiedAt,
      isDevSeed: identityRow.isDevSeed === true,
    };
  } catch (err) {
    if (createdIdentity) {
      await identityPrisma.user
        .delete({ where: { id: identityRow.id } })
        .catch(() => undefined);
      log(
        `Rolled back identity user ${customer.email} after customer profile failure.`,
      );
    }
    throw err;
  }
}

async function main() {
  const targets = validateCustomerSeedTargets();
  if (!targets.ok) die(targets.message);

  const guard = validateSeedGuards(process.env);
  if (!guard.ok) die(guard.message);

  const policy = validatePasswordPolicy(guard.password);
  if (!policy.ok) die(policy.message);

  const urls = assertDatabaseUrls(process.env);
  if (!urls.ok) die(urls.message);

  const resetRequested = shouldResetPassword(process.env);
  const passwordHash = await hashPassword(guard.password);

  const IdentityPrisma = loadIdentityPrisma();
  const CustomerPrisma = loadCustomerPrisma();
  const identityPrisma = new IdentityPrisma({
    datasources: { db: { url: urls.identityUrl } },
  });
  const customerPrisma = new CustomerPrisma({
    datasources: { db: { url: urls.customerUrl } },
  });

  const results = [];
  try {
    for (const customer of DEV_CUSTOMERS) {
      const row = await seedOneCustomer(
        identityPrisma,
        customerPrisma,
        customer,
        passwordHash,
        resetRequested,
      );
      results.push(row);
    }

    // Safety: internal accounts untouched (count check)
    const internalEmails = [
      'staff@nexatech.local',
      'manager@nexatech.local',
      'admin@nexatech.local',
      'superadmin@nexatech.local',
    ];
    const internals = await identityPrisma.user.findMany({
      where: { email: { in: internalEmails } },
      select: { email: true, roles: true, isDevSeed: true },
    });
    log(
      `Internal accounts present (untouched by this command): ${internals.length}`,
    );
  } finally {
    await Promise.all([
      identityPrisma.$disconnect(),
      customerPrisma.$disconnect(),
    ]);
  }

  log(`Seeded ${results.length} Customer accounts (domain nexatech.local).`);
  for (const r of results) {
    log(
      `  ${r.email}  userId=${r.userId.slice(0, 8)}…  profileId=${r.profileId.slice(0, 8)}…  identity=${r.identityAction}  profile=${r.profileAction}`,
    );
  }
  log(
    `Password: operator-defined DEV_SEED_PASSWORD ${redactPasswordHint(guard.password)} (not printed).`,
  );
  if (resetRequested) {
    log(
      'DEV_SEED_RESET_PASSWORD=YES — password hashes refreshed for Customer seed accounts only.',
    );
  } else {
    log(
      'Existing Customer passwords preserved (set DEV_SEED_RESET_PASSWORD=YES to reset).',
    );
  }
  log(
    'emailVerified=true (emailVerifiedAt set), status=ACTIVE, role=Customer. No OTP required after seed.',
  );
}

main().catch((err) => {
  console.error('[seed:customers] FATAL:', err?.message || err);
  process.exit(1);
});
