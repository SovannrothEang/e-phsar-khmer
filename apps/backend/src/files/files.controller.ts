import { Body, Controller, Delete, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { FilesService } from './files.service';

class SignUploadDto {
  @IsString()
  filename: string;

  @IsIn(['avatar', 'cover', 'listing', 'chat'])
  scope: 'avatar' | 'cover' | 'listing' | 'chat';
}

class DeleteFilesDto {
  @IsArray()
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
  deleteFiles(@Body() dto: DeleteFilesDto) {
    return this.filesService
      .remove(this.filesService.getDefaultBucket(), dto.paths)
      .then(() => ({ removed: true }));
  }
}
