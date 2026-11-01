import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FilesModule } from '../files/files.module';
import { ResumeController } from './resume.controller';
import { ResumeService } from './resume.service';
import { ResumeAttachmentsService } from './resume-attachments.service';
import {
  RESUME_MAINTENANCE_QUEUE,
  ResumeMaintenanceProcessor,
  ResumeMaintenanceScheduler,
} from './resume-maintenance.processor';

/**
 * The CV domain: one document per user, its section tables, and the private
 * bucket object behind the uploaded CV file. `DbModule`/`SupabaseModule` are
 * global and deliberately not imported here; `FilesModule` is, for the photo
 * cleanup on replace (`removeByPublicUrl`).
 */
@Module({
  imports: [
    FilesModule,
    // CV attachment cleanup only — see resume-maintenance.processor.ts.
    BullModule.registerQueue({ name: RESUME_MAINTENANCE_QUEUE }),
  ],
  controllers: [ResumeController],
  providers: [
    ResumeService,
    ResumeAttachmentsService,
    ResumeMaintenanceScheduler,
    ResumeMaintenanceProcessor,
  ],
  // `ResumeAttachmentsService` is exported for its one internal caller: the
  // applications module signs a CV through the application that carried it
  // (`signAttachmentById`) — never a public route of its own.
  exports: [ResumeService, ResumeAttachmentsService],
})
export class ResumeModule {}
