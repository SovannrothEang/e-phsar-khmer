import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserReportsController } from './reports.controller';
import { UserReportsService } from './reports.service';

@Module({
  imports: [
    FilesModule,
    // Filing a report sends a `report.created` staff notice — importing the
    // module is that choice (it is not global).
    NotificationsModule,
  ],
  controllers: [UserReportsController],
  providers: [UserReportsService],
})
export class UserReportsModule {}
