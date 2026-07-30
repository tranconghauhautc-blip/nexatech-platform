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
import { OrderService, parseActor } from './order.service';

@ApiTags('orders')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'orders', version: ['1', '2'] })
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.orderService.createOrder(parseActor(userId, roles), body);
  }

  @Get()
  list(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.orderService.listMyOrders(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get(':orderId')
  get(
    @Param('orderId') orderId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.orderService.getMyOrder(parseActor(userId, roles), orderId);
  }

  @Post(':orderId/cancel')
  cancel(
    @Param('orderId') orderId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.orderService.cancelOrder(
      parseActor(userId, roles),
      orderId,
      body,
    );
  }

  @Post(':orderId/confirm')
  confirm(
    @Param('orderId') orderId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.orderService.confirmOrder(
      parseActor(userId, roles),
      orderId,
      body,
    );
  }

  @Post(':orderId/payment-sync')
  paymentSync(
    @Param('orderId') orderId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.orderService.syncPayment(
      parseActor(userId, roles),
      orderId,
      body,
    );
  }

  @Get(':orderId/status-history')
  statusHistory(
    @Param('orderId') orderId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.orderService.getStatusHistory(
      parseActor(userId, roles),
      orderId,
    );
  }

  @Get(':orderId/packages')
  packages(
    @Param('orderId') orderId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.orderService.getPackages(parseActor(userId, roles), orderId);
  }
}
