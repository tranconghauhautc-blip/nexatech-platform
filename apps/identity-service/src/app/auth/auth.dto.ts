import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({
    example: 'staff@nexatech.local',
    description: 'Email đăng nhập (local seed dùng @nexatech.local)',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: '<operator-defined-DEV_SEED_PASSWORD>',
    description: 'Không commit mật khẩu thật vào OpenAPI/repo',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class RegisterRequestDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass1!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string;
}

export class RefreshRequestDto {
  @ApiProperty({
    description: 'Refresh token từ login — không log ra console lab công khai',
  })
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}

export class LogoutRequestDto {
  @ApiProperty({ description: 'Session id gắn với refresh token' })
  @IsString()
  @MinLength(1)
  sessionId!: string;
}

export class VerifyEmailRequestDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(1)
  code!: string;
}

export class ForgotPasswordRequestDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordRequestDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: 'NewStrongPass1!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class AuthTokenResponseDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000001' })
  userId!: string;

  @ApiProperty({
    description: 'JWT access token — dán vào Swagger Authorize (Bearer)',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Refresh token — chỉ dùng cho /auth/refresh; không commit',
  })
  refreshToken!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';
}

export class MeResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ type: [String], example: ['Staff'] })
  roles!: string[];

  @ApiPropertyOptional()
  fullName?: string;

  @ApiPropertyOptional()
  sessionId?: string;

  @ApiPropertyOptional()
  status?: string;
}

export class ErrorEnvelopeDto {
  @ApiProperty({ example: 'UNAUTHORIZED' })
  errorCode!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  details!: Record<string, unknown>;

  @ApiProperty({ format: 'uuid' })
  traceId!: string;

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;
}
