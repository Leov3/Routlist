"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, CheckCircle, Plus, Search, XCircle } from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import type { Organization } from "@/types/routlis";

type OrganizationForm = {
  name: string;
  status: "ACTIVE" | "DISABLED";
};

const emptyForm: OrganizationForm = {
  name: "",
  status: "ACTIVE",
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [form, setForm] = useState<OrganizationForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function load() {
    try {
      const [list, current] = await Promise.all([
        api<Organization[]>("/organizations"),
        api<Organization>("/organizations/current"),
      ]);
      setOrganizations(list);
      setCurrentOrganization(current);
    } catch {
      setOrganizations([]);
      setCurrentOrganization(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return organizations.filter((organization) =>
      `${organization.name} ${organization.id} ${organization.status}`.toLowerCase().includes(term),
    );
  }, [organizations, search]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSaving(true);
    try {
      await api("/organizations", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear la organización.");
    } finally {
      setSaving(false);
    }
  }

  async function update(id: string, payload: Partial<OrganizationForm>) {
    setErrorMessage(null);
    try {
      await api(`/organizations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo actualizar la organización.");
    }
  }

  async function switchOrganization(organizationId: string) {
    setErrorMessage(null);
    try {
      await api("/auth/switch-organization", {
        method: "POST",
        body: JSON.stringify({ organizationId }),
      });
      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo cambiar la organización activa.");
    }
  }

  return (
    <ProtectedPage allowedRoles={["OWNER"]}>
      <PageHeader
        title="Organizaciones"
        description="Administración global de tenants y cambio de contexto para super admin."
      />

      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <form onSubmit={create} className="mb-5 grid gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 md:grid-cols-[1fr_180px_auto]">
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Nombre de la organización"
          className="h-10 rounded-xl border border-outline px-3 text-sm"
          required
        />
        <select
          value={form.status}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              status: event.target.value as OrganizationForm["status"],
            }))
          }
          className="h-10 rounded-xl border border-outline px-3 text-sm"
        >
          <option value="ACTIVE">Activa</option>
          <option value="DISABLED">Deshabilitada</option>
        </select>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {saving ? "Creando..." : "Crear organización"}
        </button>
      </form>

      <div className="mb-3 grid gap-2 rounded-xl border border-outline-variant bg-surface-container p-3 md:grid-cols-[1fr_180px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filtrar organizaciones"
            className="h-10 w-full rounded-xl border border-outline pl-10 pr-3 text-sm"
          />
        </label>
        <div className="flex items-center rounded-xl border border-outline bg-surface px-3 text-sm text-on-surface-variant">
          {currentOrganization ? (
            <span className="truncate">
              Actual: {currentOrganization.name} ({currentOrganization.status})
            </span>
          ) : (
            <span>Sin organización activa</span>
          )}
        </div>
      </div>

      {loading ? (
        <DataState>Cargando organizaciones...</DataState>
      ) : filteredOrganizations.length ? (
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-surface-container-high text-xs uppercase text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Organización</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Miembros</th>
                <th className="px-4 py-3">Audios</th>
                <th className="px-4 py-3">Categorías</th>
                <th className="px-4 py-3">Botones</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrganizations.map((organization) => {
                const isCurrent = currentOrganization?.id === organization.id;

                return (
                  <tr key={organization.id} className="border-t border-outline-variant">
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{organization.name}</p>
                        <p className="truncate text-xs text-on-surface-variant">{organization.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          void update(organization.id, {
                            status: organization.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                          })
                        }
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                          organization.status === "ACTIVE"
                            ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                            : "border border-outline-variant bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {organization.status === "ACTIVE" ? (
                          <CheckCircle className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        {organization.status === "ACTIVE" ? "Activa" : "Deshabilitada"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{organization._count?.members ?? 0}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{organization._count?.audioAssets ?? 0}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{organization._count?.audioCategories ?? 0}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{organization._count?.audioButtons ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void switchOrganization(organization.id)}
                          disabled={isCurrent}
                          className="inline-flex items-center gap-2 rounded-xl border border-outline px-3 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                          {isCurrent ? "Activa" : "Usar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <DataState>No hay organizaciones.</DataState>
      )}
    </ProtectedPage>
  );
}
