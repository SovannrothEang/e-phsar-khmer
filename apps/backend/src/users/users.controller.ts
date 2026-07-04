import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddPhoneDto } from './dto/add-phone.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: RequestUser) {
    return this.usersService.findById(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get('me/phones')
  @ApiOperation({ summary: 'List current user phones' })
  listPhones(@CurrentUser() user: RequestUser) {
    return this.usersService.listPhones(user.id);
  }

  @Post('me/phones')
  @ApiOperation({ summary: 'Add a phone to current user' })
  addPhone(@CurrentUser() user: RequestUser, @Body() dto: AddPhoneDto) {
    return this.usersService.addPhone(user.id, dto);
  }

  @Patch('me/phones/:phoneId/primary')
  @ApiOperation({ summary: 'Set a phone as primary' })
  setPrimaryPhone(
    @CurrentUser() user: RequestUser,
    @Param('phoneId') phoneId: string,
  ) {
    return this.usersService.setPrimaryPhone(user.id, phoneId);
  }

  @Delete('me/phones/:phoneId')
  @ApiOperation({ summary: 'Remove a phone' })
  removePhone(
    @CurrentUser() user: RequestUser,
    @Param('phoneId') phoneId: string,
  ) {
    return this.usersService.removePhone(user.id, phoneId);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload profile photo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  setAvatar(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.setProfilePhoto(user.id, file);
  }

  @Post('me/cover')
  @ApiOperation({ summary: 'Upload cover photo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  setCover(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.setCoverPhoto(user.id, file);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  getUser(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
