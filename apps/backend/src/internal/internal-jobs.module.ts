import { Module } from '@nestjs/common';
import { OutboxModule } from '../outbox/outbox.module';
import { UsersModule } from '../users/users.module';
import { InternalJobsController } from './internal-jobs.controller';

/**
 * The authenticated cron surface for work that would otherwise depend on a
 * warm instance (see `internal-jobs.controller.ts`).
 */
@Module({
  imports: [OutboxModule, UsersModule],
  controllers: [InternalJobsController],
})
export class InternalJobsModule {}
