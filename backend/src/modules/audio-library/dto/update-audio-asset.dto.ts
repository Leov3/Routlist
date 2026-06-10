import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateAudioAssetDto {
  @ApiPropertyOptional({ example: 'saludo-inicial.wav' })
  @IsOptional()
  @IsString()
  originalName?: string;

  @ApiPropertyOptional({ example: 'Hola, gracias por comunicarte...' })
  @IsOptional()
  @IsString()
  transcript?: string;

  @ApiPropertyOptional({ example: 12, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
