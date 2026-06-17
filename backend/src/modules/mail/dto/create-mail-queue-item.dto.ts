import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateMailQueueItemDto {
  @ApiProperty({ example: 'owner@routlis.com' })
  @IsEmail()
  to!: string;

  @ApiProperty({ example: 'Bienvenido a Routlis' })
  @IsString()
  subject!: string;

  @ApiPropertyOptional({ example: 'WELCOME' })
  @IsOptional()
  @IsString()
  eventKey?: string;

  @ApiPropertyOptional({ example: 'WELCOME' })
  @IsOptional()
  @IsString()
  templateKey?: string;
}
