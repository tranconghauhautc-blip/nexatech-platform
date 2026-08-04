import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { PaymentService, parseActor } from './payment.service';

@ApiTags('admin-payments')
@ApiBearerAuth('bearer')
@ApiHeader({ name: 'x-user-id', required: true })
@ApiHeader({ name: 'x-user-roles', required: true })
@Controller({ path: 'admin/payments', version: ['1', '2'] })
export class AdminPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  list(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.paymentService.adminListPayments(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get(':paymentId')
  get(
    @Param('paymentId') paymentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.paymentService.adminGetPayment(
      parseActor(userId, roles),
      paymentId,
    );
  }

  @Post(':paymentId/cod-collect')
  codCollect(
    @Param('paymentId') paymentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.paymentService.markCodCollected(
      parseActor(userId, roles),
      paymentId,
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
}
