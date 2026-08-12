import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../common/prisma.service';
import { CurrentUser, AuthUser, Public } from '../common/auth';
import { MessageDto, ReviewDto } from '../common/dto';

class CreateReviewDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: 'Great' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'Works well' })
  @IsString()
  content!: string;
}

class UpdateReviewDto {
  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    example: 'PUBLISHED',
    description: 'LAB mass assignment: status change by any user',
  })
  @IsOptional()
  @IsString()
  status?: string;
}

function mapReview(r: {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  title: string | null;
  content: string;
  status: string;
  createdAt: Date;
}): ReviewDto {
  return {
    id: r.id,
    userId: r.userId,
    productId: r.productId,
    rating: r.rating,
    title: r.title,
    content: r.content,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List reviews (optionally by product)' })
  @ApiQuery({ name: 'productId', required: false })
  @ApiOkResponse({ type: [ReviewDto] })
  async list(@Query('productId') productId?: string): Promise<ReviewDto[]> {
    const rows = await this.prisma.review.findMany({
      where: {
        status: 'PUBLISHED',
        ...(productId ? { productId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(mapReview);
  }

  @ApiBearerAuth('bearer')
  @Post()
  @ApiOperation({
    summary: 'Create review',
    description:
      'VULNERABLE — review without purchase; no unique constraint → multiple review spam.',
  })
  @ApiBody({ type: CreateReviewDto })
  @ApiOkResponse({ type: ReviewDto })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');
    // LAB: no purchase verification
    const review = await this.prisma.review.create({
      data: {
        userId: user.id,
        productId: dto.productId,
        rating: dto.rating,
        title: dto.title,
        content: dto.content,
        status: 'PUBLISHED',
      },
    });
    return mapReview(review);
  }

  @ApiBearerAuth('bearer')
  @Patch(':id')
  @ApiOperation({
    summary: 'Edit review',
    description:
      'VULNERABLE — BOLA: edit another user review by id; mass-assign status.',
  })
  @ApiBody({ type: UpdateReviewDto })
  @ApiOkResponse({ type: ReviewDto })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<ReviewDto> {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');
    // LAB: no ownership check
    void user;
    const status =
      dto.status &&
      ['PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED'].includes(dto.status)
        ? (dto.status as 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'REJECTED')
        : undefined;
    const review = await this.prisma.review.update({
      where: { id },
      data: {
        rating: dto.rating,
        title: dto.title,
        content: dto.content,
        status,
      },
    });
    return mapReview(review);
  }

  @ApiBearerAuth('bearer')
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete review',
    description: 'VULNERABLE — BOLA: delete any review by id.',
  })
  @ApiOkResponse({ type: MessageDto })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<MessageDto> {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');
    void user;
    await this.prisma.review.delete({ where: { id } });
    return { message: 'deleted' };
  }
}
