import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import type { RequestUser } from '../common/types/api-response.types';
import { FilesService } from '../files/files.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { SignFeedbackAttachmentDto } from './dto/sign-feedback-attachment.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly filesService: FilesService,
  ) {}

  // Public on purpose: the footer links every visitor here, and the form
  // collects its own name/phone/email. The optional guard only stamps the
  // account when a valid token happens to accompany the request.
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit product feedback (anonymous allowed)' })
  create(
    @CurrentUser() user: RequestUser | null,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.feedbackService.create(user?.id ?? null, dto);
  }

  @Public()
  @Post('attachments/sign')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get a signed upload URL for a feedback photo' })
  signAttachment(@Body() dto: SignFeedbackAttachmentDto) {
    // Anonymous submitters cannot use the JWT-only `/files/sign`, so feedback
    // photos get their own public (throttled) door. Each call gets a fresh
    // `feedback/<uuid>/` folder; the submit only checks the `feedback/`
    // prefix, and the object path is unguessable.
    return this.filesService.createSignedUploadUrl(
      this.filesService.getDefaultBucket(),
      `feedback/${randomUUID()}`,
      dto.filename,
    );
  }
}
