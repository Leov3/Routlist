import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateMaintenanceSettingsDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  includeDatabase?: boolean;

  @IsOptional()
  @IsBoolean()
  includeStorage?: boolean;

  @IsOptional()
  @IsIn(['MANUAL', 'EVERY_HOURS'])
  scheduleMode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  everyHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  retentionDays?: number;
}
