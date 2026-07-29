import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InMemoryIdentityStore, IdentityStore } from './identity.store';

export const IDENTITY_STORE = Symbol('IDENTITY_STORE');

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: IDENTITY_STORE,
      useFactory: () => new InMemoryIdentityStore(),
    },
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
