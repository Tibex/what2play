import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Event } from '../entities/event.entity';
import { AdminListUsersQueryDto } from './dto/admin-list-users-query.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, updates: Partial<User>): Promise<User> {
    await this.usersRepo.update(id, updates);
    return this.findById(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async listForAdmin(query: AdminListUsersQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;
    const trimmedSearch = query.search?.trim();

    const qb = this.usersRepo
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.name',
        'user.avatarUrl',
        'user.subscriptionTier',
        'user.role',
        'user.createdAt',
      ])
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (trimmedSearch) {
      qb.where(
        'LOWER(user.name) LIKE :search OR LOWER(user.email) LIKE :search',
        {
          search: `%${trimmedSearch.toLowerCase()}%`,
        },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        hasNext: page * pageSize < total,
      },
    };
  }

  async deleteForAdmin(userId: string, actorUserId: string): Promise<void> {
    if (userId === actorUserId) {
      throw new ForbiddenException('Admins cannot delete their own account');
    }

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.eventsRepo.delete({ hostId: userId });
    await this.usersRepo.delete(userId);
  }

  async getAdminSummary() {
    const [totalUsers, totalAdmins, usersLast7d] = await Promise.all([
      this.usersRepo.count(),
      this.usersRepo.count({ where: { role: 'admin' } }),
      this.usersRepo
        .createQueryBuilder('usr')
        .where(`usr."createdAt" >= NOW() - INTERVAL '7 days'`)
        .getCount(),
    ]);

    return {
      totalUsers,
      totalAdmins,
      usersLast7d,
    };
  }

  async getAdminActivity(query: { page?: number; pageSize?: number }) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.usersRepo.findAndCount({
      select: ['id', 'name', 'email', 'createdAt'],
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });

    return {
      items: items.map((item) => ({
        id: `user_created:${item.id}`,
        type: 'user_created' as const,
        title: item.name || item.email,
        subtitle: item.email,
        userId: item.id,
        createdAt: item.createdAt.toISOString(),
      })),
      meta: {
        page,
        pageSize,
        total,
        hasNext: page * pageSize < total,
      },
    };
  }
}
