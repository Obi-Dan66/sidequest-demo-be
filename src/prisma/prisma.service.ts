import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('database.url') || process.env.DATABASE_URL,
        },
      },
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }

  /**
   * Convenience helper to run a callback inside an interactive transaction
   * with sensible defaults. Use when you need cross-repository atomicity.
   */
  async runInTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      timeoutMs?: number;
      maxWaitMs?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<T> {
    return this.$transaction(fn, {
      timeout: options?.timeoutMs ?? 10_000,
      maxWait: options?.maxWaitMs ?? 5_000,
      isolationLevel: options?.isolationLevel,
    });
  }
}
