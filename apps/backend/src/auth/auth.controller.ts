import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { AuthService } from './auth.service';
import type { TelegramAuthPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginOtpDto } from './dto/login-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SocialLoginDto } from './dto/social-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login with username/phone + password' })
  login(@Body() dto: LoginDto) {
    return this.authService.loginWithPassword(dto);
  }

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register with phone number (sends OTP)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.registerWithPhone(dto);
  }

  @Post('otp/request')
  @Public()
  @ApiOperation({ summary: 'Request OTP for phone' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestPhoneOtp(dto.phone);
  }

  @Post('otp/login')
  @Public()
  @ApiOperation({
    summary: 'Login with phone + password (validates password, then sends OTP)',
  })
  requestLoginOtp(@Body() dto: LoginOtpDto) {
    return this.authService.requestLoginOtp(dto);
  }

  @Post('otp/verify')
  @Public()
  @ApiOperation({ summary: 'Verify phone OTP and get tokens' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyPhoneOtp(dto);
  }

  @Get('social/:provider/url')
  @Public()
  @ApiOperation({ summary: 'Get OAuth redirect URL for social provider' })
  socialUrl(@Param('provider') provider: 'google' | 'facebook') {
    return this.authService.getSocialAuthUrl(provider);
  }

  @Post('social/callback')
  @Public()
  @ApiOperation({ summary: 'Handle social OAuth callback' })
  socialCallback(@Body() dto: SocialLoginDto) {
    return this.authService.handleSocialCallback(dto);
  }

  @Post('telegram')
  @Public()
  @ApiOperation({ summary: 'Login via Telegram widget' })
  telegramLogin(@Body() payload: TelegramAuthPayload) {
    return this.authService.loginWithTelegram(payload);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@CurrentUser() user: RequestUser) {
    return this.authService.findById(user.id);
  }
}
