import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

function toTrimmedString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateSupportTicketDto {
  @Transform(toTrimmedString)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @Transform(toTrimmedString)
  @IsEmail()
  @MaxLength(200)
  email: string;

  @Transform(toTrimmedString)
  @IsString()
  @MinLength(4)
  @MaxLength(120)
  subject: string;

  @Transform(toTrimmedString)
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  message: string;

  @Transform(toTrimmedString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceUrl?: string;

  // Honeypot anti-spam field. Real users should leave this empty.
  @Transform(toTrimmedString)
  @IsOptional()
  @IsString()
  @MaxLength(0)
  website?: string;
}
