import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@Controller('api/support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a public support ticket' })
  async createTicket(@Body() dto: CreateSupportTicketDto, @Req() req: Request) {
    const result = await this.supportService.createTicket({
      name: dto.name,
      email: dto.email,
      subject: dto.subject,
      message: dto.message,
      sourceUrl: dto.sourceUrl,
      ipAddress: this.extractIp(req),
      userAgent: req.get('user-agent') ?? undefined,
    });

    return {
      ticketId: result.ticketId,
      message: 'Support ticket submitted successfully.',
    };
  }

  private extractIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0]?.trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0]?.trim();
    }
    return req.socket.remoteAddress ?? undefined;
  }
}
