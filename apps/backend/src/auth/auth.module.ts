import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LoginDevicesService } from './login-devices.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SupabaseStrategy } from './strategies/supabase.strategy';

@Module({
  imports: [
    PassportModule,
    NotificationsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LoginDevicesService, JwtStrategy, SupabaseStrategy],
  exports: [AuthService, LoginDevicesService, JwtModule],
})
export class AuthModule {}
