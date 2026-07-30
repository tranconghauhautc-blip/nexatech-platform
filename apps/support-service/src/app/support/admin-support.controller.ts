import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { parseActor, SupportService } from './support.service';

@ApiTags('admin-support')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'admin/support', version: ['1', '2'] })
export class AdminSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('tickets')
  listTickets(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.supportService.adminListTickets(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get('tickets/:ticketId')
  getTicket(
    @Param('ticketId') ticketId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.supportService.adminGetTicket(
      parseActor(userId, roles),
      ticketId,
    );
  }

  @Post('tickets/:ticketId/transition')
  transition(
    @Param('ticketId') ticketId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.supportService.adminTransitionTicket(
      parseActor(userId, roles),
      ticketId,
      body,
      traceId,
    );
  }

  @Post('tickets/:ticketId/messages')
  addMessage(
    @Param('ticketId') ticketId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.supportService.adminAddMessage(
      parseActor(userId, roles),
      ticketId,
      body,
      traceId,
    );
  }

  @Post('tickets/:ticketId/assign')
  assign(
    @Param('ticketId') ticketId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.supportService.adminAssignTicket(
      parseActor(userId, roles),
      ticketId,
      body,
      traceId,
    );
  }

  @Patch('tickets/:ticketId/priority')
  updatePriority(
    @Param('ticketId') ticketId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.supportService.adminUpdatePriority(
      parseActor(userId, roles),
      ticketId,
      body,
      traceId,
    );
  }
}
