import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarChangeLog } from '../entities/calendar-change-log.entity';
import type { CalendarProvider } from './calendar.types';

@Injectable()
export class CalendarWebhookService {
  constructor(
    @InjectRepository(CalendarChangeLog)
    private readonly changeLogRepo: Repository<CalendarChangeLog>,
  ) {}

  async recordInboundChange(params: {
    provider: CalendarProvider;
    body: unknown;
    headers?: Record<string, string | string[] | undefined>;
  }): Promise<{ deduplicated: boolean; changeId: string }> {
    const hintedId =
      this.normalizeHeader(params.headers?.['x-calendar-change-id']) ||
      this.normalizeHeader(params.headers?.['x-goog-channel-id']) ||
      this.normalizeHeader(params.headers?.['x-apple-event-id']);
    const generated = createHash('sha256')
      .update(JSON.stringify(params.body ?? {}))
      .digest('hex');
    const externalChangeId = hintedId || generated;

    const existing = await this.changeLogRepo.findOne({
      where: { provider: params.provider, externalChangeId },
    });
    if (existing) {
      return { deduplicated: true, changeId: existing.id };
    }

    const row = this.changeLogRepo.create({
      provider: params.provider,
      externalChangeId,
      payload: (params.body as Record<string, unknown>) || null,
      status: 'processed',
      processedAt: new Date(),
    });
    const saved = await this.changeLogRepo.save(row);
    return { deduplicated: false, changeId: saved.id };
  }

  private normalizeHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value[0];
    return value;
  }
}
