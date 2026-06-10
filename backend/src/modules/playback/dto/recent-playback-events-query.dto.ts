import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const RECENT_SCOPES = ['organization', 'user'] as const;

export class RecentPlaybackEventsQueryDto {
  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ enum: RECENT_SCOPES, example: 'organization' })
  @IsOptional()
  @IsIn(RECENT_SCOPES)
  scope?: (typeof RECENT_SCOPES)[number];
}
