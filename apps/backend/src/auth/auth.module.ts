import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LoginDevicesService } from './login-devices.service';
import { LoginLockoutService } from './login-lockout.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { OtpModule } from '../otp/otp.module';
import { ThrottlerStorageModule } from '../common/throttler/throttler-storage.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    NotificationsModule,
    OtpModule,
    // Shares the throttler's single dedicated Redis connection with the
    // account lockout instead of opening another one.
    ThrottlerStorageModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginDevicesService,
    LoginLockoutService,
    JwtStrategy,
  ],
  exports: [AuthService, LoginDevicesService, JwtModule],
})
export class AuthModule {}
