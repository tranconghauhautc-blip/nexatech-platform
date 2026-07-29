import { Body, Controller, Get, Headers, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CustomerService } from './customer.service';

@ApiTags('customers')
@Controller({ path: 'customers', version: ['1', '2'] })
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('me')
  me(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-name') fullName = 'Khách hàng NexaTech',
  ) {
    return this.customerService.getOrCreateMe(userId, fullName);
  }

  @Put('me')
  updateMe(
    @Headers('x-user-id') userId: string,
    @Body() body: { fullName?: string; phone?: string },
  ) {
    return this.customerService.updateMe(userId, body);
  }

  @Get('me/addresses')
  addresses(@Headers('x-user-id') userId: string) {
    return this.customerService.listMyAddresses(userId);
  }

  @Post('me/addresses')
  addAddress(
    @Headers('x-user-id') userId: string,
    @Body()
    body: {
      label: string;
      recipient: string;
      phone: string;
      line1: string;
      line2?: string;
      ward?: string;
      district?: string;
      city: string;
      postalCode?: string;
      isDefault?: boolean;
    },
  ) {
    return this.customerService.addAddress(userId, {
      ...body,
      isDefault: body.isDefault ?? false,
    });
  }
}
