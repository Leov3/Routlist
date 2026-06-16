import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMailSettingsDto {
  @ApiProperty({ example: 'smtp' })
  @IsString()
  provider!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ example: 'Routlis' })
  @IsString()
  fromName!: string;

  @ApiProperty({ example: 'notificaciones@routlis.com' })
  @IsEmail()
  fromEmail!: string;

  @ApiPropertyOptional({ example: 'soporte@routlis.com' })
  @IsOptional()
  @IsEmail()
  replyTo?: string;

  @ApiPropertyOptional({ example: 'smtp.gmail.com' })
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiPropertyOptional({ example: 465 })
  @IsOptional()
  @IsInt()
  @Min(1)
  smtpPort?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @ApiPropertyOptional({ example: 'notificaciones@routlis.com' })
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiPropertyOptional({ example: 'app-password-or-secret' })
  @IsOptional()
  @IsString()
  smtpPassword?: string;
}
