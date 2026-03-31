import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('bgg_catalog_sync')
export class BggCatalogSync {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  jobKey: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastAttemptAt: Date | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  lastAttemptStatus: 'success' | 'failed' | null;

  @Column({ type: 'text', nullable: true })
  lastAttemptMessage: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSuccessAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
