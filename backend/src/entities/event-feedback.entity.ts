import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { User } from './user.entity';
import { Game } from './game.entity';

@Entity('event_feedback')
export class EventFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (e) => e.feedbacks, { onDelete: 'CASCADE' })
  event: Event;

  @Column()
  eventId: string;

  @ManyToOne(() => User, (u) => u.feedbacks, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Game, { nullable: true })
  game?: Game;

  @Column({ nullable: true })
  gameId?: string;

  @Column({ type: 'int' })
  enjoymentRating: number;

  @Column({ default: false })
  finishedGame: boolean;

  @Column({ nullable: true })
  durationFeel?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;
}
