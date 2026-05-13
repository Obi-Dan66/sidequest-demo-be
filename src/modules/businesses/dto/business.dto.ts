import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Business, BusinessStatus } from '@prisma/client';

export class BusinessDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiPropertyOptional() websiteUrl?: string | null;
  @ApiPropertyOptional() logoUrl?: string | null;
  @ApiProperty({ enum: BusinessStatus }) status!: BusinessStatus;
  @ApiPropertyOptional() address?: string | null;
  @ApiPropertyOptional() latitude?: number | null;
  @ApiPropertyOptional() longitude?: number | null;
  @ApiPropertyOptional() ownerId?: string | null;
  @ApiPropertyOptional({ description: 'Set when the owner starts the partner onboarding flow' })
  onboardingStartedAt?: Date | null;

  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  static fromEntity(b: Business): BusinessDto {
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      websiteUrl: b.websiteUrl,
      logoUrl: b.logoUrl,
      status: b.status,
      address: b.address,
      latitude: b.latitude,
      longitude: b.longitude,
      ownerId: b.ownerId,
      onboardingStartedAt: b.onboardingStartedAt,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }
}
