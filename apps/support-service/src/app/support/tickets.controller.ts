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
import { parseActor, SupportService } from './support.service';

@ApiTags('support-tickets')
@ApiBearerAuth('bearer')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'support/tickets', version: ['1', '2'] })
export class TicketsController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  create(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.supportService.createTicket(
      parseActor(userId, roles),
      body,
      traceId,
    );
  }

  @Get()
  list(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.supportService.listMyTickets(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get(':ticketId')
  get(
    @Param('ticketId') ticketId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.supportService.getTicket(parseActor(userId, roles), ticketId);
  }

  @Post(':ticketId/messages')
  addMessage(
    @Param('ticketId') ticketId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.supportService.addMessage(
      parseActor(userId, roles),
      ticketId,
      body,
      traceId,
    );
  }

  @Post(':ticketId/attachments')
  attachMedia(
    @Param('ticketId') ticketId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.supportService.attachTicketMedia(
      parseActor(userId, roles),
      ticketId,
      body,
      traceId,
    );
  }

  @Post(':ticketId/cancel')
  cancel(
    @Param('ticketId') ticketId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.supportService.cancelTicket(
      parseActor(userId, roles),
      ticketId,
      body,
      traceId,
    );
  }
}
