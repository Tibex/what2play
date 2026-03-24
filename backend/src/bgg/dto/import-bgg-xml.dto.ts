import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportBggXmlDto {
  @ApiProperty({
    description: 'Raw XML content from BoardGameGeek collection endpoint',
    example:
      '<?xml version="1.0" encoding="utf-8"?><items totalitems="1"><item objectid="13"><name>CATAN</name></item></items>',
  })
  @IsString()
  @MinLength(20)
  xml: string;
}
