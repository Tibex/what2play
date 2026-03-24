import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GamesModule } from './games/games.module';
import { EventsModule } from './events/events.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { VotingModule } from './voting/voting.module';
import { FeedbackModule } from './feedback/feedback.module';
import { BggModule } from './bgg/bgg.module';
import { FriendsModule } from './friends/friends.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST'),
        port: config.get<number>('DATABASE_PORT'),
        username: config.get('DATABASE_USER'),
        password: config.get('DATABASE_PASSWORD'),
        database: config.get('DATABASE_NAME'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    GamesModule,
    EventsModule,
    RecommendationsModule,
    VotingModule,
    FeedbackModule,
    BggModule,
    FriendsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
