import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiBody,
} from '@nestjs/swagger';
import { IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import { Public, CurrentUser, AuthUser, signAccessToken } from '../common/auth';
import {
  ErrorResponseDto,
  MessageDto,
  TokenResponseDto,
  UserPublicDto,
} from '../common/dto';
import { publicUser } from '../common/mappers';

class RegisterDto {
  @ApiProperty({ example: 'alice', minLength: 3 })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({ example: 'password123', minLength: 3 })
  @IsString()
  @MinLength(3)
  password!: string;

  @ApiPropertyOptional({ example: 'Alice' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({
    example: 'USER',
    description:
      'LAB Mass Assignment: role is accepted on register (user self-promote)',
  })
  @IsOptional()
  @IsString()
  role?: string;
}

class LoginDto {
  @ApiProperty({ example: 'demo' })
  @IsString()
  username!: string;

  @ApiProperty({ example: 'user123' })
  @IsString()
  password!: string;
}

@ApiTags('Auth')
@ApiExtraModels(ErrorResponseDto, TokenResponseDto, UserPublicDto)
@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register username/password',
    description:
      'LAB: accepts optional `role` (Mass Assignment / self-promote to ADMIN). No email verification.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async register(@Body() dto: RegisterDto): Promise<TokenResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException('Username already taken');
    }

    // LAB: mass assignment — honor client-supplied role
    const role =
      dto.role && ['USER', 'ADMIN'].includes(dto.role.toUpperCase())
        ? (dto.role.toUpperCase() as 'USER' | 'ADMIN')
        : 'USER';

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        displayName: dto.displayName || dto.username,
        role,
        // LAB: store password hint in metadata (sensitive data exposure)
        metadata: { registeredPasswordLength: dto.password.length },
      },
    });

    const accessToken = signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      typ: 'access',
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      user: publicUser(user),
    };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Login and receive JWT',
    description:
      'LAB Broken Authentication: no rate limit; verbose errors; JWT can later be forged with alg=none via /api/lab/jwt-alg-none.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async login(@Body() dto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    // LAB: user enumeration via distinct messages
    if (!user) {
      throw new UnauthorizedException(`User '${dto.username}' not found`);
    }
    if (!user.enabled) {
      throw new UnauthorizedException('Account disabled');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Wrong password');
    }

    const accessToken = signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      typ: 'access',
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      user: publicUser(user),
    };
  }

  @Post('logout')
  @ApiBearerAuth('bearer')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Logout (stateless)',
    description: 'LAB: JWT is not revoked — token remains valid until expiry.',
  })
  @ApiOkResponse({ type: MessageDto })
  logout(@CurrentUser() _user: AuthUser): MessageDto {
    return { message: 'logged out (token not revoked — lab)' };
  }
}
