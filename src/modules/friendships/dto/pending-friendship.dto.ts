import { ApiProperty } from '@nestjs/swagger';
import { ParticipantSummaryDto } from '../../../common/dto/participant-summary.dto';

export class PendingFriendshipDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: () => ParticipantSummaryDto }) requester!: ParticipantSummaryDto;
  @ApiProperty() createdAt!: Date;
}
