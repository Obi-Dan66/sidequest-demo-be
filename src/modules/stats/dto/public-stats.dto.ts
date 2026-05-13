import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestDto } from '../../quests/dto/quest.dto';

export class PublicStatsCityDto {
  @ApiProperty({ example: 'prague' })
  slug!: string;

  @ApiProperty({ example: 'Prague' })
  name!: string;

  @ApiProperty({ example: 120 })
  explorers!: number;
}

export class PublicStatsDto {
  @ApiProperty()
  totalExplorers!: number;

  @ApiProperty()
  totalQuests!: number;

  @ApiProperty({ description: 'Completed quest rows (QuestCompletion status COMPLETED)' })
  totalQuestCompletions!: number;

  @ApiProperty({
    description:
      'Sum of active users distanceWalkedM (meters walked on platform), expressed in kilometres.',
  })
  totalDistanceKm!: number;

  @ApiProperty({ type: [PublicStatsCityDto] })
  cities!: PublicStatsCityDto[];

  @ApiPropertyOptional({ type: () => QuestDto, nullable: true })
  featuredQuest!: QuestDto | null;
}
