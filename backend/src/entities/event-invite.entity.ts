import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';

@Entity('event_invites')
export class EventInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (e) => e.invites, { onDelete: 'CASCADE' })
  event: Event;

  @Column()
  eventId: string;

  @Column()
  token: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: false })
  used: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
