import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class SyncSelectedItemDto {
  @IsOptional()
  @IsUUID()
  gameId?: string;

  @IsOptional()
  @IsInt()
  bggId?: number;
}

export class SyncSelectedDto {
  @IsArray()
  @ArrayMinSize(1)
  items: SyncSelectedItemDto[];
}
