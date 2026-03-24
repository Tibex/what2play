import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Friendship } from '../entities/friendship.entity';
import { User } from '../entities/user.entity';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Friendship, User])],
  providers: [FriendsService],
  controllers: [FriendsController],
  exports: [FriendsService],
})
export class FriendsModule {}
