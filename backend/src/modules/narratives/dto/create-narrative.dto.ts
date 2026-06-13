import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateNarrativeDto {
  @ApiProperty({ example: 'Narrativa de apertura' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiPropertyOptional({ example: 'Guion operativo para aperturas' })
  @IsOptional()
  @IsString()
  description?: string;
}
