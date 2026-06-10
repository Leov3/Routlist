import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateAudioButtonDto {
  @ApiPropertyOptional({ example: 'category-uuid' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'audio-asset-uuid' })
  @IsOptional()
  @IsString()
  audioAssetId?: string;

  @ApiPropertyOptional({ example: 'Saludo inicial' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ example: 'Primer audio de apertura' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#047857' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  shortcutKey?: string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
