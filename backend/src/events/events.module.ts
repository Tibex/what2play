import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../entities/event.entity';
import { EventAttendee } from '../entities/event-attendee.entity';
import { EventInvite } from '../entities/event-invite.entity';
import { EventReport } from '../entities/event-report.entity';
import { EventScheduleSlot } from '../entities/event-schedule-slot.entity';
import { EventScheduleResponse } from '../entities/event-schedule-response.entity';
import { EventMultiTableRun } from '../entities/event-multi-table-run.entity';
import { EventVote } from '../entities/event-vote.entity';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FeedbackModule } from '../feedback/feedback.module';
import { VotingModule } from '../voting/voting.module';
import { FriendsModule } from '../friends/friends.module';
import { EventsLifecycleService } from './events-lifecycle.service';
import { RolesGuard } from '../auth/roles.guard';
import { CalendarModule } from '../calendar/calendar.module';
import { GroupsModule } from '../groups/groups.module';
import { MultiTableOptimizerService } from './multi-table-optimizer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      EventAttendee,
      EventInvite,
      EventReport,
      EventScheduleSlot,
      EventScheduleResponse,
      EventMultiTableRun,
      EventVote,
    ]),
    forwardRef(() => RecommendationsModule),
    VotingModule,
    NotificationsModule,
    FeedbackModule,
    FriendsModule,
    CalendarModule,
    GroupsModule,
  ],
  providers: [
    EventsService,
    EventsLifecycleService,
    MultiTableOptimizerService,
    RolesGuard,
  ],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
