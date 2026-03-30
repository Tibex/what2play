import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import nodemailer, { type Transporter } from 'nodemailer';
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
  private emailTransporter: Transporter | null = null;

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

    const row = existing
      ? await this.deliveryRepo.findOneByOrFail({ id: existing.id })
      : this.deliveryRepo.create({
          eventId: payload.eventId,
          type: payload.type,
          idempotencyKey: payload.idempotencyKey,
          endpoint: null,
          payload,
        });
    row.attempts += 1;
    row.lastAttemptAt = new Date();
    row.payload = payload;
    const configuredChannels: string[] = [];
    const successfulChannels: string[] = [];
    const channelErrors: string[] = [];

    const webhookEndpoint = this.config.get<string>('NOTIFICATIONS_WEBHOOK_URL');
    if (webhookEndpoint) {
      configuredChannels.push('webhook');
      try {
        await this.sendWebhook(webhookEndpoint, payload);
        successfulChannels.push('webhook');
      } catch (error) {
        channelErrors.push(
          `webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    const pushEndpoint = this.config.get<string>('NOTIFICATIONS_PUSH_WEBHOOK_URL');
    if (pushEndpoint) {
      configuredChannels.push('push');
      try {
        await this.sendPushWebhook(pushEndpoint, payload);
        successfulChannels.push('push');
      } catch (error) {
        channelErrors.push(
          `push: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    if (this.hasEmailChannelConfigured()) {
      configuredChannels.push('email');
      try {
        await this.sendEmail(payload);
        successfulChannels.push('email');
      } catch (error) {
        channelErrors.push(
          `email: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    if (!configuredChannels.length) {
      row.delivered = false;
      row.lastError =
        'No notification channels configured (set NOTIFICATIONS_WEBHOOK_URL, NOTIFICATIONS_PUSH_WEBHOOK_URL, or SMTP_*)';
      row.endpoint = null;
      await this.deliveryRepo.save(row);
      this.logger.warn(
        `Skipped notification delivery (${payload.type}) - no channels configured`,
      );
      return;
    }

    row.endpoint = configuredChannels.join(',');
    row.delivered = successfulChannels.length > 0;
    row.deliveredAt = successfulChannels.length > 0 ? new Date() : null;
    row.lastError = channelErrors.length ? channelErrors.join(' | ') : null;
    await this.deliveryRepo.save(row);

    if (!row.delivered) {
      this.logger.error(
        `Notification delivery failed (${payload.idempotencyKey}): ${row.lastError}`,
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

  private async sendWebhook(
    endpoint: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
  }

  private async sendPushWebhook(
    endpoint: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const userIds = payload.recipients
      .map((recipient) => recipient.userId)
      .filter((id): id is string => Boolean(id));
    const body = {
      eventId: payload.eventId,
      type: payload.type,
      idempotencyKey: payload.idempotencyKey,
      title: payload.title,
      body: payload.body,
      eventUrl: payload.eventUrl,
      feedbackUrl: payload.feedbackUrl,
      recipientUserIds: userIds,
      metadata: payload.metadata ?? {},
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
  }

  private hasEmailChannelConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST'));
  }

  private getEmailTransporter(): Transporter {
    if (this.emailTransporter) {
      return this.emailTransporter;
    }

    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      throw new Error('SMTP_HOST is not configured');
    }

    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const secure =
      (this.config.get<string>('SMTP_SECURE') ?? '').toLowerCase() === 'true';
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    this.emailTransporter = nodemailer.createTransport({
      host,
      port: Number.isNaN(port) ? 587 : port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
    return this.emailTransporter;
  }

  private async sendEmail(payload: NotificationPayload): Promise<void> {
    const recipients = payload.recipients
      .map((recipient) => recipient.email?.trim())
      .filter((email): email is string => Boolean(email));
    if (!recipients.length) {
      return;
    }

    const transporter = this.getEmailTransporter();
    const from =
      this.config.get<string>('SMTP_FROM') ??
      'Board Game Night <no-reply@board-game-night.local>';
    const html = this.renderEmailHtml(payload);

    await transporter.sendMail({
      from,
      to: from,
      bcc: recipients.join(','),
      subject: payload.title,
      text: `${payload.body}\n\nEvent: ${payload.eventUrl}\nFeedback: ${payload.feedbackUrl}`,
      html,
    });
  }

  private renderEmailHtml(payload: NotificationPayload): string {
    const title = this.escapeHtml(payload.title);
    const body = this.escapeHtml(payload.body);
    const eventUrl = this.escapeHtml(payload.eventUrl);
    const feedbackUrl = this.escapeHtml(payload.feedbackUrl);
    return `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111827;">
        <h2 style="margin-bottom: 8px;">${title}</h2>
        <p style="margin: 0 0 12px 0;">${body}</p>
        <p style="margin: 0 0 8px 0;">
          <a href="${eventUrl}">Open event</a>
        </p>
        <p style="margin: 0;">
          <a href="${feedbackUrl}">Open feedback</a>
        </p>
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
