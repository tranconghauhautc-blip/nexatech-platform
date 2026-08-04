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

@ApiTags('returns')
@ApiBearerAuth('bearer')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'returns', version: ['1', '2'] })
export class ReturnsController {
  constructor(private readonly warrantyService: WarrantyService) {}

  @Post()
  create(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.warrantyService.createReturnRequest(
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
    return this.warrantyService.listMyReturns(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get(':returnId')
  get(
    @Param('returnId') returnId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.warrantyService.getReturn(parseActor(userId, roles), returnId);
  }

  @Post(':returnId/media')
  attachMedia(
    @Param('returnId') returnId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.warrantyService.attachReturnMedia(
      parseActor(userId, roles),
      returnId,
      body,
      traceId,
    );
  }

  @Post(':returnId/cancel')
  cancel(
    @Param('returnId') returnId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.warrantyService.cancelReturn(
      parseActor(userId, roles),
      returnId,
      body,
      traceId,
    );
  }
}
