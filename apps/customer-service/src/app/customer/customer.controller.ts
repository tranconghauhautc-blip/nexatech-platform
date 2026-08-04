import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerService } from './customer.service';

interface AddressBody {
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2?: string;
  /** @deprecated legacy free-text ward, prefer wardCode/wardName */
  ward?: string;
  /** @deprecated legacy free-text district — 2-level model has no district */
  district?: string;
  /** @deprecated legacy free-text city, prefer provinceCode/provinceName */
  city: string;
  countryCode?: string;
  provinceCode?: string;
  provinceName?: string;
  wardCode?: string;
  wardName?: string;
  postalCode?: string;
  isDefault?: boolean;
}

type UpdateAddressBody = Partial<AddressBody>;

@ApiTags('customers')
@ApiBearerAuth('bearer')
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
  addAddress(@Headers('x-user-id') userId: string, @Body() body: AddressBody) {
    return this.customerService.addAddress(userId, {
      ...body,
      isDefault: body.isDefault ?? false,
    });
  }

  @Put('me/addresses/:id')
  updateAddress(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
    @Body() body: UpdateAddressBody,
  ) {
    return this.customerService.updateAddress(userId, id, body);
  }

  @Delete('me/addresses/:id')
  deleteAddress(@Headers('x-user-id') userId: string, @Param('id') id: string) {
    return this.customerService.deleteAddress(userId, id);
  }
}
