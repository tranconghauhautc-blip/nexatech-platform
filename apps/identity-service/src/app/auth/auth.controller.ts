import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
    summary: 'Đăng ký tài khoản Customer',
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
  login(@Body() body: LoginRequestDto, @Req() req: RequestWithHeaders) {
    // Read User-Agent from the real request — do not expose as Swagger
    // parameter (browsers forbid setting User-Agent from fetch/XHR).
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
    summary: 'Yêu cầu OTP đặt lại mật khẩu',
  })
  @ApiBody({ type: ForgotPasswordRequestDto })
  forgotPassword(@Body() body: ForgotPasswordRequestDto) {
    return this.authService.requestPasswordReset(body.email);
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
    summary: 'Thông tin user từ Bearer access token (Swagger Authorize flow)',
  })
  @ApiResponse({ status: 200, type: MeResponseDto })
  @ApiResponse({ status: 401, type: ErrorEnvelopeDto })
  me(@Headers('authorization') authorization?: string) {
    return this.authService.me(authorization);
  }

  @Get('sessions/:userId')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Liệt kê phiên đăng nhập của user',
  })
  listSessions(@Param('userId') userId: string) {
    return this.authService.listSessions(userId);
  }

  @Delete('sessions/:sessionId')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Thu hồi một phiên',
  })
  revokeSession(@Param('sessionId') sessionId: string) {
    return this.authService.logout(sessionId);
  }
}
