import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../common/prisma.service';
import { Roles } from '../common/auth';
import {
  MessageDto,
  OrderDto,
  ProductDto,
  ReviewDto,
  UserPublicDto,
} from '../common/dto';
import { publicProduct, publicUser, toNumber } from '../common/mappers';

class CreateProductDto {
  @ApiProperty({ example: 'New Gadget' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 100000 })
  @Type(() => Number)
  @IsNumber()
  price!: number;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  stock!: number;

  @ApiPropertyOptional({
    description: 'LAB: may include callbackUrl for unsafe API consumption',
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

class StockDto {
  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @IsInt()
  stock!: number;
}

class UserEnabledDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  enabled!: boolean;
}

class OrderStatusDto {
  @ApiProperty({
    enum: ['PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'],
  })
  @IsString()
  status!: string;
}

class ModerateReviewDto {
  @ApiProperty({ enum: ['PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED'] })
  @IsString()
  status!: string;
}

@ApiTags('Admin')
@ApiBearerAuth('bearer')
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users')
  @ApiOperation({
    summary: 'List users',
    description:
      'Requires ADMIN. LAB BFLA: also reachable with x-user-role: ADMIN header or ?asAdmin=1.',
  })
  @ApiOkResponse({ type: [UserPublicDto] })
  async listUsers(): Promise<UserPublicDto[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map(publicUser);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'View user' })
  @ApiOkResponse({ type: UserPublicDto })
  async getUser(@Param('id') id: string): Promise<UserPublicDto> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException();
    return publicUser(u);
  }

  @Patch('users/:id/enabled')
  @ApiOperation({ summary: 'Enable / disable user' })
  @ApiBody({ type: UserEnabledDto })
  @ApiOkResponse({ type: UserPublicDto })
  async setEnabled(
    @Param('id') id: string,
    @Body() dto: UserEnabledDto,
  ): Promise<UserPublicDto> {
    const u = await this.prisma.user.update({
      where: { id },
      data: { enabled: dto.enabled },
    });
    return publicUser(u);
  }

  @Get('products')
  @ApiOperation({ summary: 'List all products (incl. inactive)' })
  @ApiOkResponse({ type: [ProductDto] })
  async listProducts(): Promise<ProductDto[]> {
    const rows = await this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(publicProduct);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create product' })
  @ApiBody({ type: CreateProductDto })
  @ApiOkResponse({ type: ProductDto })
  async createProduct(@Body() dto: CreateProductDto): Promise<ProductDto> {
    const p = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description ?? '',
        price: dto.price,
        stock: dto.stock,
        metadata: (dto.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
    return publicProduct(p);
  }

  @Put('products/:id')
  @ApiOperation({ summary: 'Update product' })
  @ApiBody({ type: UpdateProductDto })
  @ApiOkResponse({ type: ProductDto })
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDto> {
    const p = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        stock: dto.stock,
        active: dto.active,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    return publicProduct(p);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete product' })
  @ApiOkResponse({ type: MessageDto })
  async deleteProduct(@Param('id') id: string): Promise<MessageDto> {
    await this.prisma.product.delete({ where: { id } });
    return { message: 'deleted' };
  }

  @Patch('products/:id/stock')
  @ApiOperation({ summary: 'Update stock' })
  @ApiBody({ type: StockDto })
  @ApiOkResponse({ type: ProductDto })
  async updateStock(
    @Param('id') id: string,
    @Body() dto: StockDto,
  ): Promise<ProductDto> {
    const p = await this.prisma.product.update({
      where: { id },
      data: { stock: dto.stock },
    });
    return publicProduct(p);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List all orders' })
  @ApiOkResponse({ type: [OrderDto] })
  async listOrders(): Promise<OrderDto[]> {
    const rows = await this.prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((o) => ({
      id: o.id,
      userId: o.userId,
      status: o.status,
      totalAmount: toNumber(o.totalAmount),
      items: o.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: toNumber(i.unitPrice),
      })),
      createdAt: o.createdAt.toISOString(),
    }));
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'View order' })
  @ApiOkResponse({ type: OrderDto })
  async getOrder(@Param('id') id: string): Promise<OrderDto> {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!o) throw new NotFoundException();
    return {
      id: o.id,
      userId: o.userId,
      status: o.status,
      totalAmount: toNumber(o.totalAmount),
      items: o.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: toNumber(i.unitPrice),
      })),
      createdAt: o.createdAt.toISOString(),
    };
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Change order status' })
  @ApiBody({ type: OrderStatusDto })
  @ApiOkResponse({ type: OrderDto })
  async setOrderStatus(
    @Param('id') id: string,
    @Body() dto: OrderStatusDto,
  ): Promise<OrderDto> {
    const o = await this.prisma.order.update({
      where: { id },
      data: {
        status: dto.status as
          | 'PENDING'
          | 'PAID'
          | 'SHIPPED'
          | 'COMPLETED'
          | 'CANCELLED',
      },
      include: { items: true },
    });
    return {
      id: o.id,
      userId: o.userId,
      status: o.status,
      totalAmount: toNumber(o.totalAmount),
      items: o.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: toNumber(i.unitPrice),
      })),
      createdAt: o.createdAt.toISOString(),
    };
  }

  @Get('reviews')
  @ApiOperation({ summary: 'List all reviews for moderation' })
  @ApiOkResponse({ type: [ReviewDto] })
  async listReviews(): Promise<ReviewDto[]> {
    const rows = await this.prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      productId: r.productId,
      rating: r.rating,
      title: r.title,
      content: r.content,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  @Patch('reviews/:id')
  @ApiOperation({ summary: 'Moderate review' })
  @ApiBody({ type: ModerateReviewDto })
  @ApiOkResponse({ type: ReviewDto })
  async moderate(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
  ): Promise<ReviewDto> {
    const r = await this.prisma.review.update({
      where: { id },
      data: {
        status: dto.status as
          | 'PENDING'
          | 'PUBLISHED'
          | 'HIDDEN'
          | 'REJECTED',
      },
    });
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
}
