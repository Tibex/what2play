import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const EVENT_STATUSES = [
  'planning',
  'voting',
  'confirmed',
  'active',
  'past',
  'completed',
  'cancelled',
] as const;

export class AdminListEventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsIn(EVENT_STATUSES)
  status?: (typeof EVENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  hostId?: string;

  @IsOptional()
  @IsBooleanString()
  reportedOnly?: string;
}
