import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';

export class SendTemplatePreviewDto {
  @ApiProperty({ example: 'owner@routlis.com' })
  @IsEmail()
  to!: string;

  @ApiPropertyOptional({ example: 'Plantilla de prueba Routlis' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ example: '<h1>Hola</h1>' })
  @IsString()
  htmlBody!: string;

  @ApiPropertyOptional({ example: 'Hola' })
  @IsOptional()
  @IsString()
  textBody?: string;

  @ApiPropertyOptional({ example: 'template-preview' })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @ApiPropertyOptional({ example: { user_name: 'María López' } })
  @IsOptional()
  @IsObject()
  context?: Record<string, string | number | boolean | null>;
}
