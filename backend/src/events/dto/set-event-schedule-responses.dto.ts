import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { EVENT_SCHEDULE_ANSWERS } from '../../entities/event-schedule-response.entity';

export class SetEventScheduleResponsesDto {
  @ApiProperty({
    description: 'Map of slot id to yes | no',
    example: { 'slot-uuid': 'yes' },
  })
  @IsObject()
  responses: Record<string, string>;
}

export function isValidEventScheduleAnswer(
  v: string,
): v is (typeof EVENT_SCHEDULE_ANSWERS)[number] {
  return (EVENT_SCHEDULE_ANSWERS as readonly string[]).includes(v);
}
