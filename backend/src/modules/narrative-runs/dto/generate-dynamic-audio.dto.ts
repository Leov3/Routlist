import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GenerateDynamicAudioDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsString()
  defaultVoiceId?: string;

  @IsOptional()
  @IsString()
  defaultModelId?: string;

  @IsOptional()
  @IsString()
  defaultOutputFormat?: string;

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
}
