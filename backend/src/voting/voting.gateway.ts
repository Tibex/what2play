import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';
import { VotingService } from './voting.service';
import { Event } from '../entities/event.entity';
import { EventAttendee } from '../entities/event-attendee.entity';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/voting' })
export class VotingGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly votingService: VotingService,
    private readonly configService: ConfigService,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(EventAttendee)
    private readonly attendeesRepo: Repository<EventAttendee>,
  ) {}

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

  private async assertUserCanJoinEvent(
    eventId: string,
    userId: string,
  ): Promise<void> {
    const event = await this.eventsRepo.findOne({
      where: { id: eventId },
      select: ['id', 'hostId', 'type'],
    });
    if (!event) {
      throw new WsException('Event not found');
    }
    if (event.hostId === userId) return;
    if (event.type === 'open') return;
    const attendee = await this.attendeesRepo.findOne({
      where: { eventId, userId },
      select: ['id', 'rsvpStatus'],
    });
    if (!attendee || attendee.rsvpStatus === 'not_going') {
      throw new WsException('Forbidden');
    }
  }

  async emitVotingState(eventId: string): Promise<void> {
    const [results, votingStatus, eventSnapshot] = await Promise.all([
      this.votingService.getResults(eventId),
      this.votingService.getVotingStatus(eventId),
      this.votingService.getEventSnapshot(eventId),
    ]);
    this.server.to(`event:${eventId}`).emit('votingState', {
      eventId,
      results,
      votingStatus,
      eventStatus: eventSnapshot.status,
      selectedGameId: eventSnapshot.selectedGameId,
    });
  }

  @SubscribeMessage('joinEvent')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() eventId: string,
  ) {
    const userId = this.extractUserId(client);
    await this.assertUserCanJoinEvent(eventId, userId);
    client.join(`event:${eventId}`);
    await this.emitVotingState(eventId);
    return { joined: eventId };
  }

  @SubscribeMessage('submitVote')
  async handleVote(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      eventId: string;
      userId: string;
      rankings: { gameId: string; rank: number }[];
    },
  ) {
    const userId = this.extractUserId(client);
    if (userId !== data.userId) {
      throw new WsException('Forbidden');
    }
    await this.votingService.submitVotes(
      data.eventId,
      data.userId,
      data.rankings,
    );
    await this.emitVotingState(data.eventId);
    const results = await this.votingService.getResults(data.eventId);
    return { results };
  }

  @SubscribeMessage('leaveEvent')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() eventId: string,
  ) {
    client.leave(`event:${eventId}`);
  }
}
