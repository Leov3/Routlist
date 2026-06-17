import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateMailEventDto {
  @ApiPropertyOptional({ example: 'WELCOME' })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
