import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReviewService } from './review.service';

@ApiTags('product-reviews')
@Controller({ path: 'products/:productId/reviews', version: ['1', '2'] })
export class ProductsReviewsController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('summary')
  summary(@Param('productId') productId: string) {
    return this.reviewService.getProductSummary(productId);
  }

  @Get()
  list(
    @Param('productId') productId: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.reviewService.listProductReviews(productId, query ?? {});
  }
}
