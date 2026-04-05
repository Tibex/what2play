import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class AvailabilitySlotDto {
  @ApiProperty()
  @IsISO8601({ strict: false })
  start: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;
}
