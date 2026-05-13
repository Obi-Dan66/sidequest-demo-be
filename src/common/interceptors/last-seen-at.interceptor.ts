import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Debounced presence ping: updates `User.lastSeenAt` at most once per 60s per request,
 * only for authenticated HTTP routes (`req.user` set by JWT).
 */
@Injectable()
export class LastSeenAtInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const userId = req.user?.id;
    if (userId) {
      void this.touchLastSeen(userId);
    }
    return next.handle();
  }

  private async touchLastSeen(userId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "User"
      SET "lastSeenAt" = NOW()
      WHERE "id" = ${userId}
        AND ("lastSeenAt" IS NULL OR "lastSeenAt" < NOW() - INTERVAL '60 seconds')
    `;
  }
}
