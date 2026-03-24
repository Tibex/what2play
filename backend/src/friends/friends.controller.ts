import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';

@ApiTags('friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/friends')
export class FriendsController {
  constructor(private friendsService: FriendsService) {}

  @Get()
  @ApiOperation({ summary: 'Get friends list' })
  getFriends(@Request() req) {
    return this.friendsService.getFriends(req.user.id);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending friend requests' })
  getPending(@Request() req) {
    return this.friendsService.getPendingRequests(req.user.id);
  }

  @Post('request')
  @ApiOperation({ summary: 'Send friend request' })
  sendRequest(@Request() req, @Body() dto: SendFriendRequestDto) {
    return this.friendsService.sendRequest(req.user.id, dto.email);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept friend request' })
  accept(@Param('id') id: string, @Request() req) {
    return this.friendsService.respondToRequest(id, req.user.id, true);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject friend request' })
  reject(@Param('id') id: string, @Request() req) {
    return this.friendsService.respondToRequest(id, req.user.id, false);
  }

  @Delete(':friendId')
  @ApiOperation({ summary: 'Remove friend' })
  remove(@Request() req, @Param('friendId') friendId: string) {
    return this.friendsService.removeFriend(req.user.id, friendId);
  }
}
