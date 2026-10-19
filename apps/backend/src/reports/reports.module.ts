import { Module } from '@nestjs/common';
import { ReportSubmissionsController } from './reports.controller';
import { ReportSubmissionService } from './reports.service';

// DbModule is @Global — deliberately not imported (repo convention).
@Module({
  controllers: [ReportSubmissionsController],
  providers: [ReportSubmissionService],
})
export class ReportsModule {}
