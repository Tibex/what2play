import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class ManualSessionTimingDto {
  @ApiProperty()
  @IsISO8601({ strict: false })
  startedAt: string;

  @ApiProperty()
  @IsISO8601({ strict: false })
  endedAt: string;
}
