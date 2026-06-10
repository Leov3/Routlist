"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, CheckCircle, Pencil, Plus, Search, XCircle } from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
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

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
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

  async function load() {
    try {
      const [me, userRows] = await Promise.all([
        getCurrentUser(),
        api<UserRow[]>("/users"),
      ]);
      setCurrentUser(me);
      setUsers(userRows);
    } catch {
      setUsers([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const roleOptions =
    currentUser?.role === "OWNER"
      ? ["ADMIN", "SUPERVISOR", "OPERATOR"]
      : ["SUPERVISOR", "OPERATOR"];

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

  return (
    <ProtectedPage requiredPermissions={["user:create"]}>
      <PageHeader title="Usuarios" description="Miembros, roles y permisos de acceso." />
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
                            <button onClick={() => startEdit(user)} className="rounded-xl border border-outline p-2" title="Editar"><Pencil className="h-4 w-4" /></button>
                            <button disabled={isSelf} onClick={() => void setActive(user.id, status !== "ACTIVE")} className="rounded-xl border border-outline p-2 disabled:opacity-40" title={status === "ACTIVE" ? "Desactivar" : "Activar"}>{status === "ACTIVE" ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}</button>
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
    </ProtectedPage>
  );
}
