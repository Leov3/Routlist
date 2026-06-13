import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NarrativeRunEventType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRunEventDto {
  @ApiProperty({ enum: NarrativeRunEventType })
  @IsEnum(NarrativeRunEventType)
  eventType: NarrativeRunEventType;

  @ApiProperty({ example: 'node-1' })
  @IsString()
  nodeId: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { note: 'Operador completo el paso' },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
