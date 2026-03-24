import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Event } from './event.entity';
import { Game } from './game.entity';

@Entity('session_timings')
export class SessionTiming {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (e) => e.sessionTimings, { onDelete: 'CASCADE' })
  event: Event;

  @Column()
  eventId: string;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  game: Game;

  @Column()
  gameId: string;

  @Column()
  playerCount: number;

  @Column({ nullable: true })
  setupMinutes: number;

  @Column({ nullable: true })
  gameplayMinutes: number;

  @Column({ nullable: true })
  totalMinutes: number;

  @Column({ default: false })
  completed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
