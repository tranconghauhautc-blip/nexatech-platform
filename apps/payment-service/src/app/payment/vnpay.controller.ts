import { Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';

@ApiTags('vnpay')
@Controller({ path: 'vnpay', version: ['1', '2'] })
export class VnpayController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('return')
  async returnGet(
    @Query() query: Record<string, string>,
    @Res({ passthrough: true }) res: { redirect: (url: string) => void },
  ) {
    const result = await this.paymentService.handleVnpayReturn(query);
    const redirect =
      process.env['PAYMENT_RETURN_URL'] ??
      process.env['VNPAY_RETURN_URL'] ??
      '/';
    res.redirect(
      `${redirect}?status=${encodeURIComponent(result.redirectStatus)}&ref=${encodeURIComponent(result.payment.paymentReference)}`,
    );
  }

  @Get('ipn')
  async ipnGet(@Query() query: Record<string, string>) {
    return this.paymentService.handleVnpayIpn(query);
  }

  @Post('ipn')
  async ipnPost(@Query() query: Record<string, string>) {
    return this.paymentService.handleVnpayIpn(query);
  }
}
