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

  @ApiProperty({
    required: false,
    description:
      'Four corner points [[x,y],...] in normalized [0,1] coordinates, clockwise from top-left. Present when Gemini returns a polygon outline.',
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  polygon?: Array<[number, number]>;

  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty({ required: false })
  editionOrVersion?: string;

  @ApiProperty({ required: false })
  gameId?: string;

  @ApiProperty({ required: false })
  bggId?: number;

  @ApiProperty({ required: false })
  bggUrl?: string;

  @ApiProperty({ required: false })
  thumbnailUrl?: string;

  @ApiProperty({ required: false })
  imageUrl?: string;

  @ApiProperty({ enum: ['local', 'bgg'] })
  source: 'local' | 'bgg';

  @ApiProperty()
  isOwned: boolean;

  @ApiProperty({
    required: false,
    description: '0-1 confidence that this region is actually a game box',
  })
  detectionConfidence?: number;

  @ApiProperty({
    required: false,
    description: '0-1 confidence in the identified game title',
  })
  gameConfidence?: number;

  @ApiProperty({
    required: false,
    enum: ['none', 'low', 'medium', 'high'],
    description: 'How much of the game box is obscured',
  })
  occlusionLevel?: 'none' | 'low' | 'medium' | 'high';

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Alternative title guesses when gameConfidence < 0.7',
  })
  titleCandidates?: string[];
}

export class ParseShelfPhotoResponseDto {
  @ApiProperty({ type: [ShelfParseCandidateDto] })
  candidates: ShelfParseCandidateDto[];

  @ApiProperty({
    required: false,
    description:
      'Base64 JPEG of the shelf photo with numbered polygon/bounding-box annotations drawn on it',
  })
  annotatedImageBase64?: string;
}
