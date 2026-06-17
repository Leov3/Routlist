"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, RotateCcw, Save, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { api, type AccessSettings } from "@/lib/api";
import {
  ACCESS_MODULES,
  DEFAULT_ACCESS_STATE,
  DEFAULT_ROLE_PRESETS,
  type AccessMode,
  type AccessState,
} from "@/lib/access-presets";
import type { Organization } from "@/types/routlis";

const ROLE_OPTIONS = ["ADMIN", "SUPERVISOR", "OPERATOR"] as const;

const GROUPS = [
  { key: "operation", label: "Operación", match: (moduleKey: string) => ["board.use", "audio.generate", "narratives.run"].includes(moduleKey) },
  { key: "access", label: "Acceso", match: (moduleKey: string) => moduleKey.startsWith("admin.") },
  { key: "platform", label: "Plataforma", match: (moduleKey: string) => moduleKey === "admin" || moduleKey === "admin.integrations" },
  { key: "content", label: "Contenido", match: (moduleKey: string) => ["admin.audios", "admin.categories", "admin.buttons", "admin.narratives"].includes(moduleKey) },
  { key: "system", label: "Sistema", match: (moduleKey: string) => ["admin.storage", "admin.maintenance", "admin.history"].includes(moduleKey) },
] as const;

function cloneState(state: AccessState): AccessState {
  return {
    roleDefaults: JSON.parse(JSON.stringify(state.roleDefaults)),
    organizationOverrides: JSON.parse(JSON.stringify(state.organizationOverrides)),
    organizationRoleDefaults: JSON.parse(JSON.stringify(state.organizationRoleDefaults)),
  };
}

function normalizeState(raw?: Partial<AccessState> | null): AccessState {
  return {
    roleDefaults: { ...DEFAULT_ROLE_PRESETS, ...(raw?.roleDefaults ?? {}) },
    organizationOverrides: raw?.organizationOverrides ?? {},
    organizationRoleDefaults: raw?.organizationRoleDefaults ?? {},
  };
}

function groupModules() {
  return GROUPS.map((group) => ({
    ...group,
    modules: ACCESS_MODULES.filter((module) => group.match(module.key)),
  })).filter((group) => group.modules.length > 0);
}

export default function AdminAccessPage() {
  const [mode, setMode] = useState<AccessMode>("role");
  const [selectedRole, setSelectedRole] = useState<(typeof ROLE_OPTIONS)[number]>("ADMIN");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [state, setState] = useState<AccessState>(DEFAULT_ACCESS_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settings, orgs] = await Promise.all([
        api<AccessSettings>("/access-settings"),
        api<Organization[]>("/organizations"),
      ]);
      setState(normalizeState(settings));
      setOrganizations(orgs);
      setSelectedOrganizationId(orgs[0]?.id ?? "");
    } catch (err) {
      setState(DEFAULT_ACCESS_STATE);
      setOrganizations([]);
      setError(err instanceof Error ? err.message : "No se pudo cargar la configuración de accesos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupModules(), []);

  const effectiveModules = useMemo(() => {
    const base = state.roleDefaults[selectedRole] ?? DEFAULT_ROLE_PRESETS[selectedRole];
    if (mode === "role") {
      return base;
    }

    const orgRole = selectedOrganizationId
      ? state.organizationRoleDefaults[selectedOrganizationId]?.[selectedRole] ?? {}
      : {};

    return Object.fromEntries(
      ACCESS_MODULES.map((module) => [
        module.key,
        orgRole[module.key] ?? base[module.key] ?? false,
      ]),
    ) as Record<string, boolean>;
  }, [mode, selectedOrganizationId, selectedRole, state]);

  function toggleModule(key: string) {
    setState((current) => {
      const next = cloneState(current);

      if (mode === "role") {
        const base = next.roleDefaults[selectedRole] ?? DEFAULT_ROLE_PRESETS[selectedRole];
        next.roleDefaults[selectedRole] = {
          ...base,
          [key]: !base[key],
        };
        return next;
      }

      if (!selectedOrganizationId) {
        return next;
      }

      const orgRoles = next.organizationRoleDefaults[selectedOrganizationId] ?? {};
      const base =
        orgRoles[selectedRole] ??
        next.roleDefaults[selectedRole] ??
        DEFAULT_ROLE_PRESETS[selectedRole];

      orgRoles[selectedRole] = {
        ...base,
        [key]: !base[key],
      };
      next.organizationRoleDefaults[selectedOrganizationId] = orgRoles;
      return next;
    });
  }

  function restoreDefaults() {
    setState((current) => {
      const next = cloneState(current);

      if (mode === "role") {
        next.roleDefaults[selectedRole] = DEFAULT_ROLE_PRESETS[selectedRole];
        return next;
      }

      if (!selectedOrganizationId) {
        return next;
      }

      const orgRoles = next.organizationRoleDefaults[selectedOrganizationId] ?? {};
      delete orgRoles[selectedRole];
      if (Object.keys(orgRoles).length === 0) {
        delete next.organizationRoleDefaults[selectedOrganizationId];
      } else {
        next.organizationRoleDefaults[selectedOrganizationId] = orgRoles;
      }

      if (Object.keys(next.organizationOverrides[selectedOrganizationId] ?? {}).length === 0) {
        delete next.organizationOverrides[selectedOrganizationId];
      }

      return next;
    });
  }

  function copyRoleTemplateToOrganization() {
    if (!selectedOrganizationId) {
      return;
    }

    setState((current) => {
      const next = cloneState(current);
      const base = next.roleDefaults[selectedRole] ?? DEFAULT_ROLE_PRESETS[selectedRole];
      const orgRoles = next.organizationRoleDefaults[selectedOrganizationId] ?? {};

      orgRoles[selectedRole] = { ...base };
      next.organizationRoleDefaults[selectedOrganizationId] = orgRoles;
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api("/access-settings", {
        method: "PUT",
        body: JSON.stringify({
          roleDefaults: state.roleDefaults,
          organizationOverrides: {},
          organizationRoleDefaults: state.organizationRoleDefaults,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminProtectedPage>
      <PageHeader
        title="Accesos"
        description="Edita plantillas base por rol y sobrescrituras por organización sin perder el default."
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      {loading ? (
        <DataState>Cargando configuración de accesos...</DataState>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-on-surface">Editor simple</h2>
                <p className="text-sm text-on-surface-variant">
                  Primero selecciona organización, luego rol. Los cambios se guardan como sobrescritura sobre la plantilla.
                </p>
              </div>
              <div className="inline-flex rounded-full border border-outline-variant bg-surface p-1">
                <button
                  type="button"
                  onClick={() => setMode("role")}
                  className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold ${
                    mode === "role" ? "bg-primary text-on-primary" : "text-on-surface-variant"
                  }`}
                >
                  <UserRound className="h-4 w-4" />
                  Roles
                </button>
                <button
                  type="button"
                  onClick={() => setMode("organization")}
                  className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold ${
                    mode === "organization" ? "bg-primary text-on-primary" : "text-on-surface-variant"
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Organizaciones
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              {mode === "organization" ? (
                <div className="flex max-h-[calc(100dvh-18rem)] flex-col rounded-2xl border border-outline-variant bg-surface-container-high p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                      Organizaciones
                    </h3>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="grid gap-2">
                    {organizations.map((organization) => {
                      const active = organization.id === selectedOrganizationId;
                      return (
                        <button
                          key={organization.id}
                          type="button"
                          onClick={() => setSelectedOrganizationId(organization.id)}
                          className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                            active ? "border-primary/30 bg-primary/10" : "border-outline-variant bg-surface"
                          }`}
                        >
                          <p className="font-medium text-on-surface">{organization.name}</p>
                          <p className="text-xs text-on-surface-variant">{organization.slug}</p>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-outline-variant bg-surface-container-high p-4">
                <div className="mb-3 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                    Roles
                  </h3>
                </div>
                <div className="grid gap-2">
                  {ROLE_OPTIONS.map((role) => {
                    const active = selectedRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRole(role)}
                        className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                          active ? "border-primary/30 bg-primary/10" : "border-outline-variant bg-surface"
                        }`}
                      >
                        <p className="font-medium text-on-surface">{role}</p>
                        <p className="text-xs text-on-surface-variant">
                          {mode === "organization"
                            ? "Permisos del rol dentro de la organización"
                            : "Plantilla base global del rol"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {groups.map((group) => (
                <div key={group.key} className="rounded-2xl border border-outline-variant bg-surface-container-high p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                      {group.label}
                    </h3>
                  </div>
                  <div className="grid gap-2">
                    {group.modules.map((module) => {
                      const enabled = effectiveModules[module.key] ?? false;
                      const inherited = state.roleDefaults[selectedRole]?.[module.key] ?? DEFAULT_ROLE_PRESETS[selectedRole][module.key];
                      const orgOverride = selectedOrganizationId
                        ? state.organizationRoleDefaults[selectedOrganizationId]?.[selectedRole]?.[module.key]
                        : undefined;

                      return (
                        <button
                          key={module.key}
                          type="button"
                          aria-pressed={enabled}
                          aria-label={`${module.label} ${enabled ? "activado" : "desactivado"}`}
                          onClick={() => toggleModule(module.key)}
                          className={`flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-all hover:border-primary/20 ${
                            enabled ? "border-primary/40 bg-primary/10" : "border-outline-variant bg-surface-container"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-on-surface">{module.label}</p>
                            <p className="text-xs text-on-surface-variant">{module.key}</p>
                            {mode === "organization" ? (
                              <p className="mt-1 text-xs text-on-surface-variant">
                                Base: {inherited ? "ON" : "OFF"} · Override: {orgOverride === undefined ? "sin cambio" : orgOverride ? "ON" : "OFF"}
                              </p>
                            ) : null}
                          </div>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                              {enabled ? "ON" : "OFF"}
                            </span>
                            <span
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                enabled ? "bg-primary" : "bg-outline-variant"
                              }`}
                            >
                              <span
                                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow-sm transition-transform duration-200 ${
                                  enabled ? "translate-x-5 bg-on-primary" : "translate-x-0 bg-on-surface-variant"
                                }`}
                              />
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={restoreDefaults}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-outline-variant px-4 text-sm font-semibold text-on-surface-variant"
              >
                <RotateCcw className="h-4 w-4" />
                Restaurar por defecto
              </button>
              {mode === "organization" ? (
                <button
                  type="button"
                  onClick={copyRoleTemplateToOrganization}
                  disabled={!selectedOrganizationId}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-primary/30 px-4 text-sm font-semibold text-on-surface-variant disabled:opacity-50"
                >
                  <Building2 className="h-4 w-4" />
                  Copiar plantilla del rol
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-tertiary/10 text-tertiary">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-on-surface">Resumen efectivo</h2>
                <p className="text-sm text-on-surface-variant">
                  La organización puede sobrescribir el preset del rol sin borrar la plantilla base.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-outline-variant bg-surface-container-high p-4 text-sm text-on-surface-variant">
              {mode === "organization" ? (
                <p>
                  Organización{" "}
                  <strong className="text-on-surface">
                    {organizations.find((organization) => organization.id === selectedOrganizationId)?.name ?? "sin seleccionar"}
                  </strong>{" "}
                  y rol <strong className="text-on-surface">{selectedRole}</strong>.
                </p>
              ) : (
                <p>
                  Estás editando la plantilla global del rol <strong className="text-on-surface">{selectedRole}</strong>.
                </p>
              )}
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl border border-outline-variant bg-surface-container-high p-4 text-sm">
              {ACCESS_MODULES.map((module) => (
                <div key={module.key} className="flex items-center justify-between gap-4">
                  <span className="text-on-surface-variant">{module.label}</span>
                  <span className={`font-semibold ${effectiveModules[module.key] ? "text-emerald-400" : "text-on-surface-variant"}`}>
                    {effectiveModules[module.key] ? "ON" : "OFF"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </AdminProtectedPage>
  );
}
