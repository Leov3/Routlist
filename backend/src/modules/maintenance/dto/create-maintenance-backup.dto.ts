import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateMaintenanceBackupDto {
  @IsOptional()
  @IsBoolean()
  includeDatabase?: boolean;

  @IsOptional()
  @IsBoolean()
  includeStorage?: boolean;

  @IsOptional()
  @IsString()
  label?: string;
}
