import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface SocketAuthPayload {
  sub: string;
}

/**
 * Realtime notification fan-out.
 *
 * MVP wiring:
 *   - Socket.IO over the same HTTP server as the REST API.
 *   - Clients connect to `/realtime`, providing the JWT access token via `auth.token`.
 *   - On successful auth, the socket joins a `user:<id>` room.
 *   - NotificationsService.pushToUser() emits to that room.
 *
 * Production-ready evolution (documented in SKILL.md):
 *   - Add a Redis adapter so multiple API instances can fan-out to the same user.
 *   - Add per-event handlers for presence / live quest co-play.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit(): void {
    this.logger.log('Realtime gateway initialized (namespace: /realtime)');
  }

  async handleConnection(@ConnectedSocket() client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new UnauthorizedException('Missing token');

      const payload: unknown = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('auth.accessSecret') || 'replace-me-access',
      });
      const auth = this.toSocketAuthPayload(payload);
      if (!auth) throw new UnauthorizedException('Invalid token');

      client.data.userId = auth.sub;
      await client.join(this.roomForUser(auth.sub));
      this.logger.debug(`socket ${client.id} joined room user:${auth.sub}`);
    } catch (err) {
      this.logger.warn(
        `socket ${client.id} auth failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket): void {
    this.logger.debug(`socket ${client.id} disconnected`);
  }

  @SubscribeMessage('ping')
  handlePing(): { pong: true; t: number } {
    return { pong: true, t: Date.now() };
  }

  pushToUser(userId: string, payload: unknown): void {
    if (!this.server) return;
    this.server.to(this.roomForUser(userId)).emit('notification', payload);
  }

  private roomForUser(userId: string): string {
    return `user:${userId}`;
  }

  private extractToken(client: Socket): string | undefined {
    const fromAuth = Reflect.get(client.handshake.auth, 'token');
    if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
      return header.slice(7);
    }
    return undefined;
  }

  private toSocketAuthPayload(value: unknown): SocketAuthPayload | null {
    if (typeof value !== 'object' || value === null) return null;
    const sub = Reflect.get(value, 'sub');
    return typeof sub === 'string' ? { sub } : null;
  }
}
