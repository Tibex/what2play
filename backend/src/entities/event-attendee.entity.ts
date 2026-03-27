import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Event } from './event.entity';

@Entity('event_attendees')
@Unique(['event', 'user'])
export class EventAttendee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (e) => e.attendees, { onDelete: 'CASCADE' })
  event: Event;

  @Column()
  eventId: string;

  @ManyToOne(() => User, (u) => u.attendances, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  user: User;

  @Column({ type: 'varchar', nullable: true })
  userId: string;

  @Column({ default: 'going' })
  rsvpStatus: string;

  @Column({ type: 'varchar', nullable: true })
  cancellationReason: string | null;

  @Column({ type: 'int', nullable: true })
  waitlistPriority: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastStatusChangeAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
