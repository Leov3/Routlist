export const ROLE_NAMES = ['OWNER', 'ADMIN', 'SUPERVISOR', 'OPERATOR'] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const GLOBAL_ROLE_NAME: RoleName = 'OWNER';
export const ASSIGNABLE_ROLE_NAMES = ['ADMIN', 'SUPERVISOR', 'OPERATOR'] as const;
export type AssignableRoleName = (typeof ASSIGNABLE_ROLE_NAMES)[number];

export const PERMISSIONS = [
  'organization:read',
  'organization:update',
  'user:create',
  'user:read',
  'user:update',
  'user:disable',
  'role:read',
  'permission:read',
  'audio:create',
  'audio:read',
  'audio:update',
  'audio:delete',
  'category:create',
  'category:read',
  'category:update',
  'category:delete',
  'button:create',
  'button:read',
  'button:update',
  'button:delete',
  'board:use',
  'history:read',
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  OWNER: [...PERMISSIONS],
  ADMIN: [
    'organization:read',
    'user:create',
    'user:read',
    'user:update',
    'user:disable',
    'role:read',
    'permission:read',
    'audio:create',
    'audio:read',
    'audio:update',
    'audio:delete',
    'category:create',
    'category:read',
    'category:update',
    'category:delete',
    'button:create',
    'button:read',
    'button:update',
    'button:delete',
    'board:use',
    'history:read',
  ],
  SUPERVISOR: [
    'organization:read',
    'user:read',
    'role:read',
    'permission:read',
    'audio:read',
    'category:read',
    'button:read',
    'board:use',
    'history:read',
  ],
  OPERATOR: ['audio:read', 'category:read', 'button:read', 'board:use'],
};
