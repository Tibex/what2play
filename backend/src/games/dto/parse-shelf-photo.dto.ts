import { ApiProperty } from '@nestjs/swagger';

export class ShelfBoundingBoxDto {
  @ApiProperty()
  x: number;

  @ApiProperty()
  y: number;

  @ApiProperty()
  width: number;

  @ApiProperty()
  height: number;
}

export class ShelfParseCandidateDto {
  @ApiProperty()
  detectionNumber: number;

  @ApiProperty()
  rawText: string;

  @ApiProperty({ required: false })
  confidence?: number;

  @ApiProperty({ type: ShelfBoundingBoxDto })
  boundingBox: ShelfBoundingBoxDto;

  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty({ required: false })
  gameId?: string;

  @ApiProperty({ required: false })
  bggId?: number;

  @ApiProperty({ enum: ['local', 'bgg'] })
  source: 'local' | 'bgg';

  @ApiProperty()
  isOwned: boolean;
}

export class ParseShelfPhotoResponseDto {
  @ApiProperty({ type: [ShelfParseCandidateDto] })
  candidates: ShelfParseCandidateDto[];
}
