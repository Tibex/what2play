import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Event } from './event.entity';
import { User } from './user.entity';

@Entity('recommendation_telemetry')
export class RecommendationTelemetry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, { nullable: true, onDelete: 'SET NULL' })
  event?: Event;

  @Column({ nullable: true })
  eventId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  user?: User;

  @Column({ nullable: true })
  userId?: string;

  @Column()
  eventName: string;

  @Column({ type: 'simple-json', nullable: true })
  payload?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
