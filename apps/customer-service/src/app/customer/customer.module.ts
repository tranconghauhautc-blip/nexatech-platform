import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import {
  CustomerService,
  CustomerStore,
  InMemoryCustomerStore,
} from './customer.service';
import { PrismaCustomerStore } from './prisma-customer.store';
import { PrismaService } from './prisma.service';

export const CUSTOMER_STORE = Symbol('CUSTOMER_STORE');

function createStoreProviders() {
  const dbUrl =
    process.env['CUSTOMER_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: CUSTOMER_STORE,
        useFactory: (prisma: PrismaService): CustomerStore =>
          new PrismaCustomerStore(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: CUSTOMER_STORE,
        useFactory: () => new InMemoryCustomerStore(),
      },
    ];
  }
  throw new Error(
    'CUSTOMER_DATABASE_URL bắt buộc khi chạy customer-service (trừ NODE_ENV=test)',
  );
}

@Module({
  controllers: [CustomerController],
  providers: [
    ...createStoreProviders(),
    {
      provide: CustomerService,
      useFactory: (store: CustomerStore) => new CustomerService(store),
      inject: [CUSTOMER_STORE],
    },
  ],
})
export class CustomerModule {}
