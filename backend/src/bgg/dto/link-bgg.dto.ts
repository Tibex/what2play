import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkBggDto {
  @ApiProperty({ description: 'BoardGameGeek username' })
  @IsString()
  bggUsername: string;
}
