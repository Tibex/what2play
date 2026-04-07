import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../entities/group.entity';
import { GroupMember } from '../entities/group-member.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddGroupMemberDto } from './dto/add-group-member.dto';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groupsRepo: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly membersRepo: Repository<GroupMember>,
  ) {}

  async listForUser(userId: string): Promise<Group[]> {
    const memberships = await this.membersRepo.find({
      where: { userId },
      select: ['groupId'],
    });
    const groupIds = [...new Set(memberships.map((row) => row.groupId))];
    if (!groupIds.length) return [];
    return this.groupsRepo.find({
      where: groupIds.map((id) => ({ id })),
      relations: ['members', 'members.user'],
      order: { updatedAt: 'DESC' },
    });
  }

  async create(userId: string, dto: CreateGroupDto): Promise<Group> {
    const group = await this.groupsRepo.save(
      this.groupsRepo.create({
        ownerId: userId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      }),
    );
    await this.membersRepo.save(
      this.membersRepo.create({
        groupId: group.id,
        userId,
        role: 'owner',
      }),
    );
    return this.getById(group.id, userId);
  }

  async getById(groupId: string, userId: string): Promise<Group> {
    const group = await this.groupsRepo.findOne({
      where: { id: groupId },
      relations: ['members', 'members.user'],
    });
    if (!group) throw new NotFoundException('Group not found');
    if (!group.members.some((member) => member.userId === userId)) {
      throw new ForbiddenException('Group not found');
    }
    return group;
  }

  async addMember(
    groupId: string,
    actorId: string,
    dto: AddGroupMemberDto,
  ): Promise<Group> {
    await this.assertCanManage(groupId, actorId);
    const existing = await this.membersRepo.findOne({
      where: { groupId, userId: dto.userId },
    });
    if (existing)
      throw new BadRequestException('User is already in this group');
    await this.membersRepo.save(
      this.membersRepo.create({
        groupId,
        userId: dto.userId,
        role: dto.role ?? 'member',
      }),
    );
    return this.getById(groupId, actorId);
  }

  async removeMember(
    groupId: string,
    actorId: string,
    memberUserId: string,
  ): Promise<{ ok: true }> {
    const managerRole = await this.assertCanManage(groupId, actorId);
    if (actorId === memberUserId) {
      throw new BadRequestException('Use leave group flow for yourself');
    }
    const member = await this.membersRepo.findOne({
      where: { groupId, userId: memberUserId },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'owner' && managerRole !== 'owner') {
      throw new ForbiddenException('Only owner can remove owner');
    }
    await this.membersRepo.remove(member);
    return { ok: true };
  }

  async assertMembership(groupId: string, userId: string): Promise<void> {
    const membership = await this.membersRepo.findOne({
      where: { groupId, userId },
      select: ['id'],
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }
  }

  async getMemberUserIds(groupId: string): Promise<string[]> {
    const rows = await this.membersRepo.find({
      where: { groupId },
      select: ['userId'],
    });
    return [...new Set(rows.map((row) => row.userId))];
  }

  private async assertCanManage(
    groupId: string,
    actorId: string,
  ): Promise<'owner' | 'admin' | 'member'> {
    const membership = await this.membersRepo.findOne({
      where: { groupId, userId: actorId },
      select: ['role'],
    });
    if (!membership) throw new ForbiddenException('Group not found');
    if (membership.role === 'member') {
      throw new ForbiddenException('Only group admins can manage members');
    }
    return membership.role;
  }
}
