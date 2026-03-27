import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship } from '../entities/friendship.entity';
import { User } from '../entities/user.entity';

export type FriendRequestByUserIdResultStatus =
  | 'sent'
  | 'already_friends'
  | 'request_pending';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friendship)
    private readonly friendsRepo: Repository<Friendship>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async sendRequest(
    requesterId: string,
    addresseeEmail: string,
  ): Promise<Friendship> {
    const addressee = await this.usersRepo.findOne({
      where: { email: addresseeEmail },
    });
    if (!addressee) throw new NotFoundException('User not found');
    if (addressee.id === requesterId)
      throw new BadRequestException('Cannot friend yourself');

    const existing = await this.friendsRepo.findOne({
      where: [
        { requesterId, addresseeId: addressee.id },
        { requesterId: addressee.id, addresseeId: requesterId },
      ],
    });
    if (existing) {
      if (
        existing.status === 'pending' &&
        existing.requesterId === addressee.id &&
        existing.addresseeId === requesterId
      ) {
        existing.status = 'accepted';
        return this.friendsRepo.save(existing);
      }
      throw new BadRequestException('Friend request already exists');
    }

    const friendship = this.friendsRepo.create({
      requesterId,
      addresseeId: addressee.id,
      status: 'pending',
    });
    return this.friendsRepo.save(friendship);
  }

  async respondToRequest(
    friendshipId: string,
    userId: string,
    accept: boolean,
  ): Promise<Friendship> {
    const friendship = await this.friendsRepo.findOne({
      where: { id: friendshipId },
    });
    if (!friendship) throw new NotFoundException('Friend request not found');
    if (friendship.addresseeId !== userId)
      throw new BadRequestException('Not your request');

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

  async getSentPendingRequests(userId: string): Promise<Friendship[]> {
    return this.friendsRepo.find({
      where: { requesterId: userId, status: 'pending' },
      relations: ['addressee'],
    });
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    await this.friendsRepo.delete([
      { requesterId: userId, addresseeId: friendId },
      { requesterId: friendId, addresseeId: userId },
    ]);
  }

  async getFriendIds(userId: string): Promise<string[]> {
    const friendships = await this.friendsRepo.find({
      where: [
        { requesterId: userId, status: 'accepted' },
        { addresseeId: userId, status: 'accepted' },
      ],
      select: ['requesterId', 'addresseeId'],
    });

    return friendships.map((f) =>
      f.requesterId === userId ? f.addresseeId : f.requesterId,
    );
  }

  async sendRequestByUserId(
    requesterId: string,
    addresseeId: string,
  ): Promise<{ status: FriendRequestByUserIdResultStatus }> {
    if (requesterId === addresseeId) {
      throw new BadRequestException('Cannot friend yourself');
    }

    const addressee = await this.usersRepo.findOne({
      where: { id: addresseeId },
      select: ['id'],
    });
    if (!addressee) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.friendsRepo.findOne({
      where: [
        { requesterId, addresseeId },
        { requesterId: addresseeId, addresseeId: requesterId },
      ],
    });

    if (!existing) {
      const friendship = this.friendsRepo.create({
        requesterId,
        addresseeId,
        status: 'pending',
      });
      await this.friendsRepo.save(friendship);
      return { status: 'sent' };
    }

    if (existing.status === 'accepted') {
      return { status: 'already_friends' };
    }

    if (existing.status === 'pending') {
      if (
        existing.requesterId === addresseeId &&
        existing.addresseeId === requesterId
      ) {
        existing.status = 'accepted';
        await this.friendsRepo.save(existing);
        return { status: 'already_friends' };
      }
      return { status: 'request_pending' };
    }

    existing.requesterId = requesterId;
    existing.addresseeId = addresseeId;
    existing.status = 'pending';
    await this.friendsRepo.save(existing);
    return { status: 'sent' };
  }
}
