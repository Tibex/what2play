import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('sync_accounts')
export class SyncAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (u) => u.syncAccounts, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @Column({ default: 'bgg' })
  provider: string;

  @Column({ type: 'varchar', nullable: true })
  externalUsername: string | null;

  @Column({ type: 'varchar', nullable: true })
  externalAccountId: string | null;

  @Column({ nullable: true, type: 'text' })
  encryptedAccessToken: string | null;

  @Column({ nullable: true, type: 'text' })
  encryptedRefreshToken: string | null;

  @Column({ type: 'simple-array', nullable: true })
  scopes: string[] | null;

  @Column({ nullable: true, type: 'timestamptz' })
  tokenExpiresAt: Date | null;

  @Column({ nullable: true, type: 'text' })
  syncCursor: string | null;

  @Column({ nullable: true, type: 'text' })
  lastError: string | null;

  @Column({ nullable: true, type: 'timestamptz' })
  lastSyncedAt: Date;

  @Column({ default: 'linked' })
  status: string;

  @Column({ default: false })
  verified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
