import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateAudioButtonDto {
  @ApiProperty({ example: 'category-uuid' })
  @IsString()
  categoryId: string;

  @ApiProperty({ example: 'audio-asset-uuid' })
  @IsString()
  audioAssetId: string;

  @ApiProperty({ example: 'Saludo inicial' })
  @IsString()
  label: string;

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
}
