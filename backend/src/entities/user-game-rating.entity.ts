import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { User } from './user.entity';
import { Game } from './game.entity';

@Entity('user_game_ratings')
@Unique(['user', 'game'])
export class UserGameRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (u) => u.gameRatings, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Game, (g) => g.ratings, { onDelete: 'CASCADE' })
  game: Game;

  @Column()
  gameId: string;

  @Column({ type: 'decimal', precision: 3, scale: 1 })
  rating: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
