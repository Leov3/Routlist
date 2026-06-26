"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, CheckCircle, Pencil, Plus, Search, Trash2, XCircle } from "lucide-react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import type { AudioCategory } from "@/types/routlis";

type SortKey = "name" | "sortOrder" | "isActive";
type StatusFilter = "all" | "active" | "inactive";
type CategoryFormState = {
  name: string;
  description: string;
  sortOrder: string;
};

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
  const [editForm, setEditForm] = useState<CategoryFormState>({ name: "", description: "", sortOrder: "0" });

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
    <AdminProtectedPage>
      <PageHeader title="Categorias" description="Agrupaciones visibles en la botonera." />
      <form onSubmit={create} className="mb-5 grid gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 sm:grid-cols-2 md:grid-cols-[1fr_1fr_120px_auto]">
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
        <>
          <div className="space-y-3 md:hidden">
            {filteredCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                editing={editingId === category.id}
                editForm={editForm}
                onStartEdit={() => startEdit(category)}
                onCancelEdit={() => setEditingId(null)}
                onSave={() => void saveEdit(category.id)}
                onToggleActive={() => void setActive(category.id, !category.isActive)}
                onDelete={() => void remove(category.id)}
                onEdit={(field, value) => setEditForm((current) => ({ ...current, [field]: value }))}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-outline-variant bg-surface-container md:block">
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
                          <button onClick={() => void remove(category.id)} className="danger-surface inline-flex items-center justify-center rounded-xl p-2" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : (
        <DataState>No hay categorias.</DataState>
      )}
    </AdminProtectedPage>
  );
}

function CategoryCard({
  category,
  editing,
  editForm,
  onStartEdit,
  onCancelEdit,
  onSave,
  onToggleActive,
  onDelete,
  onEdit,
}: {
  category: AudioCategory;
  editing: boolean;
  editForm: CategoryFormState;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onEdit: <K extends keyof CategoryFormState>(field: K, value: CategoryFormState[K]) => void;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-on-surface">{category.name}</p>
          <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">{category.description ?? "Sin descripción"}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${category.isActive ? "success-surface" : "bg-outline-variant/30 text-on-surface-variant"}`}>
          {category.isActive ? "Activa" : "Inactiva"}
        </span>
      </div>

      {editing ? (
        <div className="mt-4 grid gap-3">
          <input value={editForm.name} onChange={(event) => onEdit("name", event.target.value)} className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm" />
          <input value={editForm.description} onChange={(event) => onEdit("description", event.target.value)} className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm" />
          <input value={editForm.sortOrder} onChange={(event) => onEdit("sortOrder", event.target.value)} type="number" min="0" className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm" />
          <div className="grid gap-2">
            <button type="button" onClick={onSave} className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">Guardar</button>
            <button type="button" onClick={onCancelEdit} className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-outline-variant px-4 text-sm font-semibold text-on-surface">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-2 text-xs text-on-surface-variant">
          <div className="flex items-center justify-between gap-3">
            <span>Orden</span>
            <span className="font-medium text-on-surface">{category.sortOrder}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>ID</span>
            <span className="max-w-[180px] truncate font-medium text-on-surface">{category.id}</span>
          </div>
        </div>
      )}

      {!editing ? (
        <div className="mt-4 grid gap-2">
          <button type="button" onClick={onStartEdit} className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-outline-variant px-4 text-sm font-semibold text-on-surface">Editar</button>
          <button type="button" onClick={onToggleActive} className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-outline-variant px-4 text-sm font-semibold text-on-surface">{category.isActive ? "Desactivar" : "Activar"}</button>
          <button type="button" onClick={onDelete} className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-error/30 px-4 text-sm font-semibold text-error">Eliminar</button>
        </div>
      ) : null}
    </div>
  );
}
