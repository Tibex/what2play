import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AppleLoginDto {
  @ApiProperty()
  @IsString()
  identityToken: string;

  @ApiProperty({ required: false, example: 'Alex' })
  @IsOptional()
  @IsString()
  name?: string;
}
