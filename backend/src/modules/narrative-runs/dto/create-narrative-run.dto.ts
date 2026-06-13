import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateNarrativeRunDto {
  @ApiPropertyOptional({
    example: 'node-start-1',
    description: 'Optional node id to start from when valid',
  })
  @IsOptional()
  @IsString()
  startingNodeId?: string;
}
