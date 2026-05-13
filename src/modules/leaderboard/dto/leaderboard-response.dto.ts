import { ApiProperty } from '@nestjs/swagger';
import { ParticipantSummaryDto } from '../../../common/dto/participant-summary.dto';

export class LeaderboardEntryDto {
  @ApiProperty({ description: '1-based rank' })
  rank!: number;

  @ApiProperty({ type: ParticipantSummaryDto })
  user!: ParticipantSummaryDto;

  @ApiProperty({
    description:
      'ALL_TIME: total user XP. MONTH/WEEK: sum of xpAwarded on completions in the period.',
  })
  xp!: number;

  @ApiProperty({
    description: 'ALL_TIME: User.questsDone. MONTH/WEEK: count of completed quests in the period.',
  })
  questsDone!: number;

  @ApiProperty({ description: 'True when the row matches the optional Bearer viewer' })
  isMe!: boolean;
}

export class LeaderboardResponseDto {
  @ApiProperty({ type: [LeaderboardEntryDto] })
  entries!: LeaderboardEntryDto[];

  @ApiProperty({
    type: LeaderboardEntryDto,
    nullable: true,
    description:
      'Set only with a valid Bearer token (same row as in `entries` when in top N, otherwise the viewer rank).',
  })
  myEntry!: LeaderboardEntryDto | null;
}
