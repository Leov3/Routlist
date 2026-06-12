"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, CheckCircle, Pencil, Plus, Search, Trash2, XCircle } from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import type { AudioCategory } from "@/types/routlis";

type SortKey = "name" | "sortOrder" | "isActive";
type StatusFilter = "all" | "active" | "inactive";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<AudioCategory[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("sortOrder");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", sortOrder: "0" });

  async function load() {
    try {
      setCategories(await api<AudioCategory[]>("/audio-categories"));
    } catch {
      setCategories([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();

    return categories
      .filter((category) => {
        const matchesSearch = `${category.name} ${category.description ?? ""}`.toLowerCase().includes(term);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && category.isActive) ||
          (statusFilter === "inactive" && !category.isActive);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const left = a[sortKey];
        const right = b[sortKey];
        const result =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right));

        return sortDirection === "asc" ? result : -result;
      });
  }, [categories, search, sortDirection, sortKey, statusFilter]);

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
    await api("/audio-categories", {
      method: "POST",
      body: JSON.stringify({
        name,
        description: description || undefined,
        sortOrder: Number(sortOrder || 0),
      }),
    });
    setName("");
    setDescription("");
    setSortOrder("0");
    await load();
  }

  function startEdit(category: AudioCategory) {
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      description: category.description ?? "",
      sortOrder: String(category.sortOrder),
    });
  }

  async function saveEdit(id: string) {
    await api(`/audio-categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: editForm.name,
        description: editForm.description || null,
        sortOrder: Number(editForm.sortOrder || 0),
      }),
    });
    setEditingId(null);
    await load();
  }

  async function setActive(id: string, isActive: boolean) {
    await api(`/audio-categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
    await load();
  }

  async function remove(id: string) {
    await api(`/audio-categories/${id}`, {
      method: "DELETE",
    });
    await load();
  }

  return (
    <ProtectedPage requiredPermissions={["category:create"]}>
      <PageHeader title="Categorias" description="Agrupaciones visibles en la botonera." />
      <form onSubmit={create} className="mb-5 grid gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 md:grid-cols-[1fr_1fr_120px_auto]">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre" className="h-10 rounded-xl border border-outline px-3 text-sm" required />
        <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descripcion" className="h-10 rounded-xl border border-outline px-3 text-sm" />
        <input value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} type="number" min="0" className="h-10 rounded-xl border border-outline px-3 text-sm" />
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary"><Plus className="h-4 w-4" />Crear</button>
      </form>

      <div className="mb-3 grid gap-2 rounded-xl border border-outline-variant bg-surface-container p-3 md:grid-cols-[1fr_180px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar categorias" className="h-10 w-full rounded-xl border border-outline pl-10 pr-3 text-sm" />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-10 rounded-xl border border-outline px-3 text-sm">
          <option value="all">Todas</option>
          <option value="active">Activas</option>
          <option value="inactive">Inactivas</option>
        </select>
      </div>

      {filteredCategories.length ? (
        <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface-container-high text-xs uppercase text-on-surface-variant">
              <tr>
                <th className="px-4 py-3"><button onClick={() => sortBy("name")} className="inline-flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Nombre</button></th>
                <th className="px-4 py-3">Descripcion</th>
                <th className="px-4 py-3"><button onClick={() => sortBy("sortOrder")} className="inline-flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Orden</button></th>
                <th className="px-4 py-3"><button onClick={() => sortBy("isActive")} className="inline-flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Estado</button></th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((category) => (
                <tr key={category.id} className="border-t border-outline-variant">
                  <td className="px-4 py-3">{editingId === category.id ? <input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} className="h-9 rounded-xl border border-outline px-2 text-sm" /> : <span className="font-medium">{category.name}</span>}</td>
                  <td className="px-4 py-3">{editingId === category.id ? <input value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} className="h-9 w-full rounded-xl border border-outline px-2 text-sm" /> : <span className="text-on-surface-variant">{category.description ?? "-"}</span>}</td>
                  <td className="px-4 py-3">{editingId === category.id ? <input value={editForm.sortOrder} onChange={(event) => setEditForm((current) => ({ ...current, sortOrder: event.target.value }))} type="number" min="0" className="h-9 w-20 rounded-xl border border-outline px-2 text-sm" /> : category.sortOrder}</td>
                  <td className="px-4 py-3">{category.isActive ? "Activa" : "Inactiva"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {editingId === category.id ? (
                        <>
                          <button onClick={() => void saveEdit(category.id)} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-on-primary">Guardar</button>
                          <button onClick={() => setEditingId(null)} className="rounded-xl border border-outline px-3 py-2 text-xs font-semibold">Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(category)} className="rounded-xl border border-outline p-2" title="Editar"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => void setActive(category.id, !category.isActive)} className="rounded-xl border border-outline p-2" title={category.isActive ? "Desactivar" : "Activar"}>{category.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}</button>
                          <button onClick={() => void remove(category.id)} className="rounded-xl border border-red-200 p-2 text-red-700" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <DataState>No hay categorias.</DataState>
      )}
    </ProtectedPage>
  );
}
