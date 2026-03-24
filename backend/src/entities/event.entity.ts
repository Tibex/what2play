import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { EventAttendee } from './event-attendee.entity';
import { EventInvite } from './event-invite.entity';
import { EventGameCandidate } from './event-game-candidate.entity';
import { EventVote } from './event-vote.entity';
import { EventFeedback } from './event-feedback.entity';
import { SessionTiming } from './session-timing.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  host: User;

  @Column()
  hostId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamptz' })
  dateTime: Date;

  @Column({ nullable: true })
  durationMinutes: number;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  capacity: number;

  @Column({ default: 'invite' })
  type: string;

  @Column({ default: 'planning' })
  status: string;

  @Column({ nullable: true, type: 'timestamptz' })
  votingDeadline: Date;

  @Column({ nullable: true })
  selectedGameId: string;

  @Column({ default: false })
  discoveryMode: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => EventAttendee, (a) => a.event)
  attendees: EventAttendee[];

  @OneToMany(() => EventInvite, (i) => i.event)
  invites: EventInvite[];

  @OneToMany(() => EventGameCandidate, (c) => c.event)
  candidates: EventGameCandidate[];

  @OneToMany(() => EventVote, (v) => v.event)
  votes: EventVote[];

  @OneToMany(() => EventFeedback, (f) => f.event)
  feedbacks: EventFeedback[];

  @OneToMany(() => SessionTiming, (t) => t.event)
  sessionTimings: SessionTiming[];
}
