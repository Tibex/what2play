import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchAddCollectionItemDto {
  @IsOptional()
  @IsUUID()
  gameId?: string;

  @IsOptional()
  @IsInt()
  bggId?: number;

  @IsOptional()
  @IsString()
  title?: string;
}

export class BatchAddCollectionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchAddCollectionItemDto)
  items: BatchAddCollectionItemDto[];
}
