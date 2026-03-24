import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventFeedback } from '../entities/event-feedback.entity';
import { SessionTiming } from '../entities/session-timing.entity';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EventFeedback, SessionTiming])],
  providers: [FeedbackService],
  controllers: [FeedbackController],
  exports: [FeedbackService],
})
export class FeedbackModule {}
