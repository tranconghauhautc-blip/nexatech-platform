import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { PaymentService, parseActor } from './payment.service';

@ApiTags('payments')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'payments', version: ['1', '2'] })
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  create(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.paymentService.createPayment(parseActor(userId, roles), body);
  }

  @Get('by-order/:orderId')
  getByOrder(
    @Param('orderId') orderId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.paymentService.getPaymentByOrder(
      parseActor(userId, roles),
      orderId,
    );
  }

  @Get(':paymentId')
  get(
    @Param('paymentId') paymentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.paymentService.getPayment(parseActor(userId, roles), paymentId);
  }

  @Post(':paymentId/cancel')
  cancel(
    @Param('paymentId') paymentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.paymentService.cancelPayment(
      parseActor(userId, roles),
      paymentId,
      body,
    );
  }

  @Post(':paymentId/refunds')
  createRefund(
    @Param('paymentId') paymentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.paymentService.createRefund(
      parseActor(userId, roles),
      paymentId,
      body,
    );
  }

  @Get(':paymentId/refunds')
  listRefunds(
    @Param('paymentId') paymentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.paymentService.listRefunds(
      parseActor(userId, roles),
      paymentId,
    );
  }
}
