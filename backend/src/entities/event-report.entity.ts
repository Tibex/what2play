import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Event } from './event.entity';
import { User } from './user.entity';

@Entity('event_reports')
@Unique(['eventId', 'reporterUserId'])
export class EventReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (event) => event.reports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  eventId: string;

  @ManyToOne(() => User, (user) => user.eventReports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterUserId' })
  reporter: User;

  @Column({ nullable: true })
  reporterUserId: string | null;

  @Column({ type: 'varchar' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
