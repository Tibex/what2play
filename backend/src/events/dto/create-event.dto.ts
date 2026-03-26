import {
  IsString,
  IsOptional,
  IsISO8601,
  IsNumber,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsISO8601({ strict: false })
  dateTime: string;

  @ApiPropertyOptional({
    description: 'IANA timezone used to interpret local dateTime values',
    example: 'Europe/Budapest',
  })
  @IsOptional()
  @IsString()
  eventTimezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  capacity?: number;

  @ApiPropertyOptional({ enum: ['invite', 'open'] })
  @IsOptional()
  @IsIn(['invite', 'open'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  discoveryMode?: boolean;

  @ApiPropertyOptional({
    description:
      'When enabled, first standby attendee is auto-promoted when a going attendee cancels.',
  })
  @IsOptional()
  @IsBoolean()
  autoPromoteWaitlist?: boolean;
}
