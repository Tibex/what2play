import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class RerunMultiTableOptimizerDto {
  @ApiPropertyOptional({
    description: 'When true, preserve existing locks from the source run',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  preserveLocks?: boolean;
}
