import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationDelivery } from '../entities/notification-delivery.entity';

interface NotificationPayload {
  [key: string]: unknown;
  eventId: string;
  type:
    | 'event_reminder'
    | 'feedback_prompt'
    | 'voting_started'
    | 'all_voted';
  idempotencyKey: string;
  title: string;
  body: string;
  recipientCount: number;
  recipients: Array<{ email: string; name?: string; userId?: string }>;
  eventUrl: string;
  feedbackUrl: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
  ) {}

  async send(payload: NotificationPayload): Promise<void> {
    const existing = await this.deliveryRepo.findOne({
      where: { idempotencyKey: payload.idempotencyKey },
      select: ['id', 'delivered'],
    });
    if (existing?.delivered) return;

    const endpoint = this.config.get<string>('NOTIFICATIONS_WEBHOOK_URL');
    const row = existing
      ? await this.deliveryRepo.findOneByOrFail({ id: existing.id })
      : this.deliveryRepo.create({
          eventId: payload.eventId,
          type: payload.type,
          idempotencyKey: payload.idempotencyKey,
          endpoint: endpoint ?? null,
          payload,
        });
    row.attempts += 1;
    row.payload = payload;

    if (!endpoint) {
      row.delivered = false;
      row.lastError = 'NOTIFICATIONS_WEBHOOK_URL is not configured';
      await this.deliveryRepo.save(row);
      this.logger.warn(
        `Skipped notification delivery (${payload.type}) - webhook endpoint is not configured`,
      );
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      row.delivered = true;
      row.lastError = null;
      row.endpoint = endpoint;
      await this.deliveryRepo.save(row);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      row.delivered = false;
      row.lastError = msg;
      row.endpoint = endpoint;
      await this.deliveryRepo.save(row);
      this.logger.error(
        `Notification delivery failed (${payload.idempotencyKey}): ${msg}`,
      );
    }
  }
}
