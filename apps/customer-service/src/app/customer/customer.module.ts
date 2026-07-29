import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import {
  CustomerService,
  CustomerStore,
  InMemoryCustomerStore,
} from './customer.service';

export const CUSTOMER_STORE = Symbol('CUSTOMER_STORE');

@Module({
  controllers: [CustomerController],
  providers: [
    {
      provide: CUSTOMER_STORE,
      useFactory: () => new InMemoryCustomerStore(),
    },
    {
      provide: CustomerService,
      useFactory: (store: CustomerStore) => new CustomerService(store),
      inject: [CUSTOMER_STORE],
    },
  ],
})
export class CustomerModule {}
