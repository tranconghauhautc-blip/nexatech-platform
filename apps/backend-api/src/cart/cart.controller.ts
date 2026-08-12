import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { IsInt, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../common/prisma.service';
import { CurrentUser, AuthUser } from '../common/auth';
import { CartItemDto, MessageDto } from '../common/dto';
import { publicProduct, toNumber } from '../common/mappers';

class AddCartDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({
    example: -5,
    description: 'LAB: negative quantity allowed (business logic abuse)',
  })
  @Type(() => Number)
  @IsInt()
  quantity!: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'LAB: client-controlled unitPrice (price tampering)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitPrice?: number;
}

class UpdateCartDto {
  @ApiProperty({ example: 99 })
  @Type(() => Number)
  @IsInt()
  quantity!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitPrice?: number;
}

@ApiTags('Cart')
@ApiBearerAuth('bearer')
@Controller('cart')
export class CartController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List cart items' })
  @ApiOkResponse({ type: [CartItemDto] })
  async list(@CurrentUser() user: AuthUser): Promise<CartItemDto[]> {
    const items = await this.prisma.cartItem.findMany({
      where: { userId: user.id },
      include: { product: true },
    });
    return items.map((i) => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice != null ? toNumber(i.unitPrice) : null,
      product: publicProduct(i.product),
    }));
  }

  @Post('items')
  @ApiOperation({
    summary: 'Add cart item',
    description:
      'VULNERABLE — Sensitive Business Flow: negative quantity accepted; client unitPrice stored and later used at checkout; no stock check.',
  })
  @ApiBody({ type: AddCartDto })
  @ApiOkResponse({ type: CartItemDto })
  async add(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddCartDto,
  ): Promise<CartItemDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product || !product.active) {
      throw new NotFoundException('Product not found');
    }
    // LAB: no validation that quantity > 0 or quantity <= stock
    const item = await this.prisma.cartItem.upsert({
      where: {
        userId_productId: { userId: user.id, productId: dto.productId },
      },
      create: {
        userId: user.id,
        productId: dto.productId,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice ?? null,
      },
      update: {
        quantity: dto.quantity,
        unitPrice: dto.unitPrice ?? undefined,
      },
      include: { product: true },
    });
    return {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice != null ? toNumber(item.unitPrice) : null,
      product: publicProduct(item.product),
    };
  }

  @Patch('items/:id')
  @ApiOperation({
    summary: 'Update cart item',
    description: 'LAB: negative quantity and price override allowed.',
  })
  @ApiBody({ type: UpdateCartDto })
  @ApiOkResponse({ type: CartItemDto })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCartDto,
  ): Promise<CartItemDto> {
    const existing = await this.prisma.cartItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Cart item not found');
    // LAB BOLA: no ownership check on cart item id
    const item = await this.prisma.cartItem.update({
      where: { id },
      data: {
        quantity: dto.quantity,
        unitPrice: dto.unitPrice ?? undefined,
      },
      include: { product: true },
    });
    void user;
    return {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice != null ? toNumber(item.unitPrice) : null,
      product: publicProduct(item.product),
    };
  }

  @Delete('items/:id')
  @ApiOperation({
    summary: 'Remove cart item',
    description: 'LAB BOLA: deletes by id without ownership check.',
  })
  @ApiOkResponse({ type: MessageDto })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<MessageDto> {
    const existing = await this.prisma.cartItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Cart item not found');
    // LAB: no ownership check
    await this.prisma.cartItem.delete({ where: { id } });
    void user;
    return { message: 'removed' };
  }
}
