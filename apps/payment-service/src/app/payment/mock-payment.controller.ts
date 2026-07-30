import { Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { PaymentService, parseActor } from './payment.service';

@ApiTags('mock-payments')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'mock-payments', version: ['1', '2'] })
export class MockPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get(':paymentId/checkout')
  checkout(@Param('paymentId') paymentId: string) {
    return {
      paymentId,
      message: 'Trang checkout mock — gọi POST succeed/fail/cancel để mô phỏng',
    };
  }

  @Post(':paymentId/succeed')
  succeed(
    @Param('paymentId') paymentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.paymentService.mockSucceed(
      parseActor(userId, roles),
      paymentId,
    );
  }

  @Post(':paymentId/fail')
  fail(
    @Param('paymentId') paymentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.paymentService.mockFail(parseActor(userId, roles), paymentId);
  }

  @Post(':paymentId/cancel')
  cancel(
    @Param('paymentId') paymentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.paymentService.mockCancel(parseActor(userId, roles), paymentId);
  }
}
