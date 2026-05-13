import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export enum UserListSort {
  XP_DESC = 'XP_DESC',
  XP_ASC = 'XP_ASC',
  LEVEL_DESC = 'LEVEL_DESC',
  CREATED_DESC = 'CREATED_DESC',
  USERNAME_ASC = 'USERNAME_ASC',
}

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: UserListSort,
    enumName: 'UserListSort',
    default: UserListSort.CREATED_DESC,
    description:
      'Stable ordering for discovery; ties break by user id ascending. Defaults to CREATED_DESC.',
  })
  @IsOptional()
  @IsEnum(UserListSort)
  sort?: UserListSort;
}
