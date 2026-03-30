import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../entities/event.entity';
import { EventAttendee } from '../entities/event-attendee.entity';
import { EventInvite } from '../entities/event-invite.entity';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, EventAttendee, EventInvite]),
    forwardRef(() => RecommendationsModule),
    VotingModule,
    NotificationsModule,
    FeedbackModule,
    FriendsModule,
    CalendarModule,
  ],
  providers: [EventsService, EventsLifecycleService, RolesGuard],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
