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

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, EventAttendee, EventInvite]),
    forwardRef(() => RecommendationsModule),
    NotificationsModule,
    FeedbackModule,
  ],
  providers: [EventsService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
