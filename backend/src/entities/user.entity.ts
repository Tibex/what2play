import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserGameOwnership } from './user-game-ownership.entity';
import { UserGameRating } from './user-game-rating.entity';
import { EventAttendee } from './event-attendee.entity';
import { EventVote } from './event-vote.entity';
import { EventFeedback } from './event-feedback.entity';
import { SyncAccount } from './sync-account.entity';

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  timezone: string;

  @Column({ nullable: true })
  preferredDuration: number;

  @Column({ nullable: true, type: 'decimal', precision: 3, scale: 2 })
  preferredWeight: number;

  @Column({ nullable: true })
  socialProvider: string;

  @Column({ nullable: true })
  socialId: string;

  @Column({ default: 'free' })
  subscriptionTier: string;

  @Column({ default: 'user' })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserGameOwnership, (o) => o.user)
  ownedGames: UserGameOwnership[];

  @OneToMany(() => UserGameRating, (r) => r.user)
  gameRatings: UserGameRating[];

  @OneToMany(() => EventAttendee, (a) => a.user)
  attendances: EventAttendee[];

  @OneToMany(() => EventVote, (v) => v.user)
  votes: EventVote[];

  @OneToMany(() => EventFeedback, (f) => f.user)
  feedbacks: EventFeedback[];

  @OneToMany(() => SyncAccount, (s) => s.user)
  syncAccounts: SyncAccount[];
}
