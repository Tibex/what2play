import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { Game } from './game.entity';

@Entity('event_game_candidates')
export class EventGameCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (e) => e.candidates, { onDelete: 'CASCADE' })
  event: Event;

  @Column()
  eventId: string;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  game: Game;

  @Column()
  gameId: string;

  @Column({ default: 'owned' })
  source: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score: number;

  @Column({ type: 'simple-json', nullable: true })
  explanation: Record<string, string>;

  @CreateDateColumn()
  createdAt: Date;
}
