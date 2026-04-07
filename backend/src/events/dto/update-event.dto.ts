import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';
import { IsOptional, IsISO8601, IsString, IsIn } from 'class-validator';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({
    enum: [
      'scheduling',
      'planning',
      'voting',
      'confirmed',
      'active',
      'completed',
      'cancelled',
    ],
  })
  @IsOptional()
  @IsIn([
    'scheduling',
    'planning',
    'voting',
    'confirmed',
    'active',
    'completed',
    'cancelled',
  ])
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
