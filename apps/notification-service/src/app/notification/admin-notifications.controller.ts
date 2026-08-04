import { Controller, Get, Headers, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { NotificationService, parseActor } from './notification.service';

@ApiTags('admin-notifications')
@ApiBearerAuth('bearer')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'admin/notifications', version: ['1', '2'] })
export class AdminNotificationsController {
  constructor(private readonly service: NotificationService) {}

  @Get('email-deliveries')
  listEmailDeliveries(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.service.listEmailDeliveries(
      parseActor(userId, roles),
      query ?? {},
    );
  }
}
