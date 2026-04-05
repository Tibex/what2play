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
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EventsService } from './events.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FeedbackService } from '../feedback/feedback.service';
import { VotingService } from '../voting/voting.service';
import { CalendarSyncService } from '../calendar/calendar-sync.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RsvpDto } from './dto/rsvp.dto';
import { InviteFriendsDto } from './dto/invite-friends.dto';
import { AdminListEventsQueryDto } from './dto/admin-list-events-query.dto';
import { ReportEventDto } from './dto/report-event.dto';
import { SetEventScheduleResponsesDto } from './dto/set-event-schedule-responses.dto';
import { FinalizeEventScheduleDto } from './dto/finalize-event-schedule.dto';

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
    private readonly calendarSyncService: CalendarSyncService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new event' })
  async create(@Request() req, @Body() dto: CreateEventDto) {
    const created = await this.eventsService.create(req.user.id, dto);
    if (created.dateTime) {
      this.calendarSyncService
        .queueEventSync(created.id, 'event_created')
        .catch(() => {
          /* non-critical */
        });
    }
    return created;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user events' })
  getUserEvents(@Request() req) {
    return this.eventsService.findUserEvents(req.user.id);
  }

  @Get('open')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get public open events' })
  getOpenEvents() {
    return this.eventsService.findOpenEvents();
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin list all events' })
  listAllEvents(@Query() query: AdminListEventsQueryDto) {
    return this.eventsService.listAllForAdmin(query);
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
    const inviteEvent = await this.eventsService.getInviteEvent(token);
    const goingBefore = await this.eventsService.getGoingAttendeeCount(
      inviteEvent.id,
    );
    const result = await this.eventsService.joinViaInvite(token, req.user.id);
    const goingAfter = await this.eventsService.getGoingAttendeeCount(
      result.eventId,
    );
    if (goingBefore !== goingAfter) {
      this.calendarSyncService
        .queueEventSync(result.eventId, 'attendance_changed')
        .catch(() => {
          /* non-critical */
        });
    }
    return result;
  }

  @Get('invite/:token/recommendations')
  @ApiOperation({ summary: 'Get event recommendations by invite token' })
  async getInviteRecommendations(@Param('token') token: string) {
    const inviteEvent = await this.eventsService.getInviteEvent(token);
    if (inviteEvent.status === 'scheduling' || !inviteEvent.dateTime) {
      return [];
    }
    return this.recommendationsService.getCandidates(inviteEvent.id);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report open event for moderation review' })
  reportEvent(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: ReportEventDto,
  ) {
    return this.eventsService.reportOpenEvent(id, req.user.id, dto);
  }

  @Get(':id/schedule')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Availability poll for an event in scheduling status',
  })
  getEventSchedule(@Param('id') id: string, @Request() req) {
    return this.eventsService.getScheduleDetail(id, req.user.id);
  }

  @Patch(':id/schedule/responses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Set availability answers for scheduling event slots',
  })
  async setEventScheduleResponses(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: SetEventScheduleResponsesDto,
  ) {
    await this.eventsService.setScheduleResponses(id, req.user.id, dto);
    return { ok: true };
  }

  @Post(':id/schedule/finalize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Choose the winning time and move the event to planning',
  })
  async finalizeEventSchedule(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: FinalizeEventScheduleDto,
  ) {
    const updated = await this.eventsService.finalizeSchedule(
      id,
      req.user.id,
      dto.winningSlotId,
    );
    this.calendarSyncService.queueEventSync(id, 'event_updated').catch(() => {
      /* non-critical */
    });
    this.recommendationsService.generateCandidates(id).catch(() => {
      /* non-critical */
    });
    this.notificationsService
      .sendScheduleFinalizedNotification(id, dto.winningSlotId)
      .catch(() => {
        /* non-critical */
      });
    return updated;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get event details' })
  getEvent(@Param('id') id: string, @Request() req) {
    return this.eventsService.findByIdForUser(id, req.user.id);
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
    if (updated.dateTime) {
      this.calendarSyncService.queueEventSync(id, 'event_updated').catch(() => {
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
      this.calendarSyncService
        .queueEventSync(id, 'attendance_changed')
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
  async delete(@Param('id') id: string, @Request() req) {
    this.calendarSyncService.queueEventSync(id, 'event_cancelled').catch(() => {
      /* non-critical */
    });
    return this.eventsService.delete(id, req.user.id);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin delete event' })
  async deleteForAdmin(@Param('id') id: string) {
    this.calendarSyncService.queueEventSync(id, 'event_cancelled').catch(() => {
      /* non-critical */
    });
    return this.eventsService.deleteForAdmin(id);
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
      this.calendarSyncService
        .queueEventSync(id, 'attendance_changed')
        .catch(() => {
          /* non-critical */
        });
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
        this.feedbackService.getEventFeedbackAnalytics(id, req.user.id),
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
