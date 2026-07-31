import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminUsersService,
  parseAdminActor,
} from './admin-users.service';

@ApiTags('admin-users')
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

  @Get(':userId')
  @ApiOperation({ summary: 'Get user by id' })
  get(
    @Param('userId') userId: string,
    @Headers('x-user-id') actorId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.adminUsersService.get(
      parseAdminActor(actorId, roles),
      userId,
    );
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
}
