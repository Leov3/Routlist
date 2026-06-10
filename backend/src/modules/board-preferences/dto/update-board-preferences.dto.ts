import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

export const BOARD_VIEW_MODES = ['simple', 'dual'] as const;
export const BOARD_DENSITIES = ['compact', 'medium', 'large'] as const;

export class UpdateBoardPreferencesDto {
  @ApiPropertyOptional({ enum: BOARD_VIEW_MODES, example: 'dual' })
  @IsOptional()
  @IsIn(BOARD_VIEW_MODES)
  viewMode?: (typeof BOARD_VIEW_MODES)[number];

  @ApiPropertyOptional({ enum: BOARD_DENSITIES, example: 'medium' })
  @IsOptional()
  @IsIn(BOARD_DENSITIES)
  density?: (typeof BOARD_DENSITIES)[number];

  @ApiPropertyOptional({ example: 0.85, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  volume?: number;
}
