import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

export const NARRATIVE_DISTANCE_PRESETS = ['compact', 'tight', 'normal', 'wide', 'max'] as const;
export const NARRATIVE_VIEW_MODES = ['simple', 'dual'] as const;

export class UpdateNarrativePreferencesDto {
  @ApiPropertyOptional({ enum: NARRATIVE_DISTANCE_PRESETS, example: 'max' })
  @IsOptional()
  @IsIn(NARRATIVE_DISTANCE_PRESETS)
  playerDistance?: (typeof NARRATIVE_DISTANCE_PRESETS)[number];

  @ApiPropertyOptional({ enum: NARRATIVE_VIEW_MODES, example: 'dual' })
  @IsOptional()
  @IsIn(NARRATIVE_VIEW_MODES)
  playerViewMode?: (typeof NARRATIVE_VIEW_MODES)[number];

  @ApiPropertyOptional({ example: 0, minimum: -100000, maximum: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100000)
  @Max(100000)
  playerViewportX?: number;

  @ApiPropertyOptional({ example: 0, minimum: -100000, maximum: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100000)
  @Max(100000)
  playerViewportY?: number;

  @ApiPropertyOptional({ example: 0.8, minimum: 0.2, maximum: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.2)
  @Max(2)
  playerViewportZoom?: number;
}
