import { IsString, IsOptional, IsDateString, IsNumber, IsBoolean, IsIn } from 'class-validator';
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
  @IsDateString()
  dateTime: string;

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
}
