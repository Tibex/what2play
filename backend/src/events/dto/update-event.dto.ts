import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';
import { IsOptional, IsISO8601, IsString, IsIn } from 'class-validator';

export class UpdateEventDto extends PartialType(
  OmitType(CreateEventDto, [
    'useAvailabilityPoll',
    'availabilitySlots',
  ] as const),
) {
  @ApiPropertyOptional({
    enum: [
      'planning',
      'voting',
      'confirmed',
      'active',
      'completed',
      'cancelled',
    ],
  })
  @IsOptional()
  @IsIn(['planning', 'voting', 'confirmed', 'active', 'completed', 'cancelled'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  votingDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  selectedGameId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fallbackGameId?: string;
}
