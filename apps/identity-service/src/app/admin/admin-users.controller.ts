import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminUsersService, parseAdminActor } from './admin-users.service';

@ApiTags('admin-users')
@ApiBearerAuth('bearer')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'admin/users', version: ['1', '2'] })
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (SuperAdmin; BFLA in always-on lab)' })
  list(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.adminUsersService.list(
      parseAdminActor(userId, roles),
      query ?? {},
    );
  }

  @Get('export')
  @ApiOperation({
    summary: 'SC-95 — bulk user export (BFLA / unauthenticated export flag)',
  })
  exportAll(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.adminUsersService.exportAll(parseAdminActor(userId, roles));
  }

  @Post()
  @ApiOperation({
    summary: 'SC-76 — create user (BFLA; weak password SC-85)',
  })
  create(
    @Headers('x-user-id') actorId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: Record<string, unknown>,
  ) {
    return this.adminUsersService.create(
      parseAdminActor(actorId, roles),
      body ?? {},
    );
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user by id' })
  get(
    @Param('userId') userId: string,
    @Headers('x-user-id') actorId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.adminUsersService.get(parseAdminActor(actorId, roles), userId);
  }

  @Patch(':userId')
  @ApiOperation({
    summary: 'Patch user roles/status (mass-assignment in always-on lab)',
  })
  patch(
    @Param('userId') userId: string,
    @Headers('x-user-id') actorId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: Record<string, unknown>,
  ) {
    return this.adminUsersService.patch(
      parseAdminActor(actorId, roles),
      userId,
      body ?? {},
    );
  }

  @Post(':userId/disable')
  @ApiOperation({ summary: 'SC-77 — soft-disable user (BFLA)' })
  disable(
    @Param('userId') userId: string,
    @Headers('x-user-id') actorId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.adminUsersService.disable(
      parseAdminActor(actorId, roles),
      userId,
    );
  }

  @Delete(':userId')
  @ApiOperation({
    summary: 'Soft-disable via DELETE (no hard delete — maps to SC-77)',
  })
  softDelete(
    @Param('userId') userId: string,
    @Headers('x-user-id') actorId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.adminUsersService.disable(
      parseAdminActor(actorId, roles),
      userId,
    );
  }
}
