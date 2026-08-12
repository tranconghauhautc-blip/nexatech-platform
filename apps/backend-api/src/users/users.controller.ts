import {
  Body,
  Controller,
  Get,
  Patch,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import { CurrentUser, AuthUser } from '../common/auth';
import { ErrorResponseDto, MessageDto, UserPublicDto } from '../common/dto';
import { publicUser } from '../common/mappers';
import { Prisma } from '../generated/prisma';

class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'New Name' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({
    example: 'ADMIN',
    description: 'LAB Mass Assignment / BOPLA: role accepted on profile update',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'LAB: arbitrary metadata merge (mass assignment)',
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

class ChangePasswordDto {
  @ApiPropertyOptional({ example: 'user123' })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiPropertyOptional({ example: 'newpass123', minLength: 3 })
  @IsString()
  @MinLength(3)
  newPassword!: string;
}

@ApiTags('Users')
@ApiBearerAuth('bearer')
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: UserPublicDto })
  async me(@CurrentUser() user: AuthUser): Promise<UserPublicDto> {
    const u = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!u) throw new NotFoundException('User not found');
    return publicUser(u);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update profile',
    description:
      'VULNERABLE — Mass Assignment / BOPLA: accepts `role` so a user can self-promote to ADMIN.',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({ type: UserPublicDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserPublicDto> {
    const data: {
      displayName?: string;
      role?: 'USER' | 'ADMIN';
      metadata?: Prisma.InputJsonValue;
    } = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    // LAB: mass assignment of role
    if (dto.role && ['USER', 'ADMIN'].includes(dto.role.toUpperCase())) {
      data.role = dto.role.toUpperCase() as 'USER' | 'ADMIN';
    }
    if (dto.metadata) data.metadata = dto.metadata as Prisma.InputJsonValue;

    const u = await this.prisma.user.update({
      where: { id: user.id },
      data,
    });
    return publicUser(u);
  }

  @Patch('me/password')
  @ApiOperation({
    summary: 'Change password',
    description:
      'LAB Broken Authentication: currentPassword is optional — can set new password without proving old one.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiOkResponse({ type: MessageDto })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<MessageDto> {
    // LAB: skip current password check when omitted
    if (dto.currentPassword) {
      const u = await this.prisma.user.findUnique({ where: { id: user.id } });
      if (!u) throw new NotFoundException();
      const ok = await bcrypt.compare(dto.currentPassword, u.passwordHash);
      if (!ok) {
        throw new NotFoundException('currentPassword mismatch');
      }
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    return { message: 'password updated' };
  }
}
