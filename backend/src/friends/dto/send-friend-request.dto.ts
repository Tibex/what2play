import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendFriendRequestDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}
