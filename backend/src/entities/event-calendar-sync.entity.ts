import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Event } from './event.entity';
import { User } from './user.entity';

@Entity('event_calendar_sync')
export class EventCalendarSync {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  event: Event;

  @Column()
  eventId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @Column()
  provider: string;

  @Column({ type: 'varchar', nullable: true })
  calendarId: string | null;

  @Column({ type: 'varchar', nullable: true })
  remoteEventId: string | null;

  @Column({ type: 'varchar', nullable: true })
  remoteEtag: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastOutboundHash: string | null;

  @Column({ default: 'pending' })
  syncState: string;

  @Column({ nullable: true, type: 'text' })
  lastError: string | null;

  @Column({ default: 'outbound' })
  direction: string;

  @Column({ nullable: true, type: 'timestamptz' })
  lastSyncedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
