import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('notification_recipient_deliveries')
@Unique(['eventId', 'type', 'recipientKey'])
export class NotificationRecipientDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventId: string;

  @Column()
  type: string;

  @Column()
  recipientKey: string;

  @Column({ type: 'uuid', nullable: true })
  recipientUserId: string | null;

  @Column({ type: 'varchar', nullable: true })
  recipientEmail: string | null;

  @Column()
  idempotencyKey: string;

  @CreateDateColumn()
  deliveredAt: Date;
}
