import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 'BAD_REQUEST' })
  errorCode!: string;

  @ApiProperty({ example: 'Invalid credentials' })
  message!: string;

  @ApiPropertyOptional({ example: { field: 'username' } })
  details?: unknown;

  @ApiProperty({ example: 'trc-1710000000000' })
  traceId!: string;

  @ApiProperty({ example: '2026-08-12T08:00:00.000Z' })
  timestamp!: string;

  @ApiPropertyOptional({
    description: 'LAB: stack trace leaked (Security Misconfiguration)',
  })
  stack?: string;
}

export class UserPublicDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'demo' })
  username!: string;

  @ApiProperty({ example: 'Demo User' })
  displayName!: string;

  @ApiProperty({ enum: ['USER', 'ADMIN'], example: 'USER' })
  role!: string;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty()
  createdAt!: string;
}

export class ProductDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Phone X1' })
  name!: string;

  @ApiProperty({ example: 'Demo smartphone' })
  description!: string;

  @ApiProperty({ example: 9990000, description: 'Price in VND' })
  price!: number;

  @ApiProperty({ example: 25 })
  stock!: number;

  @ApiProperty({ example: true })
  active!: boolean;

  @ApiPropertyOptional({
    description: 'LAB: may include callbackUrl for SSRF demos',
  })
  metadata?: unknown;

  @ApiProperty()
  createdAt!: string;
}

export class CartItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'LAB: client-controlled price used at checkout (price tampering)',
  })
  unitPrice?: number | null;

  @ApiPropertyOptional({ type: ProductDto })
  product?: ProductDto;
}

export class OrderItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  unitPrice!: number;
}

export class OrderDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({
    enum: ['PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'],
  })
  status!: string;

  @ApiProperty()
  totalAmount!: number;

  @ApiProperty({ type: [OrderItemDto] })
  items!: OrderItemDto[];

  @ApiProperty()
  createdAt!: string;
}

export class ReviewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 5 })
  rating!: number;

  @ApiPropertyOptional()
  title?: string | null;

  @ApiProperty()
  content!: string;

  @ApiProperty({ enum: ['PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED'] })
  status!: string;

  @ApiProperty()
  createdAt!: string;
}

export class TokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ type: UserPublicDto })
  user!: UserPublicDto;
}

export class MessageDto {
  @ApiProperty({ example: 'ok' })
  message!: string;
}
