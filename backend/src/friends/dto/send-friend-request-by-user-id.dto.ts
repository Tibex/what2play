import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SendFriendRequestByUserIdDto {
  @ApiProperty()
  @IsUUID()
  userId: string;
}
