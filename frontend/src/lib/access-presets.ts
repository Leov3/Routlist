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
  { key: "board.use", label: "Botonera" },
  { key: "audio.generate", label: "Audio IA" },
  { key: "narratives.run", label: "Narrativas en ejecución" },
  { key: "admin", label: "Estadísticas" },
  { key: "admin.organizations", label: "Organizaciones" },
  { key: "admin.users", label: "Usuarios" },
  { key: "admin.audios", label: "Audios" },
  { key: "admin.categories", label: "Categorías" },
  { key: "admin.buttons", label: "Botones" },
  { key: "admin.narratives", label: "Narrativas" },
  { key: "admin.integrations", label: "Integraciones" },
  { key: "admin.storage", label: "Almacenamiento" },
  { key: "admin.maintenance", label: "Migraciones y backup" },
  { key: "admin.history", label: "Historial" },
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
  OWNER: buildPreset(moduleKeys.map((key) => [key, true])),
  ADMIN: buildPreset([
    ["admin", true],
    ["admin.organizations", true],
    ["admin.users", true],
    ["admin.audios", true],
    ["admin.categories", true],
    ["admin.buttons", true],
    ["admin.narratives", true],
    ["admin.history", true],
    ["board.use", true],
    ["narratives.run", true],
    ["audio.generate", true],
  ]),
  SUPERVISOR: buildPreset([
    ["admin", true],
    ["admin.audios", true],
    ["admin.categories", true],
    ["admin.buttons", true],
    ["admin.narratives", true],
    ["admin.history", true],
    ["board.use", true],
    ["narratives.run", true],
    ["audio.generate", true],
  ]),
  OPERATOR: buildPreset([
    ["admin.audios", true],
    ["admin.categories", true],
    ["admin.buttons", true],
    ["board.use", true],
    ["narratives.run", true],
    ["audio.generate", true],
  ]),
};

export const DEFAULT_ACCESS_STATE: AccessState = {
  roleDefaults: DEFAULT_ROLE_PRESETS,
  organizationOverrides: {},
  organizationRoleDefaults: {},
};

export const ACCESS_STORAGE_KEY = "routlis.access.presets.v1";
