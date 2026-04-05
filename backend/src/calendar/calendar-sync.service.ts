import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { SyncAccount } from '../entities/sync-account.entity';
import { EventCalendarSync } from '../entities/event-calendar-sync.entity';
import { Event } from '../entities/event.entity';
import { TokenCryptoService } from './token-crypto.service';
import type { CalendarAdapter, CalendarProvider } from './calendar.types';
import { CALENDAR_PROVIDERS } from './calendar.types';
import type { ConnectCalendarDto } from './dto/connect-calendar.dto';
import { GoogleCalendarAdapter } from './adapters/google-calendar.adapter';
import { AppleCalendarAdapter } from './adapters/apple-calendar.adapter';

@Injectable()
export class CalendarSyncService {
  private readonly googleOAuthState = new Map<
    string,
    { userId: string; expiresAt: number }
  >();

  constructor(
    @InjectRepository(SyncAccount)
    private readonly syncAccountRepo: Repository<SyncAccount>,
    @InjectRepository(EventCalendarSync)
    private readonly eventCalendarSyncRepo: Repository<EventCalendarSync>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    private readonly tokenCryptoService: TokenCryptoService,
    private readonly config: ConfigService,
    private readonly googleAdapter: GoogleCalendarAdapter,
    private readonly appleAdapter: AppleCalendarAdapter,
  ) {}

  async getAccounts(userId: string): Promise<SyncAccount[]> {
    const accounts = await this.syncAccountRepo.find({
      where: {
        userId,
        provider: In([...CALENDAR_PROVIDERS]),
      },
      order: { updatedAt: 'DESC' },
    });
    if (this.isAppleCalendarEnabled()) {
      return accounts;
    }
    return accounts.filter((account) => account.provider !== 'apple');
  }

  async connectAccount(
    userId: string,
    provider: CalendarProvider,
    dto: ConnectCalendarDto,
  ): Promise<SyncAccount> {
    this.assertProvider(provider);
    if (provider === 'apple' && !this.isAppleCalendarEnabled()) {
      throw new BadRequestException(
        'Apple Calendar sync is currently disabled while beta implementation is in progress',
      );
    }

    const existing = await this.syncAccountRepo.findOne({
      where: { userId, provider },
    });
    const account =
      existing || this.syncAccountRepo.create({ userId, provider });
    account.status = 'linked';
    account.verified = true;
    account.externalAccountId =
      dto.externalAccountId || account.externalAccountId;
    account.externalUsername = account.externalUsername || null;
    account.scopes = dto.scopes?.length ? dto.scopes : account.scopes || null;
    account.tokenExpiresAt = dto.tokenExpiresAt
      ? new Date(dto.tokenExpiresAt)
      : account.tokenExpiresAt || null;
    account.syncCursor = null;
    account.lastError = null;
    account.lastSyncedAt = new Date();

    try {
      if (dto.accessToken) {
        account.encryptedAccessToken = this.tokenCryptoService.encrypt(
          dto.accessToken,
        );
      }
      if (dto.refreshToken) {
        account.encryptedRefreshToken = this.tokenCryptoService.encrypt(
          dto.refreshToken,
        );
      }
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Calendar token encryption configuration is invalid',
      );
    }

    const saved = await this.syncAccountRepo.save(account);
    await this.syncExistingHostEventsOnConnect(userId);
    return saved;
  }

  createGoogleAuthUrl(userId: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException('GOOGLE_CLIENT_ID is not configured');
    }
    const callbackUrl =
      process.env.GOOGLE_CALENDAR_CALLBACK_URL ||
      'http://localhost:3001/api/calendar/google/callback';
    const state = randomBytes(24).toString('hex');
    this.googleOAuthState.set(state, {
      userId,
      expiresAt: Date.now() + 10 * 60_000,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      scope:
        'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email openid',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async completeGoogleOAuth(code: string, state: string): Promise<string> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectBase = `${frontendUrl.replace(/\/$/, '')}/profile`;
    const stateEntry = this.googleOAuthState.get(state);
    this.googleOAuthState.delete(state);
    if (!stateEntry || stateEntry.expiresAt < Date.now()) {
      return `${redirectBase}?calendarConnect=error&provider=google&reason=invalid_state`;
    }
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl =
      process.env.GOOGLE_CALENDAR_CALLBACK_URL ||
      'http://localhost:3001/api/calendar/google/callback';
    if (!clientId || !clientSecret) {
      return `${redirectBase}?calendarConnect=error&provider=google&reason=oauth_not_configured`;
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      return `${redirectBase}?calendarConnect=error&provider=google&reason=token_exchange_failed`;
    }
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!tokenData.access_token) {
      return `${redirectBase}?calendarConnect=error&provider=google&reason=missing_access_token`;
    }

    const userInfoRes = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );
    const userInfo = (userInfoRes.ok ? await userInfoRes.json() : {}) as {
      sub?: string;
    };
    const tokenExpiresAt =
      typeof tokenData.expires_in === 'number'
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : undefined;
    const scopes = tokenData.scope ? tokenData.scope.split(' ') : undefined;

    try {
      await this.connectAccount(stateEntry.userId, 'google', {
        externalAccountId: userInfo.sub,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt,
        scopes,
      });
      return `${redirectBase}?calendarConnect=success&provider=google`;
    } catch {
      return `${redirectBase}?calendarConnect=error&provider=google&reason=connect_failed`;
    }
  }

  async disconnectAccount(userId: string, provider: CalendarProvider) {
    this.assertProvider(provider);
    const account = await this.syncAccountRepo.findOne({
      where: { userId, provider },
    });
    if (!account) return { ok: true };
    account.status = 'disconnected';
    account.encryptedAccessToken = null;
    account.encryptedRefreshToken = null;
    account.tokenExpiresAt = null;
    account.syncCursor = null;
    account.lastError = null;
    await this.syncAccountRepo.save(account);

    await this.eventCalendarSyncRepo.update(
      { userId, provider },
      {
        syncState: 'disabled',
        lastError: null,
      },
    );
    return { ok: true };
  }

  async queueEventSync(
    eventId: string,
    trigger:
      | 'event_created'
      | 'event_updated'
      | 'event_cancelled'
      | 'attendance_changed',
  ): Promise<void> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      select: [
        'id',
        'hostId',
        'title',
        'description',
        'location',
        'dateTime',
        'durationMinutes',
      ],
    });
    if (!event) return;
    if (!event.dateTime && trigger !== 'event_cancelled') return;
    const accounts = await this.getAccounts(event.hostId);
    if (!accounts.length) return;

    for (const account of accounts) {
      if (account.provider === 'apple' && !this.isAppleCalendarEnabled()) {
        continue;
      }
      const row = await this.eventCalendarSyncRepo.findOne({
        where: { eventId, userId: event.hostId, provider: account.provider },
      });
      const next = row
        ? row
        : this.eventCalendarSyncRepo.create({
            eventId,
            userId: event.hostId,
            provider: account.provider,
            calendarId: null,
          });
      next.syncState =
        trigger === 'event_cancelled' ? 'cancel_pending' : 'pending';
      next.lastError = null;
      const saved = await this.eventCalendarSyncRepo.save(next);
      await this.executeSync(saved, account, trigger, event);
    }
  }

  async getEventSyncState(eventId: string, userId: string) {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      select: ['id', 'hostId'],
    });
    if (!event) throw new NotFoundException('Event not found');
    const rows = await this.eventCalendarSyncRepo.find({
      where: {
        eventId,
        userId: event.hostId,
        provider: In([...CALENDAR_PROVIDERS]),
      },
      order: { updatedAt: 'DESC' },
    });
    return {
      eventId,
      canManage: event.hostId === userId,
      items: rows,
    };
  }

  async setEventSyncEnabled(
    eventId: string,
    userId: string,
    enabled: boolean,
  ): Promise<{ ok: boolean }> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      select: ['id', 'hostId'],
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.hostId !== userId) {
      throw new ForbiddenException(
        'Only host can change calendar sync settings',
      );
    }

    let rows = await this.eventCalendarSyncRepo.find({
      where: { eventId, userId, provider: In([...CALENDAR_PROVIDERS]) },
    });
    if (!rows.length) {
      const connectedAccounts = await this.getAccounts(userId);
      if (!connectedAccounts.length) {
        throw new BadRequestException(
          'No connected calendar accounts for this event',
        );
      }
      rows = [];
      for (const account of connectedAccounts) {
        const created = this.eventCalendarSyncRepo.create({
          eventId,
          userId,
          provider: account.provider,
          syncState: enabled ? 'pending' : 'disabled',
          lastError: null,
        });
        rows.push(await this.eventCalendarSyncRepo.save(created));
      }
    }
    for (const row of rows) {
      row.syncState = enabled ? 'pending' : 'disabled';
      row.lastError = null;
      await this.eventCalendarSyncRepo.save(row);
    }
    if (enabled) {
      const eventForSync = await this.eventRepo.findOne({
        where: { id: eventId },
        select: [
          'id',
          'hostId',
          'title',
          'description',
          'location',
          'dateTime',
          'durationMinutes',
        ],
      });
      if (eventForSync) {
        const accounts = await this.getAccounts(userId);
        for (const row of rows) {
          const account = accounts.find((a) => a.provider === row.provider);
          if (!account) continue;
          await this.executeSync(row, account, 'event_updated', eventForSync);
        }
      }
    }
    return { ok: true };
  }

  private getAdapter(provider: CalendarProvider): CalendarAdapter {
    if (provider === 'google') return this.googleAdapter;
    if (provider === 'apple') return this.appleAdapter;
    throw new BadRequestException('Unsupported calendar provider');
  }

  private async executeSync(
    row: EventCalendarSync,
    account: SyncAccount,
    trigger:
      | 'event_created'
      | 'event_updated'
      | 'event_cancelled'
      | 'attendance_changed',
    event: Pick<
      Event,
      | 'id'
      | 'title'
      | 'description'
      | 'location'
      | 'dateTime'
      | 'durationMinutes'
    >,
  ): Promise<void> {
    if (row.syncState === 'disabled') return;
    if (!event.dateTime && trigger !== 'event_cancelled') return;
    if (!account.encryptedAccessToken) {
      row.syncState = 'error';
      row.lastError = 'No access token available for calendar provider';
      await this.eventCalendarSyncRepo.save(row);
      return;
    }
    const adapter = this.getAdapter(account.provider as CalendarProvider);
    try {
      const accessToken = this.tokenCryptoService.decrypt(
        account.encryptedAccessToken,
      );
      if (trigger === 'event_cancelled' && row.remoteEventId) {
        await adapter.deleteEvent({
          accessToken,
          calendarId: row.calendarId,
          remoteEventId: row.remoteEventId,
        });
        row.syncState = 'cancelled';
        row.lastSyncedAt = new Date();
        row.lastError = null;
        await this.eventCalendarSyncRepo.save(row);
        return;
      }
      if (!event.dateTime) return;
      const payload = await adapter.upsertEvent({
        accessToken,
        calendarId: row.calendarId,
        remoteEventId: row.remoteEventId,
        event: {
          id: event.id,
          title: event.title,
          description: event.description || undefined,
          location: event.location || undefined,
          dateTime: new Date(event.dateTime).toISOString(),
          durationMinutes: event.durationMinutes || undefined,
        },
      });
      row.remoteEventId = payload.remoteEventId;
      row.remoteEtag = payload.etag || null;
      row.syncState = 'synced';
      row.lastSyncedAt = new Date();
      row.lastError = null;
      await this.eventCalendarSyncRepo.save(row);
    } catch (error) {
      row.syncState = 'error';
      row.lastError =
        error instanceof Error
          ? error.message
          : 'Calendar sync execution failed';
      await this.eventCalendarSyncRepo.save(row);
    }
  }

  private assertProvider(
    provider: string,
  ): asserts provider is CalendarProvider {
    if (!CALENDAR_PROVIDERS.includes(provider as CalendarProvider)) {
      throw new BadRequestException('Unsupported calendar provider');
    }
  }

  private isAppleCalendarEnabled(): boolean {
    return this.config.get<string>('CALENDAR_APPLE_BETA_ENABLED') === 'true';
  }

  private async syncExistingHostEventsOnConnect(userId: string): Promise<void> {
    const activeStatuses = ['planning', 'voting', 'confirmed', 'active'];
    const events = await this.eventRepo.find({
      where: {
        hostId: userId,
        status: In(activeStatuses),
        dateTime: Not(IsNull()),
      },
      select: ['id'],
      take: 200,
      order: { dateTime: 'DESC' },
    });
    for (const event of events) {
      await this.queueEventSync(event.id, 'event_updated');
    }
  }
}
