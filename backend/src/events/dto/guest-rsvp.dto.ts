import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GuestRsvpDto {
  @ApiProperty({ example: 'Alex' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  guestName: string;

  @ApiProperty({ enum: ['going', 'maybe', 'not_going'] })
  @IsIn(['going', 'maybe', 'not_going'])
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cancellationReason?: string;
}
