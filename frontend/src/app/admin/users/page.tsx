"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, CheckCircle, Pencil, Plus, Search, Trash2, XCircle } from "lucide-react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import type { AuthUser } from "@/types/routlis";

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  status: string;
  membershipStatus?: string;
  role: string;
};

type SortKey = "fullName" | "email" | "role" | "status";
type StatusFilter = "all" | "active" | "disabled";
type OrganizationInvite = {
  id: string;
  email: string;
  inviteeName?: string | null;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  invitedBy?: { id: string; fullName: string; email: string } | null;
  acceptedBy?: { id: string; fullName: string; email: string } | null;
};

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [currentOrganization, setCurrentOrganization] = useState<{
    name: string;
    maxUsers?: number | null;
  } | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Admin123*");
  const [role, setRole] = useState("OPERATOR");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("fullName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "OPERATOR",
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteeName, setInviteeName] = useState("");
  const [inviteRole, setInviteRole] = useState("OPERATOR");
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");

  async function load() {
    try {
      const [me, userRows] = await Promise.all([
        getCurrentUser(),
        api<UserRow[]>("/users"),
      ]);
      setCurrentUser(me);
      setUsers(userRows);
      setCurrentOrganization(null);
      if (me.role === "OWNER" || me.role === "ADMIN") {
        const organization = await api<{ name: string; maxUsers?: number | null }>("/organizations/current").catch(
          () => null,
        );
        setCurrentOrganization(organization);
      }
      if (me.role !== "OPERATOR") {
        const data = await api<OrganizationInvite[]>(`/organizations/${me.organizationId}/invites`);
        setInvites(data.filter((invite) => invite.status === "PENDING"));
      } else {
        setInvites([]);
      }
    } catch {
      setUsers([]);
      setInvites([]);
      setCurrentOrganization(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const roleOptions =
    currentUser?.role === "OWNER"
      ? ["OWNER", "ADMIN", "SUPERVISOR", "OPERATOR"]
      : ["SUPERVISOR", "OPERATOR"];

  const canSeeQuota = currentUser?.role === "OWNER" || currentUser?.role === "ADMIN";
  const memberCount = users.length;
  const userLimit = currentOrganization?.maxUsers ?? 0;
  const quotaPercent = userLimit ? Math.min(100, Math.round((memberCount / userLimit) * 100)) : 0;
  const quotaWarning = userLimit ? quotaPercent >= 80 && quotaPercent < 100 : false;
  const quotaCritical = userLimit ? quotaPercent >= 100 : false;

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users
      .filter((user) => {
        const status = user.membershipStatus ?? user.status;
        const matchesSearch = `${user.fullName} ${user.email}`.toLowerCase().includes(term);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && status === "ACTIVE") ||
          (statusFilter === "disabled" && status !== "ACTIVE");
        const matchesRole = roleFilter === "all" || user.role === roleFilter;

        return matchesSearch && matchesStatus && matchesRole;
      })
      .sort((a, b) => {
        const result = String(a[sortKey]).localeCompare(String(b[sortKey]));
        return sortDirection === "asc" ? result : -result;
      });
  }, [roleFilter, search, sortDirection, sortKey, statusFilter, users]);

  function sortBy(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await api("/users", {
      method: "POST",
      body: JSON.stringify({ fullName, email, password, role }),
    });
    setFullName("");
    setEmail("");
    setPassword("Admin123*");
    await load();
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      role: user.role,
    });
  }

  async function saveEdit(id: string) {
    await api(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        fullName: editForm.fullName,
        email: editForm.email,
        role: editForm.role,
        ...(editForm.password ? { password: editForm.password } : {}),
      }),
    });
    setEditingId(null);
    await load();
  }

  async function setActive(id: string, active: boolean) {
    await api(`/users/${id}/${active ? "enable" : "disable"}`, {
      method: "PATCH",
    });
    await load();
  }

  async function deleteUser(id: string, fullName: string) {
    const confirmed = window.confirm(`Eliminar a ${fullName} de esta organización?`);
    if (!confirmed) return;

    await api(`/users/${id}`, {
      method: "DELETE",
    });
    await load();
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser || currentUser.role === "OPERATOR") return;

    setInviteLoading(true);
    setInviteError("");
    try {
      await api(`/organizations/${currentUser.organizationId}/invites`, {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail,
          inviteeName,
          role: inviteRole,
        }),
      });
      setInviteEmail("");
      setInviteeName("");
      setInviteRole("OPERATOR");
      await load();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "No se pudo crear la invitación.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function resendInvite(inviteId: string) {
    if (!currentUser) return;
    await api(`/organizations/${currentUser.organizationId}/invites/${inviteId}/resend`, {
      method: "POST",
    });
    await load();
  }

  async function approveInvite(inviteId: string) {
    if (!currentUser) return;
    await api(`/organizations/${currentUser.organizationId}/invites/${inviteId}/approve`, {
      method: "POST",
    });
    await load();
  }

  async function rejectInvite(inviteId: string) {
    if (!currentUser) return;
    await api(`/organizations/${currentUser.organizationId}/invites/${inviteId}/reject`, {
      method: "POST",
    });
    await load();
  }

  return (
    <AdminProtectedPage>
      <PageHeader title="Usuarios" description="Miembros, roles y permisos de acceso." />
      {canSeeQuota ? (
        <div className="mb-5 rounded-xl border border-outline-variant bg-surface-container p-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-semibold text-on-surface">Cupo de usuarios</p>
              <p className="text-on-surface-variant">
                {currentOrganization
                  ? `Organización activa: ${currentOrganization.name}`
                  : currentUser
                    ? `Organización activa: ${currentUser.organizationId}`
                    : "Cargando organización..."}
              </p>
            </div>
            <span
              className={`text-xs font-semibold ${
                quotaCritical ? "text-[color:var(--danger-text-muted)]" : quotaWarning ? "text-[color:var(--warning-text-muted)]" : "text-on-surface-variant"
              }`}
            >
              {userLimit ? `${memberCount} / ${userLimit}` : `${memberCount} usuarios`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-container-high">
            <div
              className={`h-2 rounded-full ${
                quotaCritical ? "bg-[color:var(--danger-icon)]" : quotaWarning ? "bg-[color:var(--warning-icon)]" : "bg-primary"
              }`}
              style={{ width: `${userLimit ? quotaPercent : 0}%` }}
            />
          </div>
          <p
            className={`mt-2 text-xs ${
              quotaCritical ? "text-[color:var(--danger-text-muted)]" : quotaWarning ? "text-[color:var(--warning-text-muted)]" : "text-on-surface-variant"
            }`}
          >
            {quotaCritical ? "Cupo completo" : quotaWarning ? "Te estás acercando al límite" : "Capacidad disponible"}
          </p>
        </div>
      ) : null}
      {currentUser && currentUser.role !== "OPERATOR" ? (
        <section className="mb-5 rounded-xl border border-outline-variant bg-surface-container p-4">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Invitaciones de la organización activa</h2>
              <p className="text-sm text-on-surface-variant">
                Desde aquí el administrador gestiona invitaciones, aprobaciones y rechazos de su tenant.
              </p>
            </div>
            <span className="rounded-full border border-outline px-3 py-1 text-xs text-on-surface-variant">
              {invites.length} total
            </span>
          </div>

          <form onSubmit={createInvite} className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
            <input
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              type="email"
              placeholder="usuario@correo.com"
              className="h-10 rounded-xl border border-outline px-3 text-sm"
              required
            />
            <input
              value={inviteeName}
              onChange={(event) => setInviteeName(event.target.value)}
              type="text"
              placeholder="Nombre de la persona"
              className="h-10 rounded-xl border border-outline px-3 text-sm"
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value)}
              className="h-10 rounded-xl border border-outline px-3 text-sm"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="SUPERVISOR">SUPERVISOR</option>
              <option value="OPERATOR">OPERATOR</option>
            </select>
            <button
              type="submit"
              disabled={inviteLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {inviteLoading ? "Invitando..." : "Invitar"}
            </button>
          </form>
          {inviteError ? <p className="mb-3 text-sm text-red-600">{inviteError}</p> : null}

          {invites.length ? (
            <div className="overflow-hidden rounded-xl border border-outline-variant">
              <table className="w-full min-w-[920px] text-left text-sm">
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
                        <p className="text-xs text-on-surface-variant">{invite.inviteeName ?? "Sin nombre de invitado"}</p>
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
                          <button
                            type="button"
                            onClick={() => void rejectInvite(invite.id)}
                            disabled={invite.status === "REJECTED"}
                            className="danger-surface inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <DataState>No hay invitaciones en esta organización.</DataState>
          )}
        </section>
      ) : null}

      <form onSubmit={create} className="mb-5 grid gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 md:grid-cols-[1fr_1fr_1fr_160px_auto]">
        <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nombre" className="h-10 rounded-xl border border-outline px-3 text-sm" required />
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" className="h-10 rounded-xl border border-outline px-3 text-sm" required />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contrasena" className="h-10 rounded-xl border border-outline px-3 text-sm" required />
        <select value={role} onChange={(event) => setRole(event.target.value)} className="h-10 rounded-xl border border-outline px-3 text-sm">{roleOptions.map((option) => <option key={option}>{option}</option>)}</select>
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary"><Plus className="h-4 w-4" />Crear</button>
      </form>

      <div className="mb-3 grid gap-2 rounded-xl border border-outline-variant bg-surface-container p-3 lg:grid-cols-[1fr_180px_180px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar usuarios" className="h-10 w-full rounded-xl border border-outline pl-10 pr-3 text-sm" />
        </label>
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-10 rounded-xl border border-outline px-3 text-sm">
          <option value="all">Todos los roles</option>
          <option value="OWNER">OWNER</option>
          <option value="ADMIN">ADMIN</option>
          <option value="SUPERVISOR">SUPERVISOR</option>
          <option value="OPERATOR">OPERATOR</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-10 rounded-xl border border-outline px-3 text-sm">
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="disabled">Inactivos</option>
        </select>
      </div>

      {filteredUsers.length ? (
        <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-surface-container-high text-xs uppercase text-on-surface-variant">
              <tr>
                <th className="px-4 py-3"><button onClick={() => sortBy("fullName")} className="inline-flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Nombre</button></th>
                <th className="px-4 py-3"><button onClick={() => sortBy("email")} className="inline-flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Email</button></th>
                <th className="px-4 py-3"><button onClick={() => sortBy("role")} className="inline-flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Rol</button></th>
                <th className="px-4 py-3">Nueva contrasena</th>
                <th className="px-4 py-3"><button onClick={() => sortBy("status")} className="inline-flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Estado</button></th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const status = user.membershipStatus ?? user.status;
                const isSelf = currentUser?.id === user.id;

                return (
                  <tr key={user.id} className="border-t border-outline-variant">
                    <td className="px-4 py-3">{editingId === user.id ? <input value={editForm.fullName} onChange={(event) => setEditForm((current) => ({ ...current, fullName: event.target.value }))} className="h-9 rounded-xl border border-outline px-2 text-sm" /> : <span className="font-medium">{user.fullName}</span>}</td>
                    <td className="px-4 py-3">{editingId === user.id ? <input value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} type="email" className="h-9 rounded-xl border border-outline px-2 text-sm" /> : <span className="text-on-surface-variant">{user.email}</span>}</td>
                    <td className="px-4 py-3">{editingId === user.id ? <select value={editForm.role} onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))} className="h-9 rounded-xl border border-outline px-2 text-sm">{roleOptions.map((option) => <option key={option}>{option}</option>)}</select> : user.role}</td>
                    <td className="px-4 py-3">{editingId === user.id ? <input value={editForm.password} onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))} placeholder="Sin cambio" className="h-9 rounded-xl border border-outline px-2 text-sm" /> : "-"}</td>
                    <td className="px-4 py-3">{status === "ACTIVE" ? "Activo" : "Inactivo"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {editingId === user.id ? (
                          <>
                            <button onClick={() => void saveEdit(user.id)} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-on-primary">Guardar</button>
                            <button onClick={() => setEditingId(null)} className="rounded-xl border border-outline px-3 py-2 text-xs font-semibold">Cancelar</button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => startEdit(user)} className="rounded-xl border border-outline p-2" title="Editar"><Pencil className="h-4 w-4" /></button>
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => void setActive(user.id, status !== "ACTIVE")}
                              className="rounded-xl border border-outline p-2 disabled:opacity-40"
                              title={status === "ACTIVE" ? "Desactivar" : "Activar"}
                            >
                              {status === "ACTIVE" ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => void deleteUser(user.id, user.fullName)}
                              className="danger-surface inline-flex items-center justify-center rounded-xl p-2 disabled:opacity-40"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <DataState>No hay usuarios.</DataState>
      )}
    </AdminProtectedPage>
  );
}
