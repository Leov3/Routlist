import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateAudioCategoryDto {
  @ApiProperty({ example: 'Saludos' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Audios de apertura de conversacion' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
