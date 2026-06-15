import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class GenerateAudioGenerationDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  @IsString()
  voiceName?: string;

  @IsOptional()
  @IsString()
  modelId?: string;

  @IsOptional()
  @IsString()
  outputFormat?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  stability?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  similarityBoost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  style?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.7)
  @Max(1.2)
  speed?: number;

  @IsOptional()
  @IsBoolean()
  speakerBoost?: boolean;

  @IsOptional()
  @IsBoolean()
  createButton?: boolean;

  @IsOptional()
  @IsString()
  buttonLabel?: string;

  @IsOptional()
  @IsString()
  buttonCategoryId?: string;

  @IsOptional()
  @IsString()
  buttonDescription?: string;

  @IsOptional()
  @IsString()
  buttonColor?: string;

  @IsOptional()
  @IsString()
  buttonShortcutKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  buttonSortOrder?: number;
}
