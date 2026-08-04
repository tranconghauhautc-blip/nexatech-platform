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
import { parseActor, ReviewService } from './review.service';

@ApiTags('admin-reviews')
@ApiBearerAuth('bearer')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'admin', version: ['1', '2'] })
export class AdminReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('reviews')
  list(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.reviewService.adminListReviews(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Get('reviews/:reviewId')
  get(
    @Param('reviewId') reviewId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.reviewService.adminGetReview(
      parseActor(userId, roles),
      reviewId,
    );
  }

  @Post('reviews/:reviewId/moderate')
  moderate(
    @Param('reviewId') reviewId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.reviewService.moderate(
      parseActor(userId, roles),
      reviewId,
      body,
      traceId,
    );
  }

  @Get('review-reports')
  listReports(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.reviewService.listReports(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Post('review-reports/:reportId/resolve')
  resolveReport(
    @Param('reportId') reportId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.reviewService.resolveReport(
      parseActor(userId, roles),
      reportId,
      body,
      traceId,
    );
  }

  @Post('reviews/aggregates/rebuild')
  rebuild(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.reviewService.rebuildAggregates(
      parseActor(userId, roles),
      body ?? {},
      traceId,
    );
  }
}
