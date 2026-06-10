import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { ASSIGNABLE_ROLE_NAMES } from '../../../shared/constants/rbac.constants';
import type { AssignableRoleName } from '../../../shared/constants/rbac.constants';

export class CreateUserDto {
  @ApiProperty({ example: 'operador@routlis.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Operador Routlis' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'Operator123*', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: ASSIGNABLE_ROLE_NAMES, example: 'OPERATOR' })
  @IsIn(ASSIGNABLE_ROLE_NAMES)
  role: AssignableRoleName;
}
