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
import { parseActor, WarrantyService } from './warranty.service';

@ApiTags('warranty-claims')
@ApiBearerAuth('bearer')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'warranty/claims', version: ['1', '2'] })
export class ClaimsController {
  constructor(private readonly warrantyService: WarrantyService) {}

  @Post()
  create(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.warrantyService.createWarrantyClaim(
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
    return this.warrantyService.listMyClaims(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get(':claimId')
  get(
    @Param('claimId') claimId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.warrantyService.getClaim(parseActor(userId, roles), claimId);
  }

  @Post(':claimId/media')
  attachMedia(
    @Param('claimId') claimId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.warrantyService.attachClaimMedia(
      parseActor(userId, roles),
      claimId,
      body,
      traceId,
    );
  }

  @Post(':claimId/cancel')
  cancel(
    @Param('claimId') claimId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.warrantyService.cancelClaim(
      parseActor(userId, roles),
      claimId,
      body,
      traceId,
    );
  }
}
