import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../common/prisma.service';
import { Public } from '../common/auth';
import { ErrorResponseDto, ProductDto } from '../common/dto';
import { publicProduct } from '../common/mappers';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List / search products',
    description:
      'VULNERABLE — Unrestricted Resource Consumption: `limit` unbounded; `sort` interpolated ( Improper Inventory / injection surface).',
  })
  @ApiQuery({ name: 'q', required: false, example: 'phone' })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 100000,
    description: 'LAB: no upper bound',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    example: 'price',
    description: 'LAB: passed into orderBy loosely',
  })
  @ApiOkResponse({ type: [ProductDto] })
  async list(
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('sort') sort?: string,
  ): Promise<ProductDto[]> {
    // LAB: unrestricted consumption — huge limits allowed
    const limit = Math.max(1, Number(limitRaw ?? 50) || 50);

    const where: Prisma.ProductWhereInput = {
      active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // LAB: weak sort allow-list (inventory mismanagement / unexpected fields)
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === 'name'
        ? { name: 'asc' }
        : sort === 'stock'
          ? { stock: 'desc' }
          : { price: 'asc' };

    // LAB: expensive path — fetch then slice in memory when limit is huge
    const rows = await this.prisma.product.findMany({
      where,
      orderBy,
      take: limit,
    });
    return rows.map(publicProduct);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'View product by id' })
  @ApiOkResponse({ type: ProductDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async get(@Param('id') id: string): Promise<ProductDto> {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p || !p.active) throw new NotFoundException('Product not found');
    return publicProduct(p);
  }
}
