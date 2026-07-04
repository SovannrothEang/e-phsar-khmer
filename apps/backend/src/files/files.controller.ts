import { Body, Controller, Delete, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsString } from 'class-validator';
import { FilesService } from './files.service';

class SignUploadDto {
  @IsString()
  filename: string;

  @IsIn(['avatar', 'cover', 'listing'])
  scope: 'avatar' | 'cover' | 'listing';
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
  getSignedUploadUrl(@Body() dto: SignUploadDto) {
    return this.filesService.createSignedUploadUrl(
      this.filesService.getDefaultBucket(),
      dto.scope,
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
