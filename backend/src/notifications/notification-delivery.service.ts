import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import nodemailer from 'nodemailer';
import { DataSource, In, Repository } from 'typeorm';
import { NotificationDelivery } from '../entities/notification-delivery.entity';
import { NotificationRecipientDelivery } from '../entities/notification-recipient-delivery.entity';

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

type NotificationRecipient = {
  email: string;
  name?: string;
  userId?: string;
};

type RecipientIdentity = {
  key: string;
  userId: string | null;
  normalizedEmail: string | null;
  recipient: NotificationRecipient;
};

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
  private readonly advisoryLockNamespace = 52_143;
  private emailTransporter: any = null;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
    @InjectRepository(NotificationRecipientDelivery)
    private readonly recipientDeliveryRepo: Repository<NotificationRecipientDelivery>,
  ) {}

  async send(payload: NotificationPayload): Promise<void> {
    const normalizedPayload = this.normalizePayloadRecipients(payload);

    const scopeLockKey = `${normalizedPayload.eventId}:${normalizedPayload.type}`;
    const idempotencyLockKey = normalizedPayload.idempotencyKey;

    await this.withAdvisoryLocks(
      [scopeLockKey, idempotencyLockKey],
      async () => {
        const existing = await this.deliveryRepo.findOne({
          where: { idempotencyKey: normalizedPayload.idempotencyKey },
          select: ['id', 'delivered'],
        });
        if (existing?.delivered) return;

        const recipients = await this.filterRecipientsNotYetDelivered(
          normalizedPayload.eventId,
          normalizedPayload.type,
          normalizedPayload.recipients,
        );
        const dispatchPayload: NotificationPayload = {
          ...normalizedPayload,
          recipients,
          recipientCount: recipients.length,
        };

        const row = existing
          ? await this.deliveryRepo.findOneByOrFail({ id: existing.id })
          : this.deliveryRepo.create({
              eventId: normalizedPayload.eventId,
              type: normalizedPayload.type,
              idempotencyKey: normalizedPayload.idempotencyKey,
              endpoint: null,
              payload: dispatchPayload,
            });
        row.attempts = Number.isFinite(row.attempts) ? row.attempts + 1 : 1;
        row.lastAttemptAt = new Date();
        row.payload = dispatchPayload;

        if (!dispatchPayload.recipients.length) {
          row.endpoint = 'dedupe';
          row.delivered = true;
          row.deliveredAt = new Date();
          row.lastError = null;
          await this.deliveryRepo.save(row);
          return;
        }

        const configuredChannels: string[] = [];
        const successfulChannels: string[] = [];
        const channelErrors: string[] = [];

        const webhookEndpoint = this.config.get<string>(
          'NOTIFICATIONS_WEBHOOK_URL',
        );
        if (webhookEndpoint) {
          configuredChannels.push('webhook');
          try {
            await this.sendWebhook(webhookEndpoint, dispatchPayload);
            successfulChannels.push('webhook');
          } catch (error) {
            channelErrors.push(
              `webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        }

        const pushEndpoint = this.config.get<string>(
          'NOTIFICATIONS_PUSH_WEBHOOK_URL',
        );
        if (pushEndpoint) {
          configuredChannels.push('push');
          try {
            await this.sendPushWebhook(pushEndpoint, dispatchPayload);
            successfulChannels.push('push');
          } catch (error) {
            channelErrors.push(
              `push: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        }

        if (this.shouldSendEmailChannel(webhookEndpoint)) {
          configuredChannels.push('email');
          try {
            await this.sendEmail(dispatchPayload);
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
            `Skipped notification delivery (${dispatchPayload.type}) - no channels configured`,
          );
          return;
        }

        row.endpoint = configuredChannels.join(',');
        row.delivered = successfulChannels.length > 0;
        row.deliveredAt = successfulChannels.length > 0 ? new Date() : null;
        row.lastError = channelErrors.length ? channelErrors.join(' | ') : null;
        await this.deliveryRepo.save(row);

        if (row.delivered) {
          await this.recordRecipientDeliveries(dispatchPayload);
        } else {
          this.logger.error(
            `Notification delivery failed (${dispatchPayload.idempotencyKey}): ${row.lastError}`,
          );
        }
      },
    );
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
    const userIds = Array.from(
      new Set(
        payload.recipients
          .map((recipient) => recipient.userId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
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

  private shouldSendEmailChannel(webhookEndpoint?: string): boolean {
    if (webhookEndpoint?.trim()) {
      // Webhook integrations often handle their own email fan-out.
      // Skip direct SMTP in this mode to avoid duplicate emails.
      return false;
    }
    return this.hasEmailChannelConfigured();
  }

  private normalizePayloadRecipients(
    payload: NotificationPayload,
  ): NotificationPayload {
    const recipients = this.dedupeRecipients(payload.recipients);
    return {
      ...payload,
      recipients,
      recipientCount: recipients.length,
    };
  }

  private dedupeRecipients(
    recipients: NotificationRecipient[],
  ): NotificationRecipient[] {
    const unique: RecipientIdentity[] = [];
    const seen = new Set<string>();

    for (const recipient of recipients) {
      const identity = this.toRecipientIdentity(recipient);
      if (!identity || seen.has(identity.key)) continue;
      seen.add(identity.key);
      unique.push(identity);
    }

    return unique.map((identity) => identity.recipient);
  }

  private toRecipientIdentity(
    recipient: NotificationRecipient,
  ): RecipientIdentity | null {
    const normalizedUserId = recipient.userId?.trim() ?? '';
    const normalizedEmail = recipient.email?.trim().toLowerCase() ?? '';
    const key = normalizedUserId
      ? `user:${normalizedUserId}`
      : normalizedEmail
        ? `email:${normalizedEmail}`
        : '';
    if (!key) return null;

    return {
      key,
      userId: normalizedUserId || null,
      normalizedEmail: normalizedEmail || null,
      recipient: {
        ...recipient,
        email: recipient.email?.trim() ?? '',
      },
    };
  }

  private async filterRecipientsNotYetDelivered(
    eventId: string,
    type: string,
    recipients: NotificationRecipient[],
  ): Promise<NotificationRecipient[]> {
    const identities = recipients
      .map((recipient) => this.toRecipientIdentity(recipient))
      .filter((identity): identity is RecipientIdentity => Boolean(identity));
    if (!identities.length) {
      return [];
    }

    const delivered = await this.recipientDeliveryRepo.find({
      where: {
        eventId,
        type,
        recipientKey: In(identities.map((identity) => identity.key)),
      },
      select: ['recipientKey'],
    });
    const deliveredKeys = new Set(delivered.map((row) => row.recipientKey));

    return identities
      .filter((identity) => !deliveredKeys.has(identity.key))
      .map((identity) => identity.recipient);
  }

  private async recordRecipientDeliveries(
    payload: NotificationPayload,
  ): Promise<void> {
    const rows = payload.recipients
      .map((recipient) => this.toRecipientIdentity(recipient))
      .filter((identity): identity is RecipientIdentity => Boolean(identity))
      .map((identity) => ({
        eventId: payload.eventId,
        type: payload.type,
        recipientKey: identity.key,
        recipientUserId: identity.userId,
        recipientEmail: identity.normalizedEmail,
        idempotencyKey: payload.idempotencyKey,
      }));

    if (!rows.length) {
      return;
    }

    await this.recipientDeliveryRepo
      .createQueryBuilder()
      .insert()
      .values(rows)
      .orIgnore()
      .execute();
  }

  private async withAdvisoryLocks(
    lockKeys: string[],
    task: () => Promise<void>,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    const acquired: string[] = [];
    await queryRunner.connect();

    try {
      for (const key of lockKeys) {
        await queryRunner.query('SELECT pg_advisory_lock($1, hashtext($2))', [
          this.advisoryLockNamespace,
          key,
        ]);
        acquired.push(key);
      }

      await task();
    } finally {
      for (const key of acquired.reverse()) {
        try {
          await queryRunner.query(
            'SELECT pg_advisory_unlock($1, hashtext($2))',
            [this.advisoryLockNamespace, key],
          );
        } catch (error) {
          this.logger.warn(
            `Failed to release advisory lock for notification key ${key}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );
        }
      }

      await queryRunner.release();
    }
  }

  private getEmailTransporter(): any {
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
      'What2Play <no-reply@what2play.games>';
    const html = this.renderEmailHtml(payload);
    const textLines = [payload.body, ''];
    if (this.shouldIncludeFeedbackLink(payload.type)) {
      textLines.push(`Provide feedback: ${payload.feedbackUrl}`);
    } else {
      textLines.push(`Event: ${payload.eventUrl}`);
    }

    await transporter.sendMail({
      from,
      to: from,
      bcc: recipients.join(','),
      subject: payload.title,
      text: textLines.join('\n'),
      html,
    });
  }

  private renderEmailHtml(payload: NotificationPayload): string {
    const title = this.escapeHtml(payload.title);
    const body = this.escapeHtml(payload.body);
    const eventUrl = this.escapeHtml(payload.eventUrl);
    const feedbackUrl = this.escapeHtml(payload.feedbackUrl);
    const primaryLink = this.shouldIncludeFeedbackLink(payload.type)
      ? `
        <p style="margin: 0;">
          <a href="${feedbackUrl}">Provide feedback</a>
        </p>
      `
      : `
        <p style="margin: 0;">
          <a href="${eventUrl}">Open event</a>
        </p>
      `;
    return `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111827;">
        <h2 style="margin-bottom: 8px;">${title}</h2>
        <p style="margin: 0 0 12px 0;">${body}</p>
        ${primaryLink}
      </div>
    `;
  }

  private shouldIncludeFeedbackLink(type: NotificationPayload['type']): boolean {
    return type === 'feedback_prompt';
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
