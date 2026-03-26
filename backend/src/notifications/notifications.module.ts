import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../entities/event.entity';
import { EventVote } from '../entities/event-vote.entity';
import { NotificationDelivery } from '../entities/notification-delivery.entity';
import { NotificationsService } from './notifications.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { VotingModule } from '../voting/voting.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Event, EventVote, NotificationDelivery]),
    VotingModule,
  ],
  providers: [NotificationsService, NotificationDeliveryService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
