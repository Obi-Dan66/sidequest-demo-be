import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResult, paginate } from '../../common/responses/api-response';
import { BusinessesRepository } from './businesses.repository';
import { BusinessDto } from './dto/business.dto';
import { CreateBusinessDto } from './dto/create-business.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly businesses: BusinessesRepository) {}

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
}
