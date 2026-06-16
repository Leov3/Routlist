import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_ACCESS_STATE,
  getPermissionsForModules,
  mergeModuleFlags,
} from '../../shared/access/access-presets';
import { GLOBAL_ROLE_NAME, PERMISSIONS } from '../../shared/constants/rbac.constants';
import { UpdateAccessSettingsDto } from './dto/update-access-settings.dto';

@Injectable()
export class AccessSettingsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  async get() {
    await this.ensureDefaults();
    const settings = await this.prisma.accessSettings.findUnique({ where: { id: 'singleton' } });
    return settings ?? this.createDefault();
  }

  async update(dto: UpdateAccessSettingsDto) {
    await this.ensureDefaults();
    return this.prisma.accessSettings.upsert({
      where: { id: 'singleton' },
      update: {
        roleDefaults: dto.roleDefaults,
        organizationOverrides: dto.organizationOverrides,
        organizationRoleDefaults: dto.organizationRoleDefaults,
      },
      create: {
        id: 'singleton',
        roleDefaults: dto.roleDefaults,
        organizationOverrides: dto.organizationOverrides,
        organizationRoleDefaults: dto.organizationRoleDefaults,
      },
    });
  }

  async resolveEffectivePermissions(
    role: string,
    organizationId: string,
  ): Promise<string[]> {
    if (role === GLOBAL_ROLE_NAME) {
      return [...PERMISSIONS];
    }

    const settings = await this.get();
    const roleDefaults = (settings.roleDefaults ?? DEFAULT_ACCESS_STATE.roleDefaults) as Record<string, Record<string, boolean>>;
    const organizationOverrides = (settings.organizationOverrides ?? {}) as Record<string, Record<string, boolean>>;
    const organizationRoleDefaults = (settings.organizationRoleDefaults ?? {}) as Record<
      string,
      Record<string, Record<string, boolean>>
    >;
    const baseModules = roleDefaults[role] ?? DEFAULT_ACCESS_STATE.roleDefaults[role] ?? {};
    const overrideModules = organizationOverrides[organizationId] ?? {};
    const organizationRoleModules = organizationRoleDefaults[organizationId]?.[role] ?? {};
    const mergedModules = mergeModuleFlags(
      mergeModuleFlags(baseModules, organizationRoleModules),
      overrideModules,
    );
    return getPermissionsForModules(mergedModules);
  }

  private async ensureDefaults() {
    const exists = await this.prisma.accessSettings.findUnique({ where: { id: 'singleton' } });
    if (!exists) {
      await this.createDefault();
    }
  }

  private createDefault() {
    return this.prisma.accessSettings.create({
      data: {
        id: 'singleton',
        roleDefaults: DEFAULT_ACCESS_STATE.roleDefaults,
        organizationOverrides: DEFAULT_ACCESS_STATE.organizationOverrides,
        organizationRoleDefaults: {},
      },
    });
  }
}
