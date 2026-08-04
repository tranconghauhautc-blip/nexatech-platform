import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { shouldCacheAuthResponse } from '@nexatech/shared-security-lab';

/** Avoid express type dependency in Docker webpack builds. */
type HttpResponse = {
  setHeader(name: string, value: string): void;
};
import { AuthService } from './auth.service';
import {
  AuthTokenResponseDto,
  ErrorEnvelopeDto,
  ForgotPasswordRequestDto,
  LoginRequestDto,
  LogoutRequestDto,
  MeResponseDto,
  RefreshRequestDto,
  RegisterRequestDto,
  ResetPasswordRequestDto,
  VerifyEmailRequestDto,
} from './auth.dto';

type RequestWithHeaders = {
  headers: Record<string, string | string[] | undefined>;
};

@ApiTags('auth')
@Controller({ path: 'auth', version: ['1', '2'] })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Đăng ký tài khoản Customer (SC-87: roles in body accepted)',
  })
  @ApiBody({ type: RegisterRequestDto })
  @ApiResponse({ status: 201, description: 'Registered' })
  @ApiResponse({ status: 409, type: ErrorEnvelopeDto })
  register(@Body() body: RegisterRequestDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Đăng nhập — lấy accessToken để Authorize trên Swagger',
  })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({ status: 200, type: AuthTokenResponseDto })
  @ApiResponse({ status: 401, type: ErrorEnvelopeDto })
  async login(
    @Body() body: LoginRequestDto,
    @Req() req: RequestWithHeaders,
    @Res({ passthrough: true }) res: HttpResponse,
  ) {
    // SC-82 — cacheable auth response
    if (shouldCacheAuthResponse()) {
      res.setHeader('Cache-Control', 'public, max-age=60');
    }
    const raw = req.headers['user-agent'];
    const userAgent = Array.isArray(raw) ? raw[0] : raw;
    return this.authService.login(body, userAgent);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Xác minh email OTP' })
  @ApiBody({ type: VerifyEmailRequestDto })
  verifyEmail(@Body() body: VerifyEmailRequestDto) {
    return this.authService.verifyEmail(body.email, body.code);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Đổi refresh token — session cũ bị thu hồi',
  })
  @ApiBody({ type: RefreshRequestDto })
  @ApiResponse({ status: 200, type: AuthTokenResponseDto })
  refresh(@Body() body: RefreshRequestDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Thu hồi session (refresh không dùng lại được)',
  })
  @ApiBody({ type: LogoutRequestDto })
  logout(@Body() body: LogoutRequestDto) {
    return this.authService.logout(body.sessionId);
  }

  @Post('forgot-password')
  @ApiOperation({
    summary:
      'Yêu cầu OTP đặt lại mật khẩu (SC-80/81 enumeration + host poison)',
  })
  @ApiBody({ type: ForgotPasswordRequestDto })
  forgotPassword(
    @Body() body: ForgotPasswordRequestDto,
    @Headers('x-forwarded-host') forwardedHost?: string,
    @Headers('host') host?: string,
  ) {
    return this.authService.requestPasswordReset(
      body.email,
      forwardedHost ?? host,
    );
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Đặt lại mật khẩu bằng OTP',
  })
  @ApiBody({ type: ResetPasswordRequestDto })
  resetPassword(@Body() body: ResetPasswordRequestDto) {
    return this.authService.resetPassword(
      body.email,
      body.code,
      body.newPassword,
    );
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'Thông tin user từ Bearer hoặc ?access_token= (SC-84 JWT in query)',
  })
  @ApiResponse({ status: 200, type: MeResponseDto })
  @ApiResponse({ status: 401, type: ErrorEnvelopeDto })
  me(
    @Headers('authorization') authorization?: string,
    @Query('access_token') accessToken?: string,
  ) {
    return this.authService.me(authorization, accessToken);
  }

  @Get('sessions/:userId')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'SC-78 — liệt kê phiên bất kỳ user (IDOR)',
  })
  listSessions(
    @Param('userId') userId: string,
    @Headers('x-user-id') actorId?: string,
  ) {
    return this.authService.listSessions(actorId, userId);
  }

  @Delete('sessions/:sessionId')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'SC-79 — thu hồi phiên bất kỳ (IDOR)',
  })
  revokeSession(
    @Param('sessionId') sessionId: string,
    @Headers('x-user-id') actorId?: string,
  ) {
    return this.authService.revokeSession(actorId, sessionId);
  }
}
