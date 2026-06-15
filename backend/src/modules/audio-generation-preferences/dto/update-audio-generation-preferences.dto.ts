import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateAudioGenerationPreferencesDto {
  @ApiPropertyOptional({ example: 'Hola, gracias por llamar...' })
  @IsOptional()
  @IsString()
  composerText?: string;

  @ApiPropertyOptional({ example: 'v4_voice_id' })
  @IsOptional()
  @IsString()
  composerVoiceId?: string;

  @ApiPropertyOptional({ example: 'eleven_flash_v2_5' })
  @IsOptional()
  @IsString()
  composerModelId?: string;

  @ApiPropertyOptional({ example: 'mp3_44100_128' })
  @IsOptional()
  @IsString()
  composerOutputFormat?: string;

  @ApiPropertyOptional({ example: 0.5, minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  composerStability?: number;

  @ApiPropertyOptional({ example: 0.75, minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  composerSimilarityBoost?: number;

  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  composerStyle?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0.7, maximum: 1.2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.7)
  @Max(1.2)
  composerSpeed?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  composerSpeakerBoost?: boolean;
}
