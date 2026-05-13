import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResult, paginate } from '../../common/responses/api-response';
import { currentAndPreviousWindow } from './business-period.util';
import { BusinessPortalRepository } from './business-portal.repository';
import { BusinessesRepository } from './businesses.repository';
import { BusinessDto } from './dto/business.dto';
import {
  BusinessMetricsDto,
  BusinessMetricsQueryDto,
  MetricWithDeltaAbsDto,
  MetricWithDeltaPctDto,
} from './dto/business-metrics.dto';
import { BusinessMetricsPeriod } from './dto/business-metrics-period.enum';
import { BusinessTopQuestDto, BusinessTopQuestsQueryDto } from './dto/business-top-quest.dto';
import { CreateBusinessDto } from './dto/create-business.dto';

function deltaPct(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return Math.round(((cur - prev) / prev) * 10000) / 100;
}

function deltaAbs(cur: number, prev: number): number {
  return Math.round((cur - prev) * 100) / 100;
}

function wrapPct(value: number, prev: number): MetricWithDeltaPctDto {
  return { value, deltaPct: deltaPct(value, prev) };
}

function wrapAbs(value: number, prev: number): MetricWithDeltaAbsDto {
  return { value, deltaAbs: deltaAbs(value, prev) };
}

@Injectable()
export class BusinessesService {
  constructor(
    private readonly businesses: BusinessesRepository,
    private readonly portal: BusinessPortalRepository,
  ) {}

  async getById(id: string): Promise<BusinessDto> {
    const b = await this.businesses.findById(id);
    if (!b) throw new NotFoundException('Business not found');
    return BusinessDto.fromEntity(b);
  }

  async list(page: number, limit: number, search?: string): Promise<PaginatedResult<BusinessDto>> {
    const where: Prisma.BusinessWhereInput | undefined = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const { items, total } = await this.businesses.list({
      skip: (page - 1) * limit,
      take: limit,
      where,
    });

    return paginate(items.map(BusinessDto.fromEntity), page, limit, total);
  }

  async create(ownerId: string, dto: CreateBusinessDto): Promise<BusinessDto> {
    const existing = await this.businesses.findBySlug(dto.slug);
    if (existing) throw new ConflictException('Business slug already exists');

    const created = await this.businesses.create({
      slug: dto.slug,
      name: dto.name,
      description: dto.description,
      websiteUrl: dto.websiteUrl,
      logoUrl: dto.logoUrl,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      owner: { connect: { id: ownerId } },
    });
    return BusinessDto.fromEntity(created);
  }

  async getMine(ownerId: string): Promise<BusinessDto> {
    const b = await this.requireOwnedBusiness(ownerId);
    return BusinessDto.fromEntity(b);
  }

  async getMetrics(ownerId: string, query: BusinessMetricsQueryDto): Promise<BusinessMetricsDto> {
    const business = await this.requireOwnedBusiness(ownerId);
    const period = query.period ?? BusinessMetricsPeriod.THIRTY_D;
    const { current, previous } = currentAndPreviousWindow(period, new Date());

    const [
      visitsCur,
      visitsPrev,
      completionsCur,
      completionsPrev,
      ratingCur,
      ratingPrev,
      repeatCur,
      repeatPrev,
    ] = await Promise.all([
      this.portal.countVisits(business.id, current.start, current.endExclusive),
      this.portal.countVisits(business.id, previous.start, previous.endExclusive),
      this.portal.countQuestCompletions(business.id, current.start, current.endExclusive),
      this.portal.countQuestCompletions(business.id, previous.start, previous.endExclusive),
      this.portal.averageRatingInPeriod(business.id, current.start, current.endExclusive),
      this.portal.averageRatingInPeriod(business.id, previous.start, previous.endExclusive),
      this.portal.repeatVisitorPercent(business.id, current.start, current.endExclusive),
      this.portal.repeatVisitorPercent(business.id, previous.start, previous.endExclusive),
    ]);

    return {
      period,
      monthlyVisits: wrapPct(visitsCur, visitsPrev),
      questCompletions: wrapPct(completionsCur, completionsPrev),
      avgRating: wrapAbs(ratingCur, ratingPrev),
      repeatVisitors: wrapPct(repeatCur, repeatPrev),
    };
  }

  async getTopQuests(
    ownerId: string,
    query: BusinessTopQuestsQueryDto,
  ): Promise<BusinessTopQuestDto[]> {
    const business = await this.requireOwnedBusiness(ownerId);
    const period = query.period ?? BusinessMetricsPeriod.THIRTY_D;
    const { current } = currentAndPreviousWindow(period, new Date());
    const limit = query.limit;

    const rows = await this.portal.listTopQuests(
      business.id,
      current.start,
      current.endExclusive,
      limit,
    );

    return rows.map((r) => {
      const visits = r.visits;
      const completions = r.completions;
      const conversion = visits > 0 ? Math.round((completions / visits) * 10_000) / 10_000 : 0;
      return {
        id: r.id,
        title: r.title,
        visits,
        completions,
        conversion,
        rating: r.rating === null ? null : Math.round(Number(r.rating) * 100) / 100,
        ratingCount: r.rating_count,
      };
    });
  }

  async startOnboarding(ownerId: string): Promise<BusinessDto> {
    const business = await this.requireOwnedBusiness(ownerId);
    const updated = await this.businesses.update(business.id, {
      onboardingStartedAt: new Date(),
    });
    return BusinessDto.fromEntity(updated);
  }

  private async requireOwnedBusiness(ownerId: string) {
    const b = await this.businesses.findByOwnerId(ownerId);
    if (!b) {
      throw new ForbiddenException({
        message: 'Business portal is only available when you own a business',
        code: 'FORBIDDEN',
      });
    }
    return b;
  }
}
