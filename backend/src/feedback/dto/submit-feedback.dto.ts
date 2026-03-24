import { IsString, IsNumber, IsBoolean, IsOptional, Min, Max, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitFeedbackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gameId?: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  enjoymentRating: number;

  @ApiProperty()
  @IsBoolean()
  finishedGame: boolean;

  @ApiPropertyOptional({ enum: ['too_short', 'just_right', 'too_long'] })
  @IsOptional()
  @IsIn(['too_short', 'just_right', 'too_long'])
  durationFeel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
