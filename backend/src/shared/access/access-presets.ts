import { PERMISSIONS, type PermissionKey } from '../constants/rbac.constants';

export type AccessState = {
  roleDefaults: Record<string, Record<string, boolean>>;
  organizationOverrides: Record<string, Record<string, boolean>>;
};

export type AccessModuleDefinition = {
  key: string;
  label: string;
  permissions: PermissionKey[];
  category: 'access' | 'platform' | 'content' | 'system';
};

export const ACCESS_MODULES: AccessModuleDefinition[] = [
  {
    key: 'admin',
    label: 'Estadísticas',
    permissions: [],
    category: 'platform',
  },
  {
    key: 'admin.organizations',
    label: 'Organizaciones',
    permissions: ['organization:read', 'organization:update'],
    category: 'access',
  },
  {
    key: 'admin.users',
    label: 'Usuarios',
    permissions: ['user:create', 'user:read', 'user:update', 'user:disable', 'user:delete', 'role:read', 'permission:read'],
    category: 'access',
  },
  {
    key: 'admin.audios',
    label: 'Audios',
    permissions: ['audio:create', 'audio:generate', 'audio:read', 'audio:update', 'audio:delete'],
    category: 'content',
  },
  {
    key: 'admin.categories',
    label: 'Categorías',
    permissions: ['category:create', 'category:read', 'category:update', 'category:delete'],
    category: 'content',
  },
  {
    key: 'admin.buttons',
    label: 'Botones',
    permissions: ['button:create', 'button:read', 'button:update', 'button:delete'],
    category: 'content',
  },
  {
    key: 'admin.narratives',
    label: 'Narrativas',
    permissions: ['narratives:view', 'narratives:create', 'narratives:update', 'narratives:publish', 'narratives:archive', 'narratives:run'],
    category: 'content',
  },
  {
    key: 'admin.integrations',
    label: 'Integraciones',
    permissions: ['integration:manage'],
    category: 'platform',
  },
  {
    key: 'admin.storage',
    label: 'Almacenamiento',
    permissions: [],
    category: 'system',
  },
  {
    key: 'admin.maintenance',
    label: 'Migraciones y backup',
    permissions: [],
    category: 'system',
  },
  {
    key: 'admin.history',
    label: 'Historial',
    permissions: ['history:read'],
    category: 'system',
  },
  {
    key: 'board.use',
    label: 'Botonera',
    permissions: ['board:use'],
    category: 'platform',
  },
  {
    key: 'narratives.run',
    label: 'Narrativas en ejecución',
    permissions: ['narratives:run'],
    category: 'content',
  },
  {
    key: 'audio.generate',
    label: 'Audio IA',
    permissions: ['audio:generate'],
    category: 'platform',
  },
];

const allModuleKeys = ACCESS_MODULES.map((module) => module.key);

function buildPreset(entries: Array<[string, boolean]>): Record<string, boolean> {
  const preset: Record<string, boolean> = Object.fromEntries(allModuleKeys.map((key) => [key, false]));
  for (const [key, allowed] of entries) {
    preset[key] = allowed;
  }
  return preset;
}

export const DEFAULT_ACCESS_STATE: AccessState = {
  roleDefaults: {
    OWNER: buildPreset(allModuleKeys.map((key) => [key, true])),
    ADMIN: buildPreset([
      ['admin', true],
      ['admin.organizations', true],
      ['admin.users', true],
      ['admin.audios', true],
      ['admin.categories', true],
      ['admin.buttons', true],
      ['admin.narratives', true],
      ['admin.history', true],
      ['admin.integrations', true],
      ['board.use', true],
      ['narratives.run', true],
      ['audio.generate', true],
    ]),
    SUPERVISOR: buildPreset([
      ['admin', true],
      ['admin.audios', true],
      ['admin.categories', true],
      ['admin.buttons', true],
      ['admin.narratives', true],
      ['admin.history', true],
      ['board.use', true],
      ['narratives.run', true],
      ['audio.generate', true],
    ]),
    OPERATOR: buildPreset([
      ['admin.audios', true],
      ['admin.categories', true],
      ['admin.buttons', true],
      ['board.use', true],
      ['narratives.run', true],
      ['audio.generate', true],
    ]),
  },
  organizationOverrides: {},
};

export function getPermissionsForModules(moduleFlags: Record<string, boolean>) {
  const permissions = new Set<PermissionKey>();
  for (const module of ACCESS_MODULES) {
    if (module.key === 'admin') continue;
    if (!moduleFlags[module.key]) continue;
    for (const permission of module.permissions) {
      permissions.add(permission);
    }
  }
  return [...permissions];
}

export function mergeModuleFlags(
  base: Record<string, boolean>,
  override?: Record<string, boolean> | null,
) {
  const merged = { ...base };
  if (!override) return merged;
  for (const [key, value] of Object.entries(override)) {
    if (key in merged) {
      merged[key] = value;
    }
  }
  return merged;
}
