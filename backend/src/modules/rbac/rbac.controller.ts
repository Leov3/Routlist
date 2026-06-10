import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RbacService } from './rbac.service';

@ApiTags('rbac')
@ApiCookieAuth('cookie')
@Controller('rbac')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @Permissions('role:read')
  roles() {
    return this.rbacService.roles();
  }

  @Get('permissions')
  @Permissions('permission:read')
  permissions() {
    return this.rbacService.permissions();
  }
}
