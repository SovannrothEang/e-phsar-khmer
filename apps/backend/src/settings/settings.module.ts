import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';

/**
 * The runtime settings store. Not `@Global()`: modules that need a policy
 * value import it explicitly, the same way `NotificationsModule` is imported
 * only by callers that actually want to send something.
 */
@Module({
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
