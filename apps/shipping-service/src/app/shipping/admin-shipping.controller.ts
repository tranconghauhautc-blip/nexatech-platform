import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { ShippingService, parseActor } from './shipping.service';

@ApiTags('admin-shipments')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'admin/shipments', version: ['1', '2'] })
export class AdminShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  list(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.shippingService.listAdmin(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get(':shipmentId')
  get(
    @Param('shipmentId') shipmentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.shippingService.getShipment(
      parseActor(userId, roles),
      shipmentId,
    );
  }

  @Post(':shipmentId/status-transitions')
  transition(
    @Param('shipmentId') shipmentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.shippingService.transitionStatus(
      parseActor(userId, roles),
      shipmentId,
      body,
    );
  }
}
