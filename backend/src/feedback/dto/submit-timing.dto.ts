import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitTimingDto {
  @ApiProperty()
  @IsString()
  gameId: string;

  @ApiProperty()
  @IsNumber()
  playerCount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  setupMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gameplayMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
