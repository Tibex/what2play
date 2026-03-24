import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RsvpDto {
  @ApiProperty({ enum: ['going', 'maybe', 'not_going'] })
  @IsIn(['going', 'maybe', 'not_going'])
  status: string;
}
