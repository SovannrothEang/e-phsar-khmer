import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  /** E.164 (`+855…`) — the web normalises with `lib/phone.ts` first. */
  @Matches(/^\+?[1-9]\d{6,14}$/)
  phone: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  /** Storage paths returned by `POST /feedback/attachments/sign`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @IsString({ each: true })
  @MaxLength(512, { each: true })
  imagePaths?: string[];
}
