import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateNarrativeDto {
  @ApiPropertyOptional({ example: 'Narrativa de apertura' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional({ example: 'Guion operativo para aperturas' })
  @IsOptional()
  @IsString()
  description?: string;
}
