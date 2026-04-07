import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
import { CalendarModule } from './calendar/calendar.module';
import { SupportModule } from './support/support.module';
import { GroupsModule } from './groups/groups.module';
import { createTypeOrmOptions } from './database/typeorm.config';

function resolveEnvFiles(): string[] {
  const candidates = [
    join(process.cwd(), '.env.local'),
    join(process.cwd(), '.env'),
    join(__dirname, '..', '.env.local'),
    join(__dirname, '..', '.env'),
  ];
  const seen = new Set<string>();
  const existing: string[] = [];
  for (const file of candidates) {
    if (seen.has(file)) continue;
    seen.add(file);
    if (existsSync(file)) existing.push(file);
  }
  return existing.length ? existing : ['.env.local', '.env'];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFiles(),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions =>
        createTypeOrmOptions(config),
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
    CalendarModule,
    GroupsModule,
    SupportModule,
  ],
})
export class AppModule {}
