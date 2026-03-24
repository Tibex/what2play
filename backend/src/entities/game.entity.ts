import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UserGameOwnership } from './user-game-ownership.entity';
import { UserGameRating } from './user-game-rating.entity';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, unique: true })
  bggId: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ default: 1 })
  minPlayers: number;

  @Column({ default: 4 })
  maxPlayers: number;

  @Column({ nullable: true })
  playingTime: number;

  @Column({ nullable: true })
  minPlayTime: number;

  @Column({ nullable: true })
  maxPlayTime: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  weight: number;

  @Column({ nullable: true })
  yearPublished: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  bggRating: number;

  @Column({ type: 'simple-array', nullable: true })
  categories: string[];

  @Column({ type: 'simple-array', nullable: true })
  mechanics: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserGameOwnership, (o) => o.game)
  owners: UserGameOwnership[];

  @OneToMany(() => UserGameRating, (r) => r.game)
  ratings: UserGameRating[];
}
