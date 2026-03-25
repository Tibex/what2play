import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportOneGameDto {
  @ApiProperty({ description: 'BoardGameGeek game ID' })
  @IsNumber()
  bggId: number;
}
