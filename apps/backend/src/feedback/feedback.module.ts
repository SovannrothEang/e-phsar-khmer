import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

// DbModule is @Global — deliberately not imported (repo convention).
@Module({
  imports: [FilesModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
