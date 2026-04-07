import { IsIn, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const allowedInviteTelemetryEvents = [
  'invite_open',
  'invite_auth_handoff_started',
  'invite_join_succeeded',
  'invite_join_failed',
] as const;

export class TrackInviteTelemetryDto {
  @ApiProperty({ enum: allowedInviteTelemetryEvents })
  @IsIn(allowedInviteTelemetryEvents)
  eventName:
    | 'invite_open'
    | 'invite_auth_handoff_started'
    | 'invite_join_succeeded'
    | 'invite_join_failed';

  @ApiPropertyOptional({
    description: 'Optional context for analytics/debugging',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
