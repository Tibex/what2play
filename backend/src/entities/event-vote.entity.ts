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
import { Game } from './game.entity';

@Entity('event_votes')
@Unique(['eventId', 'voterKey', 'gameId'])
export class EventVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (e) => e.votes, { onDelete: 'CASCADE' })
  event: Event;

  @Column()
  eventId: string;

  @ManyToOne(() => User, (u) => u.votes, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column()
  voterKey: string;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  game: Game;

  @Column()
  gameId: string;

  @Column()
  rank: number;

  @CreateDateColumn()
  createdAt: Date;
}
