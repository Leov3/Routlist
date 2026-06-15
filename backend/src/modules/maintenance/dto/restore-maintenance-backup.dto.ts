import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class RestoreMaintenanceBackupDto {
  @ApiProperty({
    example: true,
    description:
      'Confirms the destructive restore over the current environment.',
  })
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  confirmRestore: boolean;
}
