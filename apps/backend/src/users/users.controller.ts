import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { Public } from '../common/decorators/public.decorator';
import { ListFollowsDto } from './dto/list-follows.dto';
import type { RequestUser } from '../common/types/api-response.types';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddPhoneDto } from './dto/add-phone.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { BlockUserDto } from './dto/block-user.dto';
import { ChangeUsernameDto } from './dto/change-username.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { RequestPhoneChangeDto } from './dto/request-phone-change.dto';
import { VerifyPhoneChangeDto } from './dto/verify-phone-change.dto';

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

  @Patch('me/username')
  @ApiOperation({ summary: 'Change current username' })
  changeUsername(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangeUsernameDto,
  ) {
    return this.usersService.changeUsername(user.id, dto);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Change current password' })
  changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.id, dto);
  }

  @Delete('me')
  @ApiOperation({
    summary: 'Deactivate (soft-delete) the current account',
    description:
      'Reversible by signing in again within 90 days; the account and all ' +
      'cascading rows are purged after that.',
  })
  deleteMe(@CurrentUser() user: RequestUser, @Body() dto: DeleteAccountDto) {
    return this.usersService.deleteOwnAccount(user.id, dto);
  }

  @Get('me/phones')
  @ApiOperation({ summary: 'List current user phones' })
  listPhones(@CurrentUser() user: RequestUser) {
    return this.usersService.listPhones(user.id);
  }

  @Post('me/phones/otp')
  @ApiOperation({ summary: 'Send a verification code to a new phone number' })
  requestPhoneChangeOtp(
    @CurrentUser() user: RequestUser,
    @Body() dto: RequestPhoneChangeDto,
  ) {
    return this.usersService.requestPhoneChangeOtp(user.id, dto);
  }

  @Post('me/phones/otp/verify')
  @ApiOperation({
    summary: 'Verify the code and make that phone the active number',
  })
  verifyPhoneChangeOtp(
    @CurrentUser() user: RequestUser,
    @Body() dto: VerifyPhoneChangeDto,
  ) {
    return this.usersService.verifyPhoneChangeOtp(user.id, dto);
  }

  @Post('me/phones')
  @ApiOperation({ summary: 'Add a phone to current user' })
  addPhone(@CurrentUser() user: RequestUser, @Body() dto: AddPhoneDto) {
    return this.usersService.addPhone(user.id, dto);
  }

  @Patch('me/phones/:phoneId')
  @ApiOperation({ summary: 'Edit a saved contact phone number' })
  updatePhone(
    @CurrentUser() user: RequestUser,
    @Param('phoneId', ParseUUIDPipe) phoneId: string,
    @Body() dto: UpdatePhoneDto,
  ) {
    return this.usersService.updatePhone(user.id, phoneId, dto);
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

  @Get('me/blocks')
  @ApiOperation({ summary: 'List users blocked by current user' })
  listBlocks(@CurrentUser() user: RequestUser) {
    return this.usersService.listBlocks(user.id);
  }

  @Post('me/blocks')
  @ApiOperation({ summary: 'Block a user' })
  blockUser(@CurrentUser() user: RequestUser, @Body() dto: BlockUserDto) {
    return this.usersService.blockUser(user.id, dto);
  }

  @Delete('me/blocks/:userId')
  @ApiOperation({ summary: 'Unblock a user' })
  unblockUser(
    @CurrentUser() user: RequestUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.usersService.unblockUser(user.id, userId);
  }

  @Get('me/follow-counts')
  @ApiOperation({ summary: 'Get current user follow counts' })
  getFollowCounts(@CurrentUser() user: RequestUser) {
    return this.usersService.getFollowCounts(user.id);
  }

  @Get('by-username/:username')
  @Public()
  @ApiOperation({
    summary: 'Get a public profile by username',
    description:
      'Anonymous read. Serves only public identity fields and follow counts — never phone, email or moderation state.',
  })
  getProfileByUsername(@Param('username') username: string) {
    return this.usersService.getPublicProfile(username);
  }

  @Get(':id/followers')
  @ApiOperation({ summary: 'List users following this user' })
  listFollowers(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListFollowsDto,
  ) {
    return this.usersService.listFollowers(user.id, id, query);
  }

  @Get(':id/following')
  @ApiOperation({ summary: 'List users this user follows' })
  listFollowing(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListFollowsDto,
  ) {
    return this.usersService.listFollowing(user.id, id, query);
  }

  @Get(':id/follow')
  @ApiOperation({ summary: 'Whether the current user follows this user' })
  getFollowStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.isFollowing(user.id, id);
  }

  @Post(':id/follow')
  @ApiOperation({ summary: 'Follow a user (idempotent)' })
  followUser(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.followUser(user.id, id);
  }

  @Delete(':id/follow')
  @ApiOperation({ summary: 'Unfollow a user (idempotent)' })
  unfollowUser(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.unfollowUser(user.id, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  getUser(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
