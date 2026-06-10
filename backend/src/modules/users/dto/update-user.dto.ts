import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ASSIGNABLE_ROLE_NAMES } from '../../../shared/constants/rbac.constants';
import type { AssignableRoleName } from '../../../shared/constants/rbac.constants';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'operador@routlis.local' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Operador Routlis' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'Operator123*', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLE_NAMES, example: 'OPERATOR' })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLE_NAMES)
  role?: AssignableRoleName;
}
