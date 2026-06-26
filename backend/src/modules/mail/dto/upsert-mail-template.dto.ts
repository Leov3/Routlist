import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpsertMailTemplateDto {
  @ApiProperty({ example: 'WELCOME' })
  @IsString()
  key!: string;

  @ApiProperty({ example: 'Bienvenida' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Plantilla para usuarios nuevos' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Bienvenido a Routlis' })
  @IsString()
  subject!: string;

  @ApiProperty({ example: '<h1>Hola</h1>' })
  @IsString()
  htmlBody!: string;

  @ApiPropertyOptional({ example: 'Hola' })
  @IsOptional()
  @IsString()
  textBody?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
