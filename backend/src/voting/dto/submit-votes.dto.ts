import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class RankingItem {
  @ApiProperty()
  @IsString()
  gameId: string;

  @ApiProperty()
  @IsNumber()
  rank: number;
}

export class SubmitVotesDto {
  @ApiProperty({ type: [RankingItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RankingItem)
  rankings: RankingItem[];
}
