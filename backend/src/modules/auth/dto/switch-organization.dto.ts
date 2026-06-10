import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SwitchOrganizationDto {
  @ApiProperty({ example: 'demo-organization-2' })
  @IsString()
  organizationId: string;
}
