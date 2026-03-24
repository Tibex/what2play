import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { VotingService } from './voting.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/voting' })
export class VotingGateway {
  @WebSocketServer()
  server: Server;

  constructor(private votingService: VotingService) {}

  @SubscribeMessage('joinEvent')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() eventId: string) {
    client.join(`event:${eventId}`);
    return { joined: eventId };
  }

  @SubscribeMessage('submitVote')
  async handleVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string; userId: string; rankings: { gameId: string; rank: number }[] },
  ) {
    await this.votingService.submitVotes(data.eventId, data.userId, data.rankings);
    const results = await this.votingService.getResults(data.eventId);
    this.server.to(`event:${data.eventId}`).emit('votingUpdate', results);
    return results;
  }

  @SubscribeMessage('leaveEvent')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() eventId: string) {
    client.leave(`event:${eventId}`);
  }
}
