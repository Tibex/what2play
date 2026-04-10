import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VotingService } from './voting.service';
import { SubmitVotesDto } from './dto/submit-votes.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { VotingGateway } from './voting.gateway';

@ApiTags('voting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/events/:eventId/voting')
export class VotingController {
  constructor(
    private readonly votingService: VotingService,
    private readonly votingGateway: VotingGateway,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit ranked votes' })
  async submitVotes(
    @Param('eventId') eventId: string,
    @Request() req,
    @Body() dto: SubmitVotesDto,
  ) {
    const result = await this.votingService.submitVotes(
      eventId,
      req.user.id,
      dto.rankings,
    );
    const status = await this.votingService.getVotingStatus(eventId);
    if (status.allVoted) {
      await this.votingService.autoCloseVoting(eventId);
      this.notificationsService.sendAllVotedNotification(eventId).catch(() => {
        /* non-critical */
      });
    }
    await this.votingGateway.emitVotingState(eventId);
    return result;
  }

  @Get('results')
  @ApiOperation({ summary: 'Get voting results' })
  getResults(@Param('eventId') eventId: string) {
    return this.votingService.getResults(eventId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get voting completion status' })
  getStatus(@Param('eventId') eventId: string) {
    return this.votingService.getVotingStatus(eventId);
  }

  @Get('my-votes')
  @ApiOperation({ summary: 'Get current user votes' })
  getMyVotes(@Param('eventId') eventId: string, @Request() req) {
    return this.votingService.getUserVotes(eventId, req.user.id);
  }

  @Post('finish-now')
  @ApiOperation({
    summary: 'Host can finish voting early with current submissions',
  })
  async finishNow(@Param('eventId') eventId: string, @Request() req) {
    const updated = await this.votingService.finishVotingNow(
      eventId,
      req.user.id,
    );
    await this.votingGateway.emitVotingState(eventId);
    return updated;
  }
}
