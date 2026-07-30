import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InMemoryIdentityStore, IdentityStore } from './identity.store';
import { PrismaIdentityStore } from './prisma-identity.store';
import { PrismaService } from './prisma.service';

export const IDENTITY_STORE = Symbol('IDENTITY_STORE');

function createStoreProviders() {
  const dbUrl =
    process.env['IDENTITY_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: IDENTITY_STORE,
        useFactory: (prisma: PrismaService): IdentityStore =>
          new PrismaIdentityStore(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: IDENTITY_STORE,
        useFactory: () => new InMemoryIdentityStore(),
      },
    ];
  }
  throw new Error(
    'IDENTITY_DATABASE_URL bắt buộc khi chạy identity-service (trừ NODE_ENV=test)',
  );
}

@Module({
  controllers: [AuthController],
  providers: [
    ...createStoreProviders(),
    {
      provide: AuthService,
      useFactory: (store: IdentityStore) =>
        new AuthService(store, {
          accessSecret:
            process.env['JWT_ACCESS_SECRET'] ??
            'dev-access-secret-change-me-32chars',
          refreshSecret:
            process.env['JWT_REFRESH_SECRET'] ??
            'dev-refresh-secret-change-me-32chars',
          accessTtlSeconds: Number(
            process.env['JWT_ACCESS_TTL_SECONDS'] ?? 900,
          ),
          refreshTtlSeconds: Number(
            process.env['JWT_REFRESH_TTL_SECONDS'] ?? 60 * 60 * 24 * 30,
          ),
        }),
      inject: [IDENTITY_STORE],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
