import {
  IsString,
  IsOptional,
  IsISO8601,
  IsNumber,
  IsBoolean,
  IsIn,
  ValidateIf,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AvailabilitySlotDto } from './availability-slot.dto';

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Required unless useAvailabilityPoll is true (fixed date/time game night).',
  })
  @ValidateIf((o) => !o.useAvailabilityPoll)
  @IsISO8601({ strict: false })
  dateTime?: string;

  @ApiPropertyOptional({
    description:
      'When true, create the event in scheduling mode with availabilitySlots.',
  })
  @IsOptional()
  @IsBoolean()
  useAvailabilityPoll?: boolean;

  @ApiPropertyOptional({ type: [AvailabilitySlotDto] })
  @ValidateIf((o) => o.useAvailabilityPoll === true)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  availabilitySlots?: AvailabilitySlotDto[];

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

  @ApiPropertyOptional({
    description: 'Optional recurring group ID to attach this event to',
  })
  @IsOptional()
  @IsUUID()
  groupId?: string;
}
