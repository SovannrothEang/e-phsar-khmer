import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { OtpRepository } from './otp.repository';
import { OtpService } from './otp.service';
import { OtpSmsSender } from './otp-sms-sender';

/**
 * Own phone-OTP service (codes in `phone_otps`, delivered via PlasGate).
 * Used by `AuthService` only when `OTP_PROVIDER=plasgate` (the shipped
 * default); see the module README. Imports `NotificationsModule` only for the
 * PlasGate client and SMS limiters.
 */
@Module({
  imports: [NotificationsModule],
  providers: [OtpRepository, OtpService, OtpSmsSender],
  exports: [OtpService, OtpSmsSender],
})
export class OtpModule {}
