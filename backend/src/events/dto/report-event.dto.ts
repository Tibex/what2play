import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportEventDto {
  @ApiProperty({
    description: 'Short reason category for the report',
    example: 'inappropriate_behavior',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  reason: string;

  @ApiPropertyOptional({
    description: 'Optional details that help moderators review the report',
    example: 'Host posted abusive messages in event description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
