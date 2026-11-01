import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { ResumeAttachmentsService } from './resume-attachments.service';
import { ResumeService } from './resume.service';
import { CreateResumeAttachmentDto } from './dto/attachments.dto';
import { UpdatePersonalDto } from './dto/update-personal.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { UpsertEducationDto } from './dto/upsert-education.dto';
import { UpsertExperienceDto } from './dto/upsert-experience.dto';
import { UpsertLanguageDto } from './dto/upsert-language.dto';
import { UpsertReferenceDto } from './dto/upsert-reference.dto';
import { UpsertSkillDto } from './dto/upsert-skill.dto';

/**
 * The resume (CV) API: one reader for the page (`GET /resume`), one writer per
 * dialog, and the three-step CV file handshake. Every route is JWT-guarded and
 * every query inside is scoped to the caller's own resume — there is no
 * cross-user read of a CV, now or later (recruiter visibility, when it comes,
 * arrives through a job application with its own allow-list).
 */
@ApiTags('resume')
@ApiBearerAuth()
@Controller('resume')
export class ResumeController {
  constructor(
    private readonly resume: ResumeService,
    private readonly attachments: ResumeAttachmentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'My resume document, assembled' })
  getDocument(@CurrentUser() user: RequestUser) {
    return this.resume.getDocument(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update the summary, hobbies or job preferences' })
  updateDocument(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateResumeDto,
  ) {
    return this.resume.updateDocument(user.id, dto);
  }

  @Put('personal')
  @ApiOperation({ summary: 'Save Step 1 (personal details)' })
  savePersonal(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdatePersonalDto,
  ) {
    return this.resume.savePersonal(user.id, dto);
  }

  @Put('experiences/:id')
  @ApiOperation({ summary: 'Create or replace one work experience' })
  upsertExperience(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertExperienceDto,
  ) {
    return this.resume.upsertExperience(user.id, id, dto);
  }

  @Delete('experiences/:id')
  @ApiOperation({ summary: 'Delete one work experience' })
  deleteExperience(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resume.deleteExperience(user.id, id);
  }

  @Put('educations/:id')
  @ApiOperation({ summary: 'Create or replace one education' })
  upsertEducation(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertEducationDto,
  ) {
    return this.resume.upsertEducation(user.id, id, dto);
  }

  @Delete('educations/:id')
  @ApiOperation({ summary: 'Delete one education' })
  deleteEducation(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resume.deleteEducation(user.id, id);
  }

  @Put('skills/:id')
  @ApiOperation({ summary: 'Create or replace one skill' })
  upsertSkill(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertSkillDto,
  ) {
    return this.resume.upsertSkill(user.id, id, dto);
  }

  @Delete('skills/:id')
  @ApiOperation({ summary: 'Delete one skill' })
  deleteSkill(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resume.deleteSkill(user.id, id);
  }

  @Put('languages/:id')
  @ApiOperation({ summary: 'Create or replace one language' })
  upsertLanguage(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertLanguageDto,
  ) {
    return this.resume.upsertLanguage(user.id, id, dto);
  }

  @Delete('languages/:id')
  @ApiOperation({ summary: 'Delete one language' })
  deleteLanguage(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resume.deleteLanguage(user.id, id);
  }

  @Put('references/:id')
  @ApiOperation({ summary: 'Create or replace one reference' })
  upsertReference(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertReferenceDto,
  ) {
    return this.resume.upsertReference(user.id, id, dto);
  }

  @Delete('references/:id')
  @ApiOperation({ summary: 'Delete one reference' })
  deleteReference(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resume.deleteReference(user.id, id);
  }

  @Post('attachments')
  // Each create reserves storage; cap the rate on top of the pending-row cap.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reserve a CV file and get its upload URL' })
  createAttachment(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateResumeAttachmentDto,
  ) {
    return this.attachments.create(user.id, dto);
  }

  @Post('attachments/:id/complete')
  @ApiOperation({
    summary: 'Confirm the CV upload finished (verifies the stored size)',
  })
  completeAttachment(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.attachments.complete(user.id, id);
  }

  @Post('attachments/sign')
  @ApiOperation({ summary: 'A short-lived download URL for my CV' })
  signAttachment(@CurrentUser() user: RequestUser) {
    return this.attachments.sign(user.id);
  }

  @Delete('attachments')
  @ApiOperation({ summary: 'Remove my uploaded CV' })
  deleteAttachment(@CurrentUser() user: RequestUser) {
    return this.attachments.deleteAttachment(user.id);
  }
}
