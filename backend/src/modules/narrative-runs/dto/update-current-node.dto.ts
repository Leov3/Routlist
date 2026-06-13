import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateCurrentNodeDto {
  @ApiProperty({ example: 'node-audio-1' })
  @IsString()
  currentNodeId: string;
}
