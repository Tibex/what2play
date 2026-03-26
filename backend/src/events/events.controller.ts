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
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RsvpDto } from './dto/rsvp.dto';

@ApiTags('events')
@Controller('api/events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    @Inject(forwardRef(() => RecommendationsService))
    private readonly recommendationsService: RecommendationsService,
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
    const goingBefore = await this.eventsService.getAttendeeUserIds(id);
    const result = await this.eventsService.rsvp(id, req.user.id, dto.status);
    const goingAfter = await this.eventsService.getAttendeeUserIds(id);

    if (goingBefore.length !== goingAfter.length) {
      this.recommendationsService.generateCandidates(id).catch(() => {
        /* non-critical */
      });
    }

    return result;
  }

  @Post(':id/invite-link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create invite link for event' })
  createInviteLink(@Param('id') id: string, @Request() req) {
    return this.eventsService.createInviteLink(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete event' })
  delete(@Param('id') id: string, @Request() req) {
    return this.eventsService.delete(id, req.user.id);
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
    const goingBefore = await this.eventsService.getAttendeeUserIds(id);
    await this.eventsService.removeAttendee(id, req.user.id, attendeeId);
    const goingAfter = await this.eventsService.getAttendeeUserIds(id);

    if (goingBefore.length !== goingAfter.length) {
      this.recommendationsService.generateCandidates(id).catch(() => {
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
    const [feedbackAnalytics, deliveryMetrics, event] = await Promise.all([
      this.feedbackService.getEventFeedbackAnalytics(id),
      this.notificationsService.getDeliveryMetrics(id),
      this.eventsService.findById(id),
    ]);

    return {
      eventId: id,
      eventStatus: event.status,
      selectedGameId: event.selectedGameId || null,
      outcomes: feedbackAnalytics,
      notificationDelivery: deliveryMetrics,
    };
  }
}
