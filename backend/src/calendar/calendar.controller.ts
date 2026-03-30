import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Headers,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarWebhookService } from './calendar-webhook.service';
import { ConnectCalendarDto } from './dto/connect-calendar.dto';
import { UpdateEventSyncDto } from './dto/update-event-sync.dto';
import type { CalendarProvider } from './calendar.types';
import type { Response as ExpressResponse } from 'express';

@ApiTags('calendar')
@Controller('api/calendar')
export class CalendarController {
  constructor(
    private readonly calendarSyncService: CalendarSyncService,
    private readonly calendarWebhookService: CalendarWebhookService,
  ) {}

  @Get('accounts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List connected calendar accounts' })
  getAccounts(@Req() req) {
    return this.calendarSyncService.getAccounts(req.user.id);
  }

  @Post('connect/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Connect Google or Apple calendar account' })
  connectAccount(
    @Req() req,
    @Param('provider') provider: CalendarProvider,
    @Body() dto: ConnectCalendarDto,
  ) {
    return this.calendarSyncService.connectAccount(req.user.id, provider, dto);
  }

  @Post('disconnect/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Google or Apple calendar account' })
  disconnectAccount(@Req() req, @Param('provider') provider: CalendarProvider) {
    return this.calendarSyncService.disconnectAccount(req.user.id, provider);
  }

  @Get('events/:eventId/sync-state')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get per-event calendar sync state' })
  getEventSyncState(@Req() req, @Param('eventId') eventId: string) {
    return this.calendarSyncService.getEventSyncState(eventId, req.user.id);
  }

  @Patch('events/:eventId/sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable/disable event calendar sync' })
  setEventSyncState(
    @Req() req,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventSyncDto,
  ) {
    return this.calendarSyncService.setEventSyncEnabled(
      eventId,
      req.user.id,
      dto.enabled,
    );
  }

  @Get('google/auth-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate Google Calendar OAuth URL' })
  getGoogleAuthUrl(@Req() req) {
    return {
      url: this.calendarSyncService.createGoogleAuthUrl(req.user.id),
    };
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google Calendar OAuth callback' })
  async googleCallback(@Req() req, @Res() res: ExpressResponse) {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    if (!code || !state) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(
        `${frontendUrl.replace(/\/$/, '')}/profile?calendarConnect=error&provider=google&reason=missing_callback_params`,
      );
      return;
    }
    const redirectUrl = await this.calendarSyncService.completeGoogleOAuth(
      code,
      state,
    );
    res.redirect(redirectUrl);
  }

  @Post('webhook/:provider')
  @ApiOperation({ summary: 'Inbound provider webhook endpoint' })
  async webhook(
    @Param('provider') provider: CalendarProvider,
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const result = await this.calendarWebhookService.recordInboundChange({
      provider,
      body,
      headers,
    });
    return {
      ok: true,
      ...result,
    };
  }
}
