"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, CheckCircle, PencilLine, Plus, Search, Trash2, X, XCircle } from "lucide-react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import type { Organization } from "@/types/routlis";

type OrganizationForm = {
  name: string;
  slug: string;
  status: "ACTIVE" | "DISABLED";
};

type OrganizationInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string | null;
  invitedBy?: { id: string; fullName: string; email: string } | null;
  acceptedBy?: { id: string; fullName: string; email: string } | null;
};

const emptyForm: OrganizationForm = {
  name: "",
  slug: "",
  status: "ACTIVE",
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [form, setForm] = useState<OrganizationForm>(emptyForm);
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);
  const [integrityOrganization, setIntegrityOrganization] = useState<Organization | null>(null);
  const [integrityReport, setIntegrityReport] = useState<{
    organization: { id: string; name: string };
    narrativesCount: number;
    issuesCount: number;
    issues: Array<{ narrativeId: string; narrativeTitle: string; type: string; resourceId: string; message: string }>;
    ok: boolean;
  } | null>(null);
  const [inviteOrganizationId, setInviteOrganizationId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("ADMIN");
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function sanitizeOrganizationPayload(payload: Partial<OrganizationForm>) {
    return {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.slug?.trim() ? { slug: payload.slug.trim() } : {}),
      ...(payload.status ? { status: payload.status } : {}),
    };
  }

  async function load() {
    try {
      const [list, current] = await Promise.all([
        api<Organization[]>("/organizations"),
        api<Organization>("/organizations/current"),
      ]);
      setOrganizations(list);
      setCurrentOrganization(current);
      setInviteOrganizationId((current && current.id) || list[0]?.id || "");
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

  useEffect(() => {
    async function loadInvites() {
      if (!inviteOrganizationId) {
        setInvites([]);
        return;
      }

      try {
        const data = await api<OrganizationInvite[]>(`/organizations/${inviteOrganizationId}/invites`);
        setInvites(data);
      } catch {
        setInvites([]);
      }
    }

    void loadInvites();
  }, [inviteOrganizationId]);

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
        body: JSON.stringify(sanitizeOrganizationPayload(form)),
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
        body: JSON.stringify(sanitizeOrganizationPayload(payload)),
      });
      await load();
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo actualizar la organización.");
      return false;
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingOrganization) return;

    setSaving(true);
    setErrorMessage(null);
    try {
      const updated = await update(editingOrganization.id, {
        name: editingOrganization.name,
        slug: editingOrganization.slug ?? undefined,
        status: editingOrganization.status as OrganizationForm["status"],
      });
      if (updated) {
        setEditingOrganization(null);
      }
    } catch {
      // handled by update
    } finally {
      setSaving(false);
    }
  }

  async function removeOrganization(organization: Organization) {
    const confirmed = window.confirm(
      `Eliminar la organización "${organization.name}" borrará sus módulos, usuarios asociados y configuración. Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setDeletingId(organization.id);
    setErrorMessage(null);
    try {
      await api(`/organizations/${organization.id}`, {
        method: "DELETE",
      });
      if (currentOrganization?.id === organization.id) {
        window.location.reload();
        return;
      }
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo eliminar la organización.");
    } finally {
      setDeletingId(null);
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

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteOrganizationId) return;

    setInviteLoading(true);
    setInviteError(null);
    try {
      await api(`/organizations/${inviteOrganizationId}/invites`, {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      setInviteEmail("");
      setInviteRole("ADMIN");
      const data = await api<OrganizationInvite[]>(`/organizations/${inviteOrganizationId}/invites`);
      setInvites(data);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "No se pudo crear la invitación.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function resendInvite(inviteId: string) {
    if (!inviteOrganizationId) return;
    try {
      await api(`/organizations/${inviteOrganizationId}/invites/${inviteId}/resend`, { method: "POST" });
      const data = await api<OrganizationInvite[]>(`/organizations/${inviteOrganizationId}/invites`);
      setInvites(data);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "No se pudo reenviar la invitación.");
    }
  }

  async function approveInvite(inviteId: string) {
    if (!inviteOrganizationId) return;
    try {
      await api(`/organizations/${inviteOrganizationId}/invites/${inviteId}/approve`, { method: "POST" });
      const data = await api<OrganizationInvite[]>(`/organizations/${inviteOrganizationId}/invites`);
      setInvites(data);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "No se pudo aprobar la invitación.");
    }
  }

  async function auditNarratives(organization: Organization) {
    setIntegrityOrganization(organization);
    setIntegrityReport(null);
    try {
      const report = await api<{
        organization: { id: string; name: string };
        narrativesCount: number;
        issuesCount: number;
        issues: Array<{ narrativeId: string; narrativeTitle: string; type: string; resourceId: string; message: string }>;
        ok: boolean;
      }>(`/organizations/${organization.id}/narrative-integrity`);
      setIntegrityReport(report);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo auditar las narrativas.");
    }
  }

  return (
    <AdminProtectedPage>
      <PageHeader
        title="Organizaciones"
        description="Administración global de tenants y cambio de contexto para super admin."
      />

      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mb-5 rounded-xl border border-outline-variant bg-surface-container p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-2 text-sm">
            <span>Organización</span>
            <select
              value={inviteOrganizationId}
              onChange={(event) => setInviteOrganizationId(event.target.value)}
              className="h-10 min-w-[240px] rounded-xl border border-outline px-3"
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <form onSubmit={createInvite} className="flex flex-1 flex-wrap items-end gap-3">
            <label className="grid flex-1 gap-2 text-sm">
              <span>Email</span>
              <input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                type="email"
                className="h-10 rounded-xl border border-outline px-3"
                placeholder="usuario@correo.com"
                required
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span>Rol</span>
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value)}
                className="h-10 rounded-xl border border-outline px-3"
              >
                <option value="ADMIN">ADMIN</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="OPERATOR">OPERATOR</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={inviteLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {inviteLoading ? "Invitando..." : "Invitar usuario"}
            </button>
          </form>
        </div>
        {inviteError ? <p className="mt-3 text-sm text-red-600">{inviteError}</p> : null}
      </div>

      <div className="mb-5 rounded-xl border border-outline-variant bg-surface-container p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Invitaciones</h2>
            <p className="text-sm text-on-surface-variant">Invitaciones pendientes y aceptadas de la organización seleccionada.</p>
          </div>
          <span className="rounded-full border border-outline px-3 py-1 text-xs text-on-surface-variant">
            {invites.length} total
          </span>
        </div>
        {invites.length ? (
          <div className="overflow-hidden rounded-xl border border-outline-variant">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-container-high text-xs uppercase text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Vence</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id} className="border-t border-outline-variant">
                    <td className="px-4 py-3">
                      <p className="font-medium">{invite.email}</p>
                      <p className="text-xs text-on-surface-variant">{invite.invitedBy?.fullName ?? "Sistema"}</p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{invite.role}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{invite.status}</td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {new Date(invite.expiresAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void resendInvite(invite.id)}
                          className="rounded-xl border border-outline px-3 py-2 text-xs font-semibold"
                        >
                          Reenviar
                        </button>
                        <button
                          type="button"
                          onClick={() => void approveInvite(invite.id)}
                          disabled={invite.status !== "PENDING"}
                          className="rounded-xl border border-outline px-3 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <DataState>No hay invitaciones para mostrar.</DataState>
        )}
      </div>

      <form onSubmit={create} className="mb-5 grid gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 md:grid-cols-[1fr_1fr_180px_auto]">
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Nombre de la organización"
          className="h-10 rounded-xl border border-outline px-3 text-sm"
          required
        />
        <input
          value={form.slug}
          onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
          placeholder="Slug opcional"
          className="h-10 rounded-xl border border-outline px-3 text-sm"
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
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-surface-container-high text-xs uppercase text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Organización</th>
                <th className="px-4 py-3">Slug</th>
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
                    <td className="px-4 py-3 text-on-surface-variant">{organization.slug ?? "—"}</td>
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
                          onClick={() => setEditingOrganization(organization)}
                          className="inline-flex items-center gap-2 rounded-xl border border-outline px-3 py-2 text-xs font-semibold"
                        >
                          <PencilLine className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void auditNarratives(organization)}
                          className="inline-flex items-center gap-2 rounded-xl border border-outline px-3 py-2 text-xs font-semibold"
                        >
                          <Search className="h-4 w-4" />
                          Auditar narrativas
                        </button>
                        <button
                          type="button"
                          onClick={() => void switchOrganization(organization.id)}
                          disabled={isCurrent}
                          className="inline-flex items-center gap-2 rounded-xl border border-outline px-3 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                          {isCurrent ? "Activa" : "Usar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeOrganization(organization)}
                          disabled={deletingId === organization.id || isCurrent}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          {deletingId === organization.id ? "Borrando..." : "Eliminar"}
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

      {editingOrganization ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-outline-variant bg-surface-container p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Editar organización</h2>
                <p className="text-sm text-on-surface-variant">Actualiza nombre, slug y estado.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrganization(null)}
                className="rounded-full border border-outline p-2 text-on-surface-variant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={saveEdit} className="grid gap-4">
              <label className="grid gap-2 text-sm">
                <span>Nombre</span>
                <input
                  value={editingOrganization.name}
                  onChange={(event) =>
                    setEditingOrganization((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                  className="h-10 rounded-xl border border-outline px-3"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span>Slug</span>
                <input
                  value={editingOrganization.slug ?? ""}
                  onChange={(event) =>
                    setEditingOrganization((current) =>
                      current ? { ...current, slug: event.target.value } : current,
                    )
                  }
                  className="h-10 rounded-xl border border-outline px-3"
                  placeholder="opcional"
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span>Estado</span>
                <select
                  value={editingOrganization.status}
                  onChange={(event) =>
                    setEditingOrganization((current) =>
                      current ? { ...current, status: event.target.value as OrganizationForm["status"] } : current,
                    )
                  }
                  className="h-10 rounded-xl border border-outline px-3"
                >
                  <option value="ACTIVE">Activa</option>
                  <option value="DISABLED">Deshabilitada</option>
                </select>
              </label>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrganization(null)}
                  className="rounded-xl border border-outline px-4 py-2 text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60"
                >
                  <CheckCircle className="h-4 w-4" />
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {integrityOrganization ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-outline-variant bg-surface-container p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Auditoría de narrativas</h2>
                <p className="text-sm text-on-surface-variant">{integrityOrganization.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIntegrityOrganization(null);
                  setIntegrityReport(null);
                }}
                className="rounded-full border border-outline p-2 text-on-surface-variant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!integrityReport ? (
              <DataState>Revisando narrativas...</DataState>
            ) : integrityReport.ok ? (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                No se encontraron problemas. {integrityReport.narrativesCount} narrativas revisadas.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {integrityReport.issuesCount} problema(s) detectado(s) en {integrityReport.narrativesCount} narrativas.
                </div>
                <div className="max-h-[420px] overflow-auto rounded-2xl border border-outline-variant">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-container-high text-xs uppercase text-on-surface-variant">
                      <tr>
                        <th className="px-4 py-3">Narrativa</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Recurso</th>
                        <th className="px-4 py-3">Mensaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {integrityReport.issues.map((issue) => (
                        <tr key={`${issue.narrativeId}-${issue.resourceId}-${issue.type}`} className="border-t border-outline-variant">
                          <td className="px-4 py-3">
                            <p className="font-medium text-on-surface">{issue.narrativeTitle}</p>
                            <p className="text-xs text-on-surface-variant">{issue.narrativeId}</p>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant">{issue.type}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{issue.resourceId}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{issue.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </AdminProtectedPage>
  );
}
