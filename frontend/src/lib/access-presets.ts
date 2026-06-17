export type AccessMode = "role" | "organization";

export type AccessPreset = {
  id: string;
  label: string;
  description: string;
  modules: Record<string, boolean>;
};

export type AccessState = {
  roleDefaults: Record<string, Record<string, boolean>>;
  organizationOverrides: Record<string, Record<string, boolean>>;
  organizationRoleDefaults: Record<string, Record<string, Record<string, boolean>>>;
};

export const ACCESS_MODULES = [
  // ── Operación ───────────────────────────────────────────────
  { key: "board.use",         label: "Botonera" },
  { key: "audio.generate",    label: "Audio IA" },
  { key: "narratives.run",    label: "Narrativas (ejecución)" },
  // ── Plataforma ───────────────────────────────────────────────
  { key: "admin",             label: "Estadísticas" },
  { key: "admin.access",      label: "Configuración de accesos" },
  { key: "admin.organizations",label: "Organizaciones" },
  { key: "admin.users",       label: "Usuarios" },
  // ── Contenido ────────────────────────────────────────────────
  { key: "admin.audios",      label: "Audios" },
  { key: "admin.categories",  label: "Categorías" },
  { key: "admin.buttons",     label: "Botones" },
  { key: "admin.narratives",  label: "Narrativas (admin)" },
  // ── Sistema ──────────────────────────────────────────────────
  { key: "admin.integrations",label: "Integraciones" },
  { key: "admin.platform",    label: "Personalización de plataforma" },
  { key: "admin.storage",     label: "Almacenamiento" },
  { key: "admin.maintenance", label: "Migraciones y backup" },
  { key: "admin.history",     label: "Historial" },
  { key: "admin.mail",        label: "Módulo de correo" },
] as const;

const moduleKeys = ACCESS_MODULES.map((module) => module.key);

function buildPreset(entries: Array<[string, boolean]>): Record<string, boolean> {
  const preset: Record<string, boolean> = Object.fromEntries(moduleKeys.map((key) => [key, false]));
  for (const [key, allowed] of entries) {
    preset[key] = allowed;
  }
  return preset;
}

export const DEFAULT_ROLE_PRESETS: Record<string, Record<string, boolean>> = {
  // OWNER: todo activado (calculado automáticamente)
  OWNER: buildPreset(moduleKeys.map((key) => [key, true])),

  ADMIN: buildPreset([
    ["board.use",           true],
    ["audio.generate",      true],
    ["narratives.run",      true],
    ["admin",               true],
    ["admin.access",        true],
    ["admin.organizations", true],
    ["admin.users",         true],
    ["admin.audios",        true],
    ["admin.categories",    true],
    ["admin.buttons",       true],
    ["admin.narratives",    true],
    ["admin.integrations",  true],
    ["admin.platform",      true],
    ["admin.history",       true],
    ["admin.mail",          true],
    // acceso y correo: solo OWNER por defecto
    ["admin.storage",       false],
    ["admin.maintenance",   false],
  ]),

  SUPERVISOR: buildPreset([
    ["board.use",           true],
    ["audio.generate",      true],
    ["narratives.run",      true],
    ["admin",               true],
    ["admin.audios",        true],
    ["admin.categories",    true],
    ["admin.buttons",       true],
    ["admin.narratives",    true],
    ["admin.history",       true],
    // sin acceso a gestión de org, users, sistema ni correo
    ["admin.access",        false],
    ["admin.mail",          false],
    ["admin.platform",      false],
    ["admin.organizations", false],
    ["admin.users",         false],
    ["admin.integrations",  false],
    ["admin.storage",       false],
    ["admin.maintenance",   false],
  ]),

  OPERATOR: buildPreset([
    ["board.use",           true],
    ["audio.generate",      true],
    ["narratives.run",      true],
    ["admin.audios",        true],
    ["admin.categories",    true],
    ["admin.buttons",       true],
    // sin acceso admin
    ["admin",               false],
    ["admin.access",        false],
    ["admin.mail",          false],
    ["admin.platform",      false],
    ["admin.organizations", false],
    ["admin.users",         false],
    ["admin.narratives",    false],
    ["admin.integrations",  false],
    ["admin.storage",       false],
    ["admin.maintenance",   false],
    ["admin.history",       false],
  ]),
};

export const DEFAULT_ACCESS_STATE: AccessState = {
  roleDefaults: DEFAULT_ROLE_PRESETS,
  organizationOverrides: {},
  organizationRoleDefaults: {},
};

export const ACCESS_STORAGE_KEY = "routlis.access.presets.v1";
