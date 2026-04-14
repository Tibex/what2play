import { Inject, forwardRef } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import type { ShelfParseProgressPayload } from './shelf-parse.types';
import { ShelfParseJobService } from './shelf-parse-job.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/shelf-parse' })
export class ShelfParseGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => ShelfParseJobService))
    private readonly shelfParseJobs: ShelfParseJobService,
  ) {}

  private room(jobId: string): string {
    return `shelf-parse:${jobId}`;
  }

  private extractToken(client: Socket): string | null {
    const rawAuthToken = client.handshake.auth?.token;
    if (typeof rawAuthToken === 'string' && rawAuthToken.trim()) {
      return rawAuthToken.trim().replace(/^Bearer\s+/i, '');
    }
    const headerToken = client.handshake.headers.authorization;
    if (typeof headerToken === 'string' && headerToken.trim()) {
      return headerToken.trim().replace(/^Bearer\s+/i, '');
    }
    return null;
  }

  private extractUserId(client: Socket): string {
    const token = this.extractToken(client);
    if (!token) {
      throw new WsException('Unauthorized');
    }
    const secret = this.configService.get<string>(
      'JWT_SECRET',
      'fallback-secret',
    );
    const payload = verify(token, secret) as { sub?: string };
    const userId = payload?.sub;
    if (!userId) {
      throw new WsException('Unauthorized');
    }
    return userId;
  }

  emitProgress(jobId: string, payload: ShelfParseProgressPayload): void {
    this.server.to(this.room(jobId)).emit('shelfParseProgress', payload);
  }

  emitComplete(jobId: string, payload: unknown): void {
    this.server.to(this.room(jobId)).emit('shelfParseComplete', payload);
  }

  emitError(jobId: string, message: string): void {
    this.server.to(this.room(jobId)).emit('shelfParseError', { message });
  }

  @SubscribeMessage('joinJob')
  async handleJoinJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { jobId?: string },
  ) {
    const userId = this.extractUserId(client);
    const jobId = body?.jobId?.trim();
    if (!jobId) {
      throw new WsException('jobId required');
    }
    const replay = this.shelfParseJobs.snapshotForReplay(jobId, userId);
    if (!replay) {
      throw new WsException('Forbidden');
    }
    await client.join(this.room(jobId));
    if (replay.lastProgress) {
      client.emit('shelfParseProgress', replay.lastProgress);
    }
    if (replay.completePayload != null) {
      client.emit('shelfParseComplete', replay.completePayload);
      return { joined: jobId, replayed: true };
    }
    if (replay.errorMessage != null) {
      client.emit('shelfParseError', { message: replay.errorMessage });
      return { joined: jobId, replayed: true, error: true };
    }
    return { joined: jobId, replayed: false };
  }
}
