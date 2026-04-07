import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { EventAttendee } from './event-attendee.entity';
import { EventInvite } from './event-invite.entity';
import { EventGameCandidate } from './event-game-candidate.entity';
import { EventVote } from './event-vote.entity';
import { EventFeedback } from './event-feedback.entity';
import { EventReport } from './event-report.entity';
import { EventScheduleSlot } from './event-schedule-slot.entity';
import { Group } from './group.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  host: User;

  @Column()
  hostId: string;

  @ManyToOne(() => Group, { nullable: true, onDelete: 'SET NULL' })
  group: Group | null;

  @Column({ nullable: true })
  groupId: string | null;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  dateTime: Date | null;

  @Column({ default: 'UTC' })
  eventTimezone: string;

  @Column({ type: 'int', nullable: true })
  durationMinutes: number | null;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @Column({ default: 'invite' })
  type: string;

  @Column({ default: 'planning' })
  status: string;

  @Column({ nullable: true, type: 'timestamptz' })
  votingDeadline: Date;

  @Column({ type: 'int', nullable: true })
  votingStartedAttendeeCount: number | null;

  @Column({ nullable: true })
  selectedGameId: string;

  @Column({ nullable: true })
  fallbackGameId: string;

  @Column({ default: false })
  discoveryMode: boolean;

  @Column({ default: false })
  autoPromoteWaitlist: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastAttendanceChangeAt: Date;

  @Column({ default: false })
  attendanceChangeAfterDecision: boolean;

  @Column({ default: 0 })
  lateCancellationCount: number;

  @Column({ type: 'simple-json', nullable: true })
  excludedGameIds: string[];

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

  @OneToMany(() => EventReport, (r) => r.event)
  reports: EventReport[];

  @OneToMany(() => EventScheduleSlot, (s) => s.event)
  scheduleSlots: EventScheduleSlot[];
}
