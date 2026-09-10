import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { FilesService } from './files.service';

class SignUploadDto {
  @IsString()
  filename: string;

  @IsIn([
    'avatar',
    'cover',
    'listing',
    'chat',
    'category',
    'subcategory',
    'brand',
    'model',
    'attribute',
  ])
  scope:
    | 'avatar'
    | 'cover'
    | 'listing'
    | 'chat'
    | 'category'
    | 'subcategory'
    | 'brand'
    | 'model'
    | 'attribute';
}

class DeleteFilesDto {
  @IsArray()
  @IsString({ each: true })
  paths: string[];
}

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('sign')
  @ApiOperation({ summary: 'Get a signed upload URL for a file' })
  getSignedUploadUrl(
    @CurrentUser() user: RequestUser,
    @Body() dto: SignUploadDto,
  ) {
    // Chat uploads are namespaced per user so ChatService can verify
    // ownership of an imagePath by its `chat/{userId}/` prefix.
    const folder = dto.scope === 'chat' ? `chat/${user.id}` : dto.scope;
    return this.filesService.createSignedUploadUrl(
      this.filesService.getDefaultBucket(),
      folder,
      dto.filename,
    );
  }

  @Delete()
  @ApiOperation({ summary: 'Delete files by storage paths' })
  deleteFiles(@CurrentUser() user: RequestUser, @Body() dto: DeleteFilesDto) {
    // `chat/` is the only per-user namespace in this bucket, and the storage
    // path of a chat image is handed to the OTHER participant on every message
    // read (MessageRow.imagePath). Without this check the recipient of a photo
    // could delete it out from under the sender — and so could anyone who ever
    // saw the path. Other scopes share a flat namespace and are cleaned up by
    // the admin dashboard, so they stay as-is; see the audit note.
    for (const path of dto.paths) {
      if (
        typeof path === 'string' &&
        path.startsWith('chat/') &&
        !path.startsWith(`chat/${user.id}/`)
      )
        throw new BadRequestException('Cannot delete another user’s files');
    }
    return this.filesService
      .remove(this.filesService.getDefaultBucket(), dto.paths)
      .then(() => ({ removed: true }));
  }
}
