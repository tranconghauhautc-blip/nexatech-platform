import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { parseActor, WarrantyService } from './warranty.service';

@ApiTags('admin-warranty')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'admin', version: ['1', '2'] })
export class AdminWarrantyController {
  constructor(private readonly warrantyService: WarrantyService) {}

  @Get('warranty/claims')
  listClaims(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.warrantyService.adminListClaims(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get('warranty/claims/:claimId')
  getClaim(
    @Param('claimId') claimId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.warrantyService.adminGetClaim(
      parseActor(userId, roles),
      claimId,
    );
  }

  @Post('warranty/claims/:claimId/transition')
  transitionClaim(
    @Param('claimId') claimId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.warrantyService.adminTransitionClaim(
      parseActor(userId, roles),
      claimId,
      body,
      traceId,
    );
  }

  @Get('returns')
  listReturns(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.warrantyService.adminListReturns(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get('returns/:returnId')
  getReturn(
    @Param('returnId') returnId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.warrantyService.adminGetReturn(
      parseActor(userId, roles),
      returnId,
    );
  }

  @Post('returns/:returnId/transition')
  transitionReturn(
    @Param('returnId') returnId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.warrantyService.adminTransitionReturn(
      parseActor(userId, roles),
      returnId,
      body,
      traceId,
    );
  }
}
