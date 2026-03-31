import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';

@ApiTags('recommendations')
@Controller('api/recommendations')
export class RecommendationsPublicController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('demo')
  @ApiOperation({ summary: 'Public demo recommendations from live catalog' })
  @ApiQuery({ name: 'players', required: true, type: Number })
  @ApiQuery({
    name: 'complexity',
    required: true,
    enum: ['light', 'medium', 'heavy'],
  })
  @ApiQuery({
    name: 'duration',
    required: true,
    enum: ['short', 'medium', 'long'],
  })
  getDemoRecommendations(
    @Query('players', ParseIntPipe) players: number,
    @Query('complexity') complexity: 'light' | 'medium' | 'heavy',
    @Query('duration') duration: 'short' | 'medium' | 'long',
  ) {
    return this.recommendationsService.getPublicDemoRecommendations(
      players,
      complexity,
      duration,
    );
  }

  @Get('demo/debug')
  @ApiOperation({
    summary: 'Debug public demo recommendation filtering and scoring',
  })
  @ApiQuery({ name: 'players', required: true, type: Number })
  @ApiQuery({
    name: 'complexity',
    required: true,
    enum: ['light', 'medium', 'heavy'],
  })
  @ApiQuery({
    name: 'duration',
    required: true,
    enum: ['short', 'medium', 'long'],
  })
  getDemoRecommendationsDebug(
    @Query('players', ParseIntPipe) players: number,
    @Query('complexity') complexity: 'light' | 'medium' | 'heavy',
    @Query('duration') duration: 'short' | 'medium' | 'long',
  ) {
    return this.recommendationsService.getPublicDemoRecommendationDebug(
      players,
      complexity,
      duration,
    );
  }
}
