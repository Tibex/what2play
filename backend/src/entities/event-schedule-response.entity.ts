import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { EventScheduleSlot } from './event-schedule-slot.entity';
import { User } from './user.entity';

export const EVENT_SCHEDULE_ANSWERS = ['yes', 'no'] as const;
export type EventScheduleAnswer = (typeof EVENT_SCHEDULE_ANSWERS)[number];

@Entity('event_schedule_responses')
export class EventScheduleResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  event: Event;

  @Column()
  eventId: string;

  @ManyToOne(() => EventScheduleSlot, { onDelete: 'CASCADE' })
  slot: EventScheduleSlot;

  @Column()
  slotId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @Column()
  answer: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
