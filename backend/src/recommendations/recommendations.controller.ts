import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
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
    return this.recommendationsService.getCandidates(eventId);
  }

  @Get()
  @ApiOperation({ summary: 'Get game recommendations for event' })
  getCandidates(@Param('eventId') eventId: string) {
    return this.recommendationsService.getCandidates(eventId);
  }

  @Post('add')
  @ApiOperation({ summary: 'Manually add a game to recommendations' })
  addCandidate(
    @Param('eventId') eventId: string,
    @Body() body: { gameId: string },
  ) {
    return this.recommendationsService.addManualCandidate(eventId, body.gameId);
  }

  @Delete(':candidateId')
  @ApiOperation({ summary: 'Remove a game from recommendations' })
  removeCandidate(
    @Param('eventId') eventId: string,
    @Param('candidateId') candidateId: string,
  ) {
    return this.recommendationsService.removeCandidate(eventId, candidateId);
  }
}
