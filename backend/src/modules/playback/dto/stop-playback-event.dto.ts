import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class StopPlaybackEventDto {
  @ApiPropertyOptional({ example: 8, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationPlayedSeconds?: number;
}
