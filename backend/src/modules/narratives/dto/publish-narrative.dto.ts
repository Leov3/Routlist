import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';

export class PublishNarrativeDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
