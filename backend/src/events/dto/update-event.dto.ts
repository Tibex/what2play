import { PartialType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';
import { IsOptional, IsDateString, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEventDto extends PartialType(CreateEventDto) {
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
  @IsDateString()
  votingDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  selectedGameId?: string;
}
