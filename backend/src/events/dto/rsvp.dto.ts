import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RsvpDto {
  @ApiProperty({ enum: ['going', 'maybe', 'not_going'] })
  @IsIn(['going', 'maybe', 'not_going'])
  status: string;

  @ApiPropertyOptional({ description: 'Optional reason when cancelling late' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cancellationReason?: string;
}
