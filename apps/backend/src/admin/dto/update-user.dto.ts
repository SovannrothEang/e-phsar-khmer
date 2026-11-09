import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password?: string;

  @IsOptional()
  @IsEnum(['user', 'admin', 'super_admin'])
  role?: 'user' | 'admin' | 'super_admin';

  @IsOptional()
  @IsEnum(['active', 'suspended', 'deleted'])
  status?: 'active' | 'suspended' | 'deleted';

  /**
   * Why the account is being suspended. Required by `AdminService.updateUser`
   * when `status` is `suspended` — the login refusal shows this text to the
   * account, so "suspended" alone would leave nothing to appeal against.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  statusReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  phones?: string[];
}
