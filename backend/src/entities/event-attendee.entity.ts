import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
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

  @ManyToOne(() => User, (u) => u.attendances, { onDelete: 'CASCADE', nullable: true })
  user: User;

  @Column({ nullable: true })
  userId: string;

  @Column({ default: 'going' })
  rsvpStatus: string;

  @Column({ default: false })
  isGuest: boolean;

  @Column({ nullable: true })
  guestName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
