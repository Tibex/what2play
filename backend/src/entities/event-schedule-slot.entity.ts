import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { EventScheduleResponse } from './event-schedule-response.entity';

@Entity('event_schedule_slots')
export class EventScheduleSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (e) => e.scheduleSlots, { onDelete: 'CASCADE' })
  event: Event;

  @Column()
  eventId: string;

  @Column({ type: 'timestamptz' })
  start: Date;

  @Column({ type: 'text', nullable: true })
  label: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => EventScheduleResponse, (r) => r.slot, { cascade: true })
  responses: EventScheduleResponse[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
