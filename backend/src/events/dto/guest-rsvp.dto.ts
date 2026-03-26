import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class GuestRsvpDto {
  @ApiProperty({ example: 'Alex' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  guestName: string;

  @ApiProperty({ enum: ['going', 'maybe', 'not_going'] })
  @IsIn(['going', 'maybe', 'not_going'])
  status: string;
}
