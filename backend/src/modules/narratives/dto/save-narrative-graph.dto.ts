import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class SaveNarrativeGraphDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      nodes: [],
      edges: [],
    },
  })
  @IsObject()
  graphJson: Record<string, unknown>;
}
