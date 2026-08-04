import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { NotificationService, parseActor } from './notification.service';

@ApiTags('notifications')
@ApiBearerAuth('bearer')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'notifications', version: ['1', '2'] })
export class NotificationsController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  list(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.service.listNotifications(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get('unread-count')
  unreadCount(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.service.unreadCount(parseActor(userId, roles));
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.service.markRead(parseActor(userId, roles), id);
  }

  @Post('read-all')
  markAllRead(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.service.markAllRead(parseActor(userId, roles));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    await this.service.deleteNotification(parseActor(userId, roles), id);
  }

  @Post('request')
  request(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Body() body?: unknown,
  ) {
    return this.service.requestNotification(
      parseActor(userId, roles),
      body,
      traceId,
      idempotencyKey,
    );
  }
}
