import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from 'typeorm';
import { User } from './user.entity';

@Entity('friendships')
@Unique(['requester', 'addressee'])
export class Friendship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  requester: User;

  @Column()
  requesterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  addressee: User;

  @Column()
  addresseeId: string;

  @Column({ default: 'pending' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
