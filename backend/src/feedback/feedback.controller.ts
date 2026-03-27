import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FeedbackService } from './feedback.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';

@ApiTags('feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/events/:eventId/feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: 'Submit post-event feedback' })
  submitFeedback(
    @Param('eventId') eventId: string,
    @Request() req,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.feedbackService.submitFeedback(eventId, req.user.id, dto);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get feedback submission status for current user' })
  getStatus(@Param('eventId') eventId: string, @Request() req) {
    return this.feedbackService.getFeedbackStatus(eventId, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get event feedback' })
  getEventFeedback(@Param('eventId') eventId: string) {
    return this.feedbackService.getEventFeedback(eventId);
  }

  @Get('analytics')
  @ApiOperation({
    summary: 'Get recommended vs voted vs played analytics for event',
  })
  getEventFeedbackAnalytics(@Param('eventId') eventId: string) {
    return this.feedbackService.getEventFeedbackAnalytics(eventId);
  }
}
