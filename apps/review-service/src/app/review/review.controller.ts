import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { parseActor, ReviewService } from './review.service';

@ApiTags('reviews')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'reviews', version: ['1', '2'] })
export class ReviewsController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  create(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.reviewService.createReview(
      parseActor(userId, roles),
      body,
      traceId,
    );
  }

  @Get(':reviewId')
  get(
    @Param('reviewId') reviewId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.reviewService.getReview(parseActor(userId, roles), reviewId);
  }

  @Patch(':reviewId')
  update(
    @Param('reviewId') reviewId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.reviewService.updateReview(
      parseActor(userId, roles),
      reviewId,
      body,
      traceId,
    );
  }

  @Delete(':reviewId')
  remove(
    @Param('reviewId') reviewId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.reviewService.deleteReview(
      parseActor(userId, roles),
      reviewId,
      traceId,
    );
  }

  @Post(':reviewId/helpful')
  addHelpful(
    @Param('reviewId') reviewId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.reviewService.addHelpful(
      parseActor(userId, roles),
      reviewId,
      traceId,
    );
  }

  @Delete(':reviewId/helpful')
  removeHelpful(
    @Param('reviewId') reviewId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.reviewService.removeHelpful(
      parseActor(userId, roles),
      reviewId,
      traceId,
    );
  }

  @Post(':reviewId/reports')
  report(
    @Param('reviewId') reviewId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.reviewService.reportReview(
      parseActor(userId, roles),
      reviewId,
      body,
      traceId,
    );
  }

  @Post(':reviewId/media')
  attachMedia(
    @Param('reviewId') reviewId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.reviewService.attachMedia(
      parseActor(userId, roles),
      reviewId,
      body,
      traceId,
    );
  }

  @Delete(':reviewId/media/:mediaId')
  unlinkMedia(
    @Param('reviewId') reviewId: string,
    @Param('mediaId') mediaId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.reviewService.unlinkMedia(
      parseActor(userId, roles),
      reviewId,
      mediaId,
      traceId,
    );
  }

  @Post(':reviewId/replies')
  createReply(
    @Param('reviewId') reviewId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.reviewService.createReply(
      parseActor(userId, roles),
      reviewId,
      body,
      traceId,
    );
  }

  @Patch(':reviewId/replies/:replyId')
  updateReply(
    @Param('reviewId') reviewId: string,
    @Param('replyId') replyId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
    @Body() body?: unknown,
  ) {
    return this.reviewService.updateReply(
      parseActor(userId, roles),
      reviewId,
      replyId,
      body,
      traceId,
    );
  }

  @Delete(':reviewId/replies/:replyId')
  deleteReply(
    @Param('reviewId') reviewId: string,
    @Param('replyId') replyId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.reviewService.deleteReply(
      parseActor(userId, roles),
      reviewId,
      replyId,
      traceId,
    );
  }
}
