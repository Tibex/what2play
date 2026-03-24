import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VotingService } from './voting.service';
import { SubmitVotesDto } from './dto/submit-votes.dto';

@ApiTags('voting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/events/:eventId/voting')
export class VotingController {
  constructor(private votingService: VotingService) {}

  @Post()
  @ApiOperation({ summary: 'Submit ranked votes' })
  submitVotes(
    @Param('eventId') eventId: string,
    @Request() req,
    @Body() dto: SubmitVotesDto,
  ) {
    return this.votingService.submitVotes(eventId, req.user.id, dto.rankings);
  }

  @Get('results')
  @ApiOperation({ summary: 'Get voting results' })
  getResults(@Param('eventId') eventId: string) {
    return this.votingService.getResults(eventId);
  }

  @Get('my-votes')
  @ApiOperation({ summary: 'Get current user votes' })
  getMyVotes(@Param('eventId') eventId: string, @Request() req) {
    return this.votingService.getUserVotes(eventId, req.user.id);
  }

  @Post('select-winner')
  @ApiOperation({ summary: 'Host selects winning game' })
  selectWinner(
    @Param('eventId') eventId: string,
    @Request() req,
    @Body() body: { gameId?: string },
  ) {
    return this.votingService.selectWinner(eventId, req.user.id, body.gameId);
  }
}
