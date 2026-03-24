import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship } from '../entities/friendship.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friendship)
    private friendsRepo: Repository<Friendship>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async sendRequest(requesterId: string, addresseeEmail: string): Promise<Friendship> {
    const addressee = await this.usersRepo.findOne({ where: { email: addresseeEmail } });
    if (!addressee) throw new NotFoundException('User not found');
    if (addressee.id === requesterId) throw new BadRequestException('Cannot friend yourself');

    const existing = await this.friendsRepo.findOne({
      where: [
        { requesterId, addresseeId: addressee.id },
        { requesterId: addressee.id, addresseeId: requesterId },
      ],
    });
    if (existing) throw new BadRequestException('Friend request already exists');

    const friendship = this.friendsRepo.create({
      requesterId,
      addresseeId: addressee.id,
      status: 'pending',
    });
    return this.friendsRepo.save(friendship);
  }

  async respondToRequest(friendshipId: string, userId: string, accept: boolean): Promise<Friendship> {
    const friendship = await this.friendsRepo.findOne({ where: { id: friendshipId } });
    if (!friendship) throw new NotFoundException('Friend request not found');
    if (friendship.addresseeId !== userId) throw new BadRequestException('Not your request');

    friendship.status = accept ? 'accepted' : 'rejected';
    return this.friendsRepo.save(friendship);
  }

  async getFriends(userId: string): Promise<User[]> {
    const friendships = await this.friendsRepo.find({
      where: [
        { requesterId: userId, status: 'accepted' },
        { addresseeId: userId, status: 'accepted' },
      ],
      relations: ['requester', 'addressee'],
    });

    return friendships.map((f) =>
      f.requesterId === userId ? f.addressee : f.requester,
    );
  }

  async getPendingRequests(userId: string): Promise<Friendship[]> {
    return this.friendsRepo.find({
      where: { addresseeId: userId, status: 'pending' },
      relations: ['requester'],
    });
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    await this.friendsRepo.delete([
      { requesterId: userId, addresseeId: friendId },
      { requesterId: friendId, addresseeId: userId },
    ]);
  }
}
