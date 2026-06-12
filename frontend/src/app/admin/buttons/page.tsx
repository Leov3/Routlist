"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, CheckCircle, Copy, Pencil, Plus, Search, Trash2, XCircle } from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, apiUrl } from "@/lib/api";
import type { AudioAsset, AudioButton, AudioCategory } from "@/types/routlis";

type SortKey = "label" | "category" | "audio" | "sortOrder" | "isActive";
type StatusFilter = "all" | "active" | "inactive";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

type ButtonForm = {
  label: string;
  description: string;
  categoryId: string;
  audioAssetId: string;
  color: string;
  shortcutKey: string;
  sortOrder: string;
};

const emptyForm: ButtonForm = {
  label: "",
  description: "",
  categoryId: "",
  audioAssetId: "",
  color: "#047857",
  shortcutKey: "",
  sortOrder: "0",
};

export default function ButtonsPage() {
  const [buttons, setButtons] = useState<AudioButton[]>([]);
  const [categories, setCategories] = useState<AudioCategory[]>([]);
  const [audios, setAudios] = useState<AudioAsset[]>([]);
  const [form, setForm] = useState<ButtonForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ButtonForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("sortOrder");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function load() {
    const [buttonsResult, categoriesResult, audiosResult] = await Promise.allSettled([
      api<AudioButton[]>("/audio-buttons"),
      api<AudioCategory[]>("/audio-categories"),
      api<AudioAsset[]>("/audio-assets"),
    ]);

    if (buttonsResult.status === "fulfilled") {
      setButtons(buttonsResult.value);
    }

    if (categoriesResult.status === "fulfilled") {
      const activeCategories = categoriesResult.value.filter((category) => category.isActive);
      setCategories(activeCategories);
      setForm((current) => ({
        ...current,
        categoryId: current.categoryId || activeCategories[0]?.id || "",
      }));
    }

    if (audiosResult.status === "fulfilled") {
      const activeAudios = audiosResult.value.filter((audio) => audio.isActive);
      setAudios(activeAudios);
      setForm((current) => ({
        ...current,
        audioAssetId: current.audioAssetId || activeAudios[0]?.id || "",
      }));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredButtons = useMemo(() => {
    const term = search.trim().toLowerCase();

    return buttons
      .filter((button) => {
        const matchesSearch = `${button.label} ${button.description ?? ""} ${button.category.name} ${button.audioAsset.originalName}`.toLowerCase().includes(term);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && button.isActive) ||
          (statusFilter === "inactive" && !button.isActive);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const values: Record<SortKey, [string | number | boolean, string | number | boolean]> = {
          label: [a.label, b.label],
          category: [a.category.name, b.category.name],
          audio: [a.audioAsset.originalName, b.audioAsset.originalName],
          sortOrder: [a.sortOrder, b.sortOrder],
          isActive: [a.isActive, b.isActive],
        };
        const [left, right] = values[sortKey];
        const result =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right));

        return sortDirection === "asc" ? result : -result;
      });
  }, [buttons, search, sortDirection, sortKey, statusFilter]);

  function sortBy(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function validateImageSize(file: File | null) {
    if (!file) {
      return null;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return `La imagen "${file.name}" supera el límite de 5 MB.`;
    }

    return null;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const imageError = validateImageSize(imageFile);
    if (imageError) {
      setErrorMessage(imageError);
      return;
    }

    const payload = new FormData();
    payload.append("label", form.label);
    payload.append("description", form.description);
    payload.append("categoryId", form.categoryId);
    payload.append("audioAssetId", form.audioAssetId);
    payload.append("color", form.color);
    payload.append("shortcutKey", form.shortcutKey);
    payload.append("sortOrder", form.sortOrder || "0");
    if (imageFile) {
      payload.append("image", imageFile);
    }

    try {
      await api("/audio-buttons", {
        method: "POST",
        body: payload,
        formData: true,
      });
      setForm((current) => ({
        ...emptyForm,
        categoryId: current.categoryId,
        audioAssetId: current.audioAssetId,
      }));
      setImageFile(null);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear el botón.");
    }
  }

  function startEdit(button: AudioButton) {
    setEditingId(button.id);
    setEditForm({
      label: button.label,
      description: button.description ?? "",
      categoryId: button.category.id,
      audioAssetId: button.audioAsset.id,
      color: button.color ?? "#047857",
      shortcutKey: button.shortcutKey ?? "",
      sortOrder: String(button.sortOrder),
    });
    setEditImageFile(null);
  }

  async function saveEdit(id: string) {
    setErrorMessage(null);

    const imageError = validateImageSize(editImageFile);
    if (imageError) {
      setErrorMessage(imageError);
      return;
    }

    const payload = new FormData();
    payload.append("label", editForm.label);
    payload.append("description", editForm.description);
    payload.append("categoryId", editForm.categoryId);
    payload.append("audioAssetId", editForm.audioAssetId);
    payload.append("color", editForm.color);
    payload.append("shortcutKey", editForm.shortcutKey);
    payload.append("sortOrder", editForm.sortOrder || "0");
    if (editImageFile) {
      payload.append("image", editImageFile);
    }

    try {
      await api(`/audio-buttons/${id}`, {
        method: "PATCH",
        body: payload,
        formData: true,
      });
      setEditingId(null);
      setEditImageFile(null);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar el botón.");
    }
  }

  async function duplicate(id: string) {
    setErrorMessage(null);
    try {
      await api(`/audio-buttons/${id}/duplicate`, { method: "POST" });
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo duplicar el botón.");
    }
  }

  async function setActive(id: string, isActive: boolean) {
    setErrorMessage(null);
    try {
      await api(`/audio-buttons/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo actualizar el estado del botón.");
    }
  }

  async function remove(id: string) {
    setErrorMessage(null);
    try {
      await api(`/audio-buttons/${id}`, {
        method: "DELETE",
      });
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo eliminar el botón.");
    }
  }

  return (
    <ProtectedPage requiredPermissions={["button:create"]}>
      <PageHeader title="Botones" description="Accesos operativos asociados a audios." />
      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      <form onSubmit={create} className="mb-5 grid gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_110px_100px_220px_auto]">
        <input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Etiqueta" className="h-10 w-full min-w-0 rounded-xl border border-outline px-3 text-sm" required />
        <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Texto del botón" className="h-10 w-full min-w-0 rounded-xl border border-outline px-3 text-sm" />
        <select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))} className="h-10 w-full min-w-0 rounded-xl border border-outline px-3 text-sm" required>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <select value={form.audioAssetId} onChange={(event) => setForm((current) => ({ ...current, audioAssetId: event.target.value }))} className="h-10 w-full min-w-0 rounded-xl border border-outline px-3 text-sm" required>{audios.map((audio) => <option key={audio.id} value={audio.id}>{audio.originalName}</option>)}</select>
        <input value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} type="color" className="h-10 w-full min-w-0 rounded-xl border border-outline px-2" />
        <input value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} type="number" min="0" className="h-10 w-full min-w-0 rounded-xl border border-outline px-3 text-sm" />
        <label className="flex h-10 min-w-0 cursor-pointer items-center justify-center rounded-xl border border-dashed border-outline px-3 text-sm text-on-surface-variant">
          <input type="file" accept="image/*" className="sr-only" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />
          <span className="truncate">{imageFile ? imageFile.name : "Subir imagen"}</span>
        </label>
        <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary"><Plus className="h-4 w-4" />Crear</button>
      </form>

      <div className="mb-3 grid gap-2 rounded-xl border border-outline-variant bg-surface-container p-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar botones" className="h-10 w-full min-w-0 rounded-xl border border-outline pl-10 pr-3 text-sm" />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-10 w-full min-w-0 rounded-xl border border-outline px-3 text-sm">
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {filteredButtons.length ? (
        <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container">
          <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
            <thead className="bg-surface-container-high text-xs uppercase text-on-surface-variant">
              <tr>
                <th className="w-[18%] px-4 py-3"><button type="button" onClick={() => sortBy("label")} className="inline-flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Boton</button></th>
                <th className="w-[15%] px-4 py-3"><button type="button" onClick={() => sortBy("category")} className="inline-flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Categoria</button></th>
                <th className="w-[20%] px-4 py-3">Texto</th>
                <th className="w-[12%] px-4 py-3">Imagen</th>
                <th className="w-[18%] px-4 py-3"><button type="button" onClick={() => sortBy("audio")} className="inline-flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Audio</button></th>
                <th className="w-[7%] px-4 py-3">Color</th>
                <th className="w-[7%] px-4 py-3">Shortcut</th>
                <th className="w-[7%] px-4 py-3"><button type="button" onClick={() => sortBy("sortOrder")} className="inline-flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Orden</button></th>
                <th className="w-[8%] px-4 py-3"><button type="button" onClick={() => sortBy("isActive")} className="inline-flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Estado</button></th>
                <th className="w-[15%] px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredButtons.map((button) => (
                <tr key={button.id} className="border-t border-outline-variant">
                  <td className="px-4 py-3 align-top">{editingId === button.id ? <input value={editForm.label} onChange={(event) => setEditForm((current) => ({ ...current, label: event.target.value }))} className="h-9 w-full min-w-0 rounded-xl border border-outline px-2 text-sm" /> : <span className="block truncate font-medium" title={button.label}>{button.label}</span>}</td>
                  <td className="px-4 py-3 align-top">{editingId === button.id ? <select value={editForm.categoryId} onChange={(event) => setEditForm((current) => ({ ...current, categoryId: event.target.value }))} className="h-9 w-full min-w-0 rounded-xl border border-outline px-2 text-sm">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select> : <span className="block truncate" title={button.category.name}>{button.category.name}</span>}</td>
                  <td className="px-4 py-3 align-top">{editingId === button.id ? <input value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} className="h-9 w-full min-w-0 rounded-xl border border-outline px-2 text-sm" placeholder="Texto del botón" /> : <span className="block max-w-full truncate text-on-surface-variant" title={button.description ?? "-"}>{button.description ?? "-"}</span>}</td>
                  <td className="px-4 py-3 align-top">
                    {editingId === button.id ? (
                      <label className="flex h-9 min-w-0 cursor-pointer items-center justify-center rounded-xl border border-dashed border-outline px-2 text-xs text-on-surface-variant">
                        <input type="file" accept="image/*" className="sr-only" onChange={(event) => setEditImageFile(event.target.files?.[0] ?? null)} />
                        <span className="truncate">{editImageFile ? editImageFile.name : "Cambiar imagen"}</span>
                      </label>
                    ) : button.imageUrl ? (
                      <div className="flex min-w-0 items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={apiUrl(button.imageUrl)} alt={button.label} className="h-10 w-10 rounded-xl object-cover" />
                        <span className="min-w-0 truncate text-xs text-on-surface-variant">Disponible</span>
                      </div>
                    ) : (
                      <span className="text-xs text-on-surface-variant">Sin imagen</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">{editingId === button.id ? <select value={editForm.audioAssetId} onChange={(event) => setEditForm((current) => ({ ...current, audioAssetId: event.target.value }))} className="h-9 w-full min-w-0 rounded-xl border border-outline px-2 text-sm">{audios.map((audio) => <option key={audio.id} value={audio.id}>{audio.originalName}</option>)}</select> : <span className="block truncate text-on-surface-variant" title={button.audioAsset.originalName}>{button.audioAsset.originalName}</span>}</td>
                  <td className="px-4 py-3 align-top">{editingId === button.id ? <input value={editForm.color} onChange={(event) => setEditForm((current) => ({ ...current, color: event.target.value }))} type="color" className="h-9 w-full min-w-0 rounded-xl border border-outline px-1" /> : <span className="inline-flex h-5 w-5 rounded" style={{ backgroundColor: button.color ?? "#047857" }} />}</td>
                  <td className="px-4 py-3 align-top">{editingId === button.id ? <input value={editForm.shortcutKey} onChange={(event) => setEditForm((current) => ({ ...current, shortcutKey: event.target.value }))} className="h-9 w-full min-w-0 rounded-xl border border-outline px-2 text-sm" /> : <span className="block truncate">{button.shortcutKey ?? "-"}</span>}</td>
                  <td className="px-4 py-3 align-top">{editingId === button.id ? <input value={editForm.sortOrder} onChange={(event) => setEditForm((current) => ({ ...current, sortOrder: event.target.value }))} type="number" min="0" className="h-9 w-full min-w-0 rounded-xl border border-outline px-2 text-sm" /> : button.sortOrder}</td>
                  <td className="px-4 py-3 align-top">{button.isActive ? "Activo" : "Inactivo"}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap justify-end gap-2">
                      {editingId === button.id ? (
                        <>
                          <button type="button" onClick={() => void saveEdit(button.id)} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-on-primary">Guardar</button>
                          <button type="button" onClick={() => setEditingId(null)} className="rounded-xl border border-outline px-3 py-2 text-xs font-semibold">Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEdit(button)} className="rounded-xl border border-outline p-2" title="Editar"><Pencil className="h-4 w-4" /></button>
                          <button type="button" onClick={() => void duplicate(button.id)} className="rounded-xl border border-outline p-2" title="Duplicar"><Copy className="h-4 w-4" /></button>
                          <button type="button" onClick={() => void setActive(button.id, !button.isActive)} className="rounded-xl border border-outline p-2" title={button.isActive ? "Desactivar" : "Activar"}>{button.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}</button>
                          <button type="button" onClick={() => void remove(button.id)} className="rounded-xl border border-red-200 p-2 text-red-700" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
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
        <DataState>No hay botones.</DataState>
      )}
    </ProtectedPage>
  );
}
