import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString } from 'class-validator';

const BULK_AUDIO_ACTIONS = ['ACTIVATE', 'DEACTIVATE', 'DELETE', 'IMPORT'] as const;

export class BulkAudioAssetsDto {
  @ApiProperty({
    example: ['audio-asset-uuid-1', 'audio-asset-uuid-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids?: string[];

  @ApiProperty({ enum: BULK_AUDIO_ACTIONS, example: 'DEACTIVATE' })
  @IsIn(BULK_AUDIO_ACTIONS)
  action: (typeof BULK_AUDIO_ACTIONS)[number];
}
