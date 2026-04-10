import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PlayerGameLockDto {
  @ApiProperty({ enum: ['player_game'] })
  @IsIn(['player_game'])
  type: 'player_game';

  @ApiProperty()
  @IsUUID('4')
  userId: string;

  @ApiProperty()
  @IsUUID('4')
  gameId: string;
}

export class UpdateMultiTableLocksDto {
  @ApiPropertyOptional({ type: [PlayerGameLockDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerGameLockDto)
  add?: PlayerGameLockDto[];

  @ApiPropertyOptional({ type: [PlayerGameLockDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerGameLockDto)
  remove?: PlayerGameLockDto[];
}
