import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AdminListUsersQueryDto } from './dto/admin-list-users-query.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
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
}
