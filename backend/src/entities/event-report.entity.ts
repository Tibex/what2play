import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
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
  event: Event;

  @Column()
  eventId: string;

  @ManyToOne(() => User, (user) => user.eventReports, { onDelete: 'CASCADE' })
  reporter: User;

  @Column()
  reporterUserId: string;

  @Column({ type: 'varchar' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
