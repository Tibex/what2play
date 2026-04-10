import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';

export type MultiTablePlayerGameLock = {
  type: 'player_game';
  userId: string;
  gameId: string;
};

@Entity('event_multi_table_runs')
export class EventMultiTableRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  event: Event;

  @Column()
  eventId: string;

  @Column({ type: 'int' })
  tableCount: number;

  @Column({ type: 'simple-json', nullable: true })
  candidateGameIds: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  locks: MultiTablePlayerGameLock[] | null;

  @Column({ type: 'simple-json' })
  result: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  parentRunId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  committedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
