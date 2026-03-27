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
    | 'all_voted'
    | 'attendance_change'
    | 'spot_opened'
    | 'event_friend_invited';
  idempotencyKey: string;
  title: string;
  body: string;
  recipientCount: number;
  recipients: Array<{ email: string; name?: string; userId?: string }>;
  eventUrl: string;
  feedbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationDeliveryMetrics {
  total: number;
  delivered: number;
  failed: number;
  pendingRetry: number;
  avgAttempts: number;
}

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  private readonly maxAttempts = 5;

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
    row.lastAttemptAt = new Date();
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
      row.deliveredAt = new Date();
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

  async retryFailedDeliveries(): Promise<number> {
    const rows = await this.deliveryRepo.find({
      where: { delivered: false },
      order: { createdAt: 'ASC' },
      take: 100,
    });

    let retried = 0;
    for (const row of rows) {
      if (row.attempts >= this.maxAttempts) continue;

      const shouldRetry =
        !row.lastAttemptAt ||
        Date.now() - new Date(row.lastAttemptAt).getTime() >=
          Math.min(60_000, Math.pow(2, Math.max(0, row.attempts - 1)) * 5_000);
      if (!shouldRetry) continue;

      const payload = row.payload as NotificationPayload | null;
      if (!payload) continue;
      await this.send(payload);
      retried += 1;
    }

    return retried;
  }

  async getDeliveryMetrics(
    eventId?: string,
  ): Promise<NotificationDeliveryMetrics> {
    const qb = this.deliveryRepo.createQueryBuilder('delivery');
    if (eventId) qb.where('delivery.eventId = :eventId', { eventId });

    const rows = await qb.getMany();
    const delivered = rows.filter((r) => r.delivered).length;
    const failed = rows.filter(
      (r) => !r.delivered && r.attempts >= this.maxAttempts,
    ).length;
    const pendingRetry = rows.filter(
      (r) => !r.delivered && r.attempts < this.maxAttempts,
    ).length;
    const avgAttempts = rows.length
      ? rows.reduce((sum, r) => sum + r.attempts, 0) / rows.length
      : 0;

    return {
      total: rows.length,
      delivered,
      failed,
      pendingRetry,
      avgAttempts,
    };
  }
}
