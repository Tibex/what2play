import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get global notification delivery metrics' })
  getMetrics() {
    return this.notificationsService.getDeliveryMetrics();
  }

  @Get('metrics/event/:eventId')
  @ApiOperation({ summary: 'Get notification delivery metrics for an event' })
  getEventMetrics(@Param('eventId') eventId: string) {
    return this.notificationsService.getDeliveryMetrics(eventId);
  }
}
