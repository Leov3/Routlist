import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

const ORGANIZATION_STATUSES = ['ACTIVE', 'DISABLED'] as const;

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Routlis Demo Organization' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ enum: ORGANIZATION_STATUSES, example: 'ACTIVE' })
  @IsOptional()
  @IsIn(ORGANIZATION_STATUSES)
  status?: (typeof ORGANIZATION_STATUSES)[number];

  @ApiPropertyOptional({ example: 'routlis-demo-organization' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @ApiPropertyOptional({ example: 5, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;
}
