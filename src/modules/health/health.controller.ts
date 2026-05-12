import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

interface LivenessResponse {
  success: true;
  message: string;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
}

interface ReadinessResponse {
  success: true;
  message: string;
  db: 'up' | 'down';
  timestamp: string;
}

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Liveness probe. No external dependencies - safe for k8s liveness checks
   * and the frontend's "can I talk to the API?" smoke test.
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'API liveness probe' })
  check(): LivenessResponse {
    return {
      success: true,
      message: 'SideQuest API running',
      service: this.config.get<string>('app.name') ?? 'SideQuest',
      version: this.config.get<string>('app.apiDefaultVersion') ?? '1',
      environment: this.config.get<string>('app.nodeEnv') ?? 'development',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe. Touches the database. Use this from monitoring or
   * before declaring the deployment healthy.
   */
  @Public()
  @Get('db')
  @ApiOperation({ summary: 'Database connectivity probe' })
  async db(): Promise<ReadinessResponse> {
    let db: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    return {
      success: true,
      message: db === 'up' ? 'Database reachable' : 'Database unreachable',
      db,
      timestamp: new Date().toISOString(),
    };
  }
}
