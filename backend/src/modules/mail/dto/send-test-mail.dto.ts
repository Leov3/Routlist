import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class SendTestMailDto {
  @ApiProperty({ example: 'owner@routlis.com' })
  @IsEmail()
  to!: string;

  @ApiProperty({ example: 'Prueba de correo Routlis' })
  @IsOptional()
  @IsString()
  subject?: string;
}
