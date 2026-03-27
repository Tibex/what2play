import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsService } from './events.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FeedbackService } from '../feedback/feedback.service';
import { VotingService } from '../voting/voting.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RsvpDto } from './dto/rsvp.dto';
import { GuestRsvpDto } from './dto/guest-rsvp.dto';
import { ManualSessionTimingDto } from './dto/manual-session-timing.dto';
import { GuestSubmitVotesDto } from '../voting/dto/guest-submit-votes.dto';
import { InviteFriendsDto } from './dto/invite-friends.dto';

@ApiTags('events')
@Controller('api/events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    @Inject(forwardRef(() => RecommendationsService))
    private readonly recommendationsService: RecommendationsService,
    private readonly votingService: VotingService,
    private readonly notificationsService: NotificationsService,
    private readonly feedbackService: FeedbackService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new event' })
  create(@Request() req, @Body() dto: CreateEventDto) {
    return this.eventsService.create(req.user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user events' })
  getUserEvents(@Request() req) {
    return this.eventsService.findUserEvents(req.user.id);
  }

  @Get('open')
  @ApiOperation({ summary: 'Get public open events' })
  getOpenEvents() {
    return this.eventsService.findOpenEvents();
  }

  @Get('invite/:token')
  @ApiOperation({ summary: 'Get event by invite token' })
  getByInvite(@Param('token') token: string) {
    return this.eventsService.getInviteEvent(token);
  }

  @Post('invite/:token/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join event via invite link' })
  async joinViaInvite(@Param('token') token: string, @Request() req) {
    const result = await this.eventsService.joinViaInvite(token, req.user.id);
    this.recommendationsService.generateCandidates(result.eventId).catch(() => {
      /* non-critical */
    });
    return result;
  }

  @Post('invite/:token/guest-rsvp')
  @ApiOperation({ summary: 'RSVP via invite link without account' })
  async guestRsvpViaInvite(
    @Param('token') token: string,
    @Body() dto: GuestRsvpDto,
  ) {
    const inviteEvent = await this.eventsService.getInviteEvent(token);
    const goingBefore = await this.eventsService.getGoingAttendeeCount(
      inviteEvent.id,
    );
    const result = await this.eventsService.guestRsvp(
      inviteEvent.id,
      dto.guestName,
      dto.status,
      dto.cancellationReason,
    );
    const goingAfter = await this.eventsService.getGoingAttendeeCount(
      inviteEvent.id,
    );

    if (goingBefore !== goingAfter) {
      await this.maybeRegenerateFallbackOptions(inviteEvent.id, goingAfter);
    }

    return result;
  }

  @Get('invite/:token/recommendations')
  @ApiOperation({ summary: 'Get event recommendations by invite token' })
  async getInviteRecommendations(@Param('token') token: string) {
    const inviteEvent = await this.eventsService.getInviteEvent(token);
    return this.recommendationsService.getCandidates(inviteEvent.id);
  }

  @Post('invite/:token/guest-voting')
  @ApiOperation({ summary: 'Submit guest ranked votes via invite token' })
  async submitGuestVotes(
    @Param('token') token: string,
    @Body() dto: GuestSubmitVotesDto,
  ) {
    const inviteEvent = await this.eventsService.getInviteEvent(token);
    const result = await this.votingService.submitGuestVotes(
      inviteEvent.id,
      dto.guestName,
      dto.rankings,
    );
    const status = await this.votingService.getVotingStatus(inviteEvent.id);
    if (status.allVoted) {
      await this.votingService.autoCloseVoting(inviteEvent.id);
      this.notificationsService
        .sendAllVotedNotification(inviteEvent.id)
        .catch(() => {
          /* non-critical */
        });
    }
    return result;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get event details' })
  getEvent(@Param('id') id: string) {
    return this.eventsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update event' })
  async update(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateEventDto,
  ) {
    const before = await this.eventsService.findById(id);
    const updated = await this.eventsService.update(id, req.user.id, dto);

    if (before.status !== 'voting' && updated.status === 'voting') {
      this.notificationsService.sendVotingStartedNotification(id).catch(() => {
        /* non-critical */
      });
    }

    return updated;
  }

  @Post(':id/rsvp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'RSVP to an event' })
  async rsvp(@Param('id') id: string, @Request() req, @Body() dto: RsvpDto) {
    const goingBefore = await this.eventsService.getGoingAttendeeCount(id);
    const result = await this.eventsService.rsvp(
      id,
      req.user.id,
      dto.status,
      dto.cancellationReason,
    );
    const goingAfter = await this.eventsService.getGoingAttendeeCount(id);

    if (goingBefore !== goingAfter) {
      await this.maybeRegenerateFallbackOptions(id, goingAfter);
      this.notificationsService
        .sendCancellationOrSpotUpdate(
          id,
          req.user.id,
          dto.status,
          dto.cancellationReason,
        )
        .catch(() => {
          /* non-critical */
        });
    }

    return result;
  }

  @Post(':id/use-fallback')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Use configured fallback game as selected game' })
  async useFallback(@Param('id') id: string, @Request() req) {
    const event = await this.eventsService.findById(id);
    if (!event.fallbackGameId) {
      return { ok: false, message: 'No fallback game configured' };
    }
    return this.votingService.selectWinner(
      id,
      req.user.id,
      event.fallbackGameId,
    );
  }

  @Post(':id/invite-link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create invite link for event' })
  createInviteLink(@Param('id') id: string, @Request() req) {
    return this.eventsService.createInviteLink(id, req.user.id);
  }

  @Get(':id/inviteable-friends')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get friends who can be invited to event' })
  getInviteableFriends(@Param('id') id: string, @Request() req) {
    return this.eventsService.getInviteableFriends(id, req.user.id);
  }

  @Post(':id/invite-friends')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite existing friends directly to event' })
  async inviteFriends(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: InviteFriendsDto,
  ) {
    const result = await this.eventsService.inviteFriends(
      id,
      req.user.id,
      dto.userIds,
    );
    if (result.invitedUserIds.length > 0) {
      this.notificationsService
        .sendFriendAddedToEventNotification(
          id,
          req.user.id,
          result.invitedUserIds,
        )
        .catch(() => {
          /* non-critical */
        });
    }
    return result;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete event' })
  delete(@Param('id') id: string, @Request() req) {
    return this.eventsService.delete(id, req.user.id);
  }

  @Post(':id/session/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start session timer (host only)' })
  startSession(@Param('id') id: string, @Request() req) {
    return this.eventsService.startSession(id, req.user.id);
  }

  @Post(':id/session/end')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End session timer (host only)' })
  endSession(@Param('id') id: string, @Request() req) {
    return this.eventsService.endSession(id, req.user.id);
  }

  @Patch(':id/session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set manual session timing (host only)' })
  setManualSessionTiming(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: ManualSessionTimingDto,
  ) {
    return this.eventsService.setManualSessionTiming(id, req.user.id, dto);
  }

  @Delete(':id/attendees/:attendeeId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove attendee from event (host only)' })
  async removeAttendee(
    @Param('id') id: string,
    @Param('attendeeId') attendeeId: string,
    @Request() req,
  ) {
    const goingBefore = await this.eventsService.getGoingAttendeeCount(id);
    await this.eventsService.removeAttendee(id, req.user.id, attendeeId);
    const goingAfter = await this.eventsService.getGoingAttendeeCount(id);

    if (goingBefore !== goingAfter) {
      await this.maybeRegenerateFallbackOptions(id, goingAfter);
    }

    return { ok: true };
  }

  @Get(':id/outcome-analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Host analytics for recommended vs voted vs actually played outcomes',
  })
  async getOutcomeAnalytics(@Param('id') id: string, @Request() req) {
    await this.eventsService.assertHostAccess(id, req.user.id);
    const [feedbackAnalytics, deliveryMetrics, event, cancellation] =
      await Promise.all([
        this.feedbackService.getEventFeedbackAnalytics(id),
        this.notificationsService.getDeliveryMetrics(id),
        this.eventsService.findById(id),
        this.eventsService.getCancellationAnalytics(id),
      ]);

    return {
      eventId: id,
      eventStatus: event.status,
      selectedGameId: event.selectedGameId || null,
      fallbackGameId: event.fallbackGameId || null,
      outcomes: feedbackAnalytics,
      notificationDelivery: deliveryMetrics,
      cancellation,
    };
  }

  @Get(':id/cancellation-analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Host cancellation and standby analytics' })
  async getCancellationAnalytics(@Param('id') id: string, @Request() req) {
    await this.eventsService.assertHostAccess(id, req.user.id);
    return this.eventsService.getCancellationAnalytics(id);
  }

  private async maybeRegenerateFallbackOptions(
    eventId: string,
    currentGoingCount: number,
  ): Promise<void> {
    const event = await this.eventsService.findById(eventId);
    const baseline = event.votingStartedAttendeeCount;
    if (
      event.status !== 'confirmed' ||
      baseline == null ||
      Math.abs(currentGoingCount - baseline) < 2
    ) {
      return;
    }
    this.recommendationsService.generateCandidates(eventId).catch(() => {
      /* non-critical */
    });
  }
}
