import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddGroupMemberDto } from './dto/add-group-member.dto';

@ApiTags('groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @ApiOperation({ summary: 'List groups for current user' })
  list(@Request() req) {
    return this.groupsService.listForUser(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new recurring group' })
  create(@Request() req, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(req.user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get group details' })
  getOne(@Request() req, @Param('id') id: string) {
    return this.groupsService.getById(id, req.user.id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add member to group (owner/admin)' })
  addMember(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: AddGroupMemberDto,
  ) {
    return this.groupsService.addMember(id, req.user.id, dto);
  }

  @Delete(':id/members/:memberUserId')
  @ApiOperation({ summary: 'Remove member from group (owner/admin)' })
  removeMember(
    @Request() req,
    @Param('id') id: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    return this.groupsService.removeMember(id, req.user.id, memberUserId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete group (owner only)' })
  removeGroup(@Request() req, @Param('id') id: string) {
    return this.groupsService.deleteGroup(id, req.user.id);
  }
}
