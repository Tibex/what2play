import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RunMultiTableOptimizerDto {
  @ApiPropertyOptional({
    description: 'How many physical tables are available for this run',
    minimum: 1,
    maximum: 24,
    default: 4,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  tableCount?: number;

  @ApiPropertyOptional({
    description:
      'Optional candidate game IDs to constrain the run. Defaults to current event candidates.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  candidateGameIds?: string[];
}
