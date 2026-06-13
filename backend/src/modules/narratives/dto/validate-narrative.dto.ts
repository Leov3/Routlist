import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class ValidateNarrativeDto {
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      nodes: [],
      edges: [],
    },
  })
  @IsOptional()
  @IsObject()
  graphJson?: Record<string, unknown>;
}
