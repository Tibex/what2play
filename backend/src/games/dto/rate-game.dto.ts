import { IsString, IsNumber, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RateGameDto {
  @ApiProperty()
  @IsString()
  gameId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Max(10)
  rating: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
