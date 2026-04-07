import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class AddGroupMemberDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  @IsIn(['admin', 'member'])
  role?: 'admin' | 'member';
}
