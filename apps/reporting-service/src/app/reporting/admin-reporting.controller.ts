import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { ReportingService, parseActor } from './reporting.service';

@ApiTags('admin-reporting')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'admin/reporting', version: ['1', '2'] })
export class AdminReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get('dashboard')
  dashboard(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.service.getDashboard(parseActor(userId, roles));
  }

  @Get('metrics/daily')
  dailyMetrics(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.service.listDailyMetrics(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get('orders')
  listOrders(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.service.listOrders(parseActor(userId, roles), query ?? {});
  }

  @Get('payments')
  listPayments(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.service.listPayments(parseActor(userId, roles), query ?? {});
  }

  @Get('shipments')
  listShipments(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.service.listShipments(parseActor(userId, roles), query ?? {});
  }

  @Get('reviews')
  listReviews(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.service.listReviews(parseActor(userId, roles), query ?? {});
  }

  @Get('warranty/claims')
  listWarrantyClaims(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.service.listWarrantyClaims(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get('warranty/returns')
  listWarrantyReturns(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.service.listWarrantyReturns(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get('support/tickets')
  listSupportTickets(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.service.listSupportTickets(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get('audit-logs')
  listAuditLogs(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.service.listAuditLogs(parseActor(userId, roles), query ?? {});
  }

  @Post('audit')
  recordAudit(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Body() body?: unknown,
  ) {
    return this.service.recordAudit(
      parseActor(userId, roles),
      body,
      idempotencyKey,
    );
  }
}
