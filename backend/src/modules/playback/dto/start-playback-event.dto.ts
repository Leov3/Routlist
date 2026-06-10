import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const PLAYBACK_MODES = ['LOCAL_BROWSER'] as const;

export class StartPlaybackEventDto {
  @ApiProperty({ example: 'audio-button-uuid' })
  @IsString()
  audioButtonId: string;

  @ApiPropertyOptional({ enum: PLAYBACK_MODES, example: 'LOCAL_BROWSER' })
  @IsOptional()
  @IsIn(PLAYBACK_MODES)
  playbackMode?: 'LOCAL_BROWSER';

  @ApiPropertyOptional({ example: 'NONE' })
  @IsOptional()
  @IsString()
  contextType?: string;

  @ApiPropertyOptional({ example: 'external-session-id' })
  @IsOptional()
  @IsString()
  contextId?: string;
}
