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
import { OrderService, parseActor } from './order.service';

@ApiTags('admin-orders')
@ApiBearerAuth('bearer')
@ApiHeader({ name: 'x-user-id', required: true })
@ApiHeader({ name: 'x-user-roles', required: true })
@Controller({ path: 'admin/orders', version: ['1', '2'] })
export class AdminOrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  list(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.orderService.adminListOrders(
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
    return this.orderService.adminGetOrder(parseActor(userId, roles), orderId);
  }

  @Post(':orderId/status-transitions')
  transition(
    @Param('orderId') orderId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.orderService.transitionStatus(
      parseActor(userId, roles),
      orderId,
      body,
    );
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

  /**
   * Đối soát (reconcile) fulfillment: đồng bộ lại trạng thái kiện hàng khi
   * đơn đã DELIVERED nhưng kiện hàng chưa cập nhật kịp (ví dụ do lỗi tạm thời
   * ở lần shipping-sync trước đó). Không đổi trạng thái đơn, chỉ dành cho
   * Admin trở lên. Idempotent — gọi lại nhiều lần an toàn.
   */
  @Post(':orderId/reconcile-fulfillment')
  reconcileFulfillment(
    @Param('orderId') orderId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.orderService.reconcileFulfillment(
      parseActor(userId, roles),
      orderId,
    );
  }
}
