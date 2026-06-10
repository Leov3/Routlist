import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const ORGANIZATION_STATUSES = ['ACTIVE', 'DISABLED'] as const;

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ example: 'Routlis Demo Organization' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ enum: ORGANIZATION_STATUSES, example: 'ACTIVE' })
  @IsOptional()
  @IsIn(ORGANIZATION_STATUSES)
  status?: (typeof ORGANIZATION_STATUSES)[number];
}
