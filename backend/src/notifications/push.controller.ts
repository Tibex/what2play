import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Repository, In } from 'typeorm';
import webpush from 'web-push';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushSubscribeDto } from './dto/push-subscribe.dto';
import { PushSubscription } from '../entities/push-subscription.entity';

type PushWebhookPayload = {
  eventId: string;
  type: string;
  idempotencyKey: string;
  title: string;
  body: string;
  recipientUserIds: string[];
  eventUrl?: string;
  feedbackUrl?: string;
  metadata?: Record<string, unknown>;
};

@ApiTags('push-notifications')
@Controller('api/notifications')
export class PushController {
  private readonly logger = new Logger(PushController.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(PushSubscription)
    private readonly subscriptionsRepo: Repository<PushSubscription>,
  ) {
    const publicKey = this.config.get<string>('WEB_PUSH_PUBLIC_KEY');
    const privateKey = this.config.get<string>('WEB_PUSH_PRIVATE_KEY');
    if (!publicKey || !privateKey) {
      this.logger.warn(
        'WEB_PUSH_PUBLIC_KEY/WEB_PUSH_PRIVATE_KEY not configured - push sending will fail.',
      );
      return;
    }

    webpush.setVapidDetails(
      `mailto:${this.config.get<string>('SMTP_FROM') ?? 'no-reply@what2play.games'}`,
      publicKey,
      privateKey,
    );
  }

  @Get('push/vapid-public-key')
  @ApiOperation({ summary: 'Get VAPID public key for browser subscription' })
  getVapidPublicKey() {
    const publicKey = this.config.get<string>('WEB_PUSH_PUBLIC_KEY');
    if (!publicKey)
      throw new BadRequestException('WEB_PUSH_PUBLIC_KEY not set');
    return { publicKey };
  }

  @Post('push/subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register browser push subscription for current user',
  })
  async subscribe(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: PushSubscribeDto,
  ) {
    const userId = req.user.id;
    const { endpoint, keys } = dto;

    const existing = await this.subscriptionsRepo.findOne({
      where: { endpoint },
    });

    if (existing) {
      existing.userId = userId;
      existing.p256dh = keys.p256dh;
      existing.auth = keys.auth;
      await this.subscriptionsRepo.save(existing);
    } else {
      await this.subscriptionsRepo.save(
        this.subscriptionsRepo.create({
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        }),
      );
    }

    return { ok: true };
  }

  @Get('push/subscriptions/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user push subscriptions (debug)' })
  async getMySubscriptions(@Req() req: Request & { user: { id: string } }) {
    const userId = req.user.id;
    const subscriptions = await this.subscriptionsRepo.find({
      where: { userId },
    });

    return {
      ok: true,
      count: subscriptions.length,
      endpoints: subscriptions.map((s) => s.endpoint),
    };
  }

  @Post('push-webhook')
  @ApiOperation({
    summary: 'Receive push delivery payload and send Web Push notifications',
  })
  async pushWebhook(@Body() body: PushWebhookPayload) {
    // NotificationDeliveryService already handles idempotency at the delivery-row level.
    const payload = body;
    const recipientUserIds = payload.recipientUserIds ?? [];

    if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
      return { ok: true, delivered: 0, failed: 0 };
    }

    const subscriptions = await this.subscriptionsRepo.find({
      where: { userId: In(recipientUserIds) },
    });

    const subsByUserId = new Map<string, PushSubscription[]>();
    for (const sub of subscriptions) {
      const list = subsByUserId.get(sub.userId) ?? [];
      list.push(sub);
      subsByUserId.set(sub.userId, list);
    }

    const notificationPayload = {
      title: payload.title,
      body: payload.body,
      url: payload.eventUrl ?? payload.feedbackUrl ?? '/',
    };

    let delivered = 0;
    let failed = 0;

    const tasks: Array<Promise<void>> = [];
    for (const userId of recipientUserIds) {
      const userSubs = subsByUserId.get(userId) ?? [];
      for (const sub of userSubs) {
        const webpushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        tasks.push(
          webpush
            .sendNotification(
              webpushSubscription as any,
              JSON.stringify(notificationPayload),
            )
            .then(() => {
              delivered += 1;
            })
            .catch(async (err) => {
              failed += 1;
              const statusCode =
                err?.statusCode ??
                err?.body?.statusCode ??
                err?.response?.statusCode;

              // Common Web Push error codes: 404/410 => subscription is gone/expired.
              if (statusCode === 404 || statusCode === 410) {
                await this.subscriptionsRepo.delete({ endpoint: sub.endpoint });
              }
            }),
        );
      }
    }

    await Promise.allSettled(tasks);
    return { ok: true, delivered, failed };
  }

  @Post('push/test')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send a test Web Push notification to the current user',
  })
  async pushTest(
    @Req() req: Request & { user: { id: string } },
    @Body()
    dto: {
      title?: string;
      body?: string;
      url?: string;
    },
  ) {
    const userId = req.user.id;

    const subscriptions = await this.subscriptionsRepo.find({
      where: { userId },
    });

    if (!subscriptions.length) {
      return { ok: true, delivered: 0, failed: 0, reason: 'No subscriptions' };
    }

    const notificationPayload = {
      title: dto.title ?? 'What2Play',
      body: dto.body ?? 'Test notification',
      url: dto.url ?? '/',
    };

    let delivered = 0;
    let failed = 0;
    const tasks: Array<Promise<void>> = [];

    for (const sub of subscriptions) {
      const webpushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      tasks.push(
        webpush
          .sendNotification(
            webpushSubscription as any,
            JSON.stringify(notificationPayload),
          )
          .then(() => {
            delivered += 1;
          })
          .catch(() => {
            failed += 1;
          }),
      );
    }

    await Promise.allSettled(tasks);
    return { ok: true, delivered, failed };
  }
}
