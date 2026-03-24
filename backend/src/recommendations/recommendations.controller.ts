import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecommendationsService } from './recommendations.service';

@ApiTags('recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/events/:eventId/recommendations')
export class RecommendationsController {
  constructor(private recommendationsService: RecommendationsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate game recommendations for event' })
  async generate(@Param('eventId') eventId: string) {
    await this.recommendationsService.generateCandidates(eventId);
    // Return hydrated rows with `game` relation to avoid client null access.
    return this.recommendationsService.getCandidates(eventId);
  }

  @Get()
  @ApiOperation({ summary: 'Get game recommendations for event' })
  getCandidates(@Param('eventId') eventId: string) {
    return this.recommendationsService.getCandidates(eventId);
  }
}
