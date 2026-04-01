import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';

type CreateSupportTicketInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
  sourceUrl?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  private transporter: any = null;

  constructor(private readonly config: ConfigService) {}

  async createTicket(
    input: CreateSupportTicketInput,
  ): Promise<{ ticketId: string }> {
    if (!this.isSmtpConfigured()) {
      throw new ServiceUnavailableException(
        'Support is temporarily unavailable. Please try again later.',
      );
    }

    const to = this.getSupportInbox();
    if (!to) {
      throw new ServiceUnavailableException(
        'Support is temporarily unavailable. Please try again later.',
      );
    }

    const ticketId = this.createTicketId();
    const from =
      this.config.get<string>('SMTP_FROM') ??
      'What2Play <no-reply@what2play.games>';

    try {
      await this.getTransporter().sendMail({
        from,
        to,
        replyTo: { name: input.name, address: input.email },
        subject: `[Support ${ticketId}] ${input.subject}`,
        text: this.renderText(ticketId, input),
        html: this.renderHtml(ticketId, input),
      });
      return { ticketId };
    } catch (error) {
      this.logger.error(
        `Support ticket email failed (${ticketId}): ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw new ServiceUnavailableException(
        'Support is temporarily unavailable. Please try again later.',
      );
    }
  }

  private isSmtpConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST'));
  }

  private getSupportInbox(): string | null {
    const configured = this.config.get<string>('SUPPORT_TICKET_TO')?.trim();
    if (configured) return configured;

    const from = this.config.get<string>('SMTP_FROM')?.trim();
    if (from) return from;

    return null;
  }

  private getTransporter(): ReturnType<typeof nodemailer.createTransport> {
    if (this.transporter) return this.transporter;

    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      throw new Error('SMTP_HOST is not configured');
    }

    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const secure =
      (this.config.get<string>('SMTP_SECURE') ?? '').toLowerCase() === 'true';
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host,
      port: Number.isNaN(port) ? 587 : port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
    return this.transporter;
  }

  private createTicketId(): string {
    const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    return `W2P-${day}-${suffix}`;
  }

  private renderText(
    ticketId: string,
    input: CreateSupportTicketInput,
  ): string {
    return [
      `Ticket ID: ${ticketId}`,
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      `Subject: ${input.subject}`,
      `Source URL: ${input.sourceUrl ?? 'N/A'}`,
      `IP: ${input.ipAddress ?? 'N/A'}`,
      `User Agent: ${input.userAgent ?? 'N/A'}`,
      '',
      'Message:',
      input.message,
    ].join('\n');
  }

  private renderHtml(
    ticketId: string,
    input: CreateSupportTicketInput,
  ): string {
    const escape = (value: string) =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const lines = input.message
      .split('\n')
      .map((line) => escape(line))
      .join('<br/>');

    return `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111827;">
        <h2 style="margin-bottom: 12px;">New support ticket: ${escape(ticketId)}</h2>
        <p><strong>Name:</strong> ${escape(input.name)}</p>
        <p><strong>Email:</strong> ${escape(input.email)}</p>
        <p><strong>Subject:</strong> ${escape(input.subject)}</p>
        <p><strong>Source URL:</strong> ${escape(input.sourceUrl ?? 'N/A')}</p>
        <p><strong>IP:</strong> ${escape(input.ipAddress ?? 'N/A')}</p>
        <p><strong>User Agent:</strong> ${escape(input.userAgent ?? 'N/A')}</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p><strong>Message:</strong></p>
        <p style="white-space: normal;">${lines}</p>
      </div>
    `;
  }
}
