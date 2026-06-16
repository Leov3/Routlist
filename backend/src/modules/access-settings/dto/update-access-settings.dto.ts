import { IsObject } from 'class-validator';

export class UpdateAccessSettingsDto {
  @IsObject()
  roleDefaults!: Record<string, Record<string, boolean>>;

  @IsObject()
  organizationOverrides!: Record<string, Record<string, boolean>>;

  @IsObject()
  organizationRoleDefaults!: Record<
    string,
    Record<string, Record<string, boolean>>
  >;
}
