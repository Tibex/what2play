import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class GuestRankingItem {
  @ApiProperty()
  @IsString()
  gameId: string;

  @ApiProperty()
  @IsNumber()
  rank: number;
}

export class GuestSubmitVotesDto {
  @ApiProperty({ example: 'Alex' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  guestName: string;

  @ApiProperty({ type: [GuestRankingItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestRankingItem)
  rankings: GuestRankingItem[];
}
