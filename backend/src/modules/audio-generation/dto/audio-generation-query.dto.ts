import { IsIn, IsOptional, IsString } from 'class-validator';

const LIFECYCLE_STATUSES = ['all', 'TEMPORARY', 'PERSISTED'] as const;

export class AudioGenerationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  @IsString()
  modelId?: string;

  @IsOptional()
  @IsIn(LIFECYCLE_STATUSES)
  lifecycleStatus?: (typeof LIFECYCLE_STATUSES)[number];
}

