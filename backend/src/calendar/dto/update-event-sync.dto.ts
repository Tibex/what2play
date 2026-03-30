import { IsBoolean } from 'class-validator';

export class UpdateEventSyncDto {
  @IsBoolean()
  enabled: boolean;
}
