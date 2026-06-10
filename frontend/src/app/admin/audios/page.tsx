"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle, Music, Pencil, Trash2, Upload, XCircle } from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterBar } from "@/components/ui/FilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, formatBytes } from "@/lib/api";
import type { AudioAsset } from "@/types/routlis";

type SortKey = "originalName" | "mimeType" | "sizeBytes" | "isActive";
type StatusFilter = "all" | "active" | "inactive";

const STATUS_OPTIONS = [
  { value: "all" as const, label: "Todos" },
  { value: "active" as const, label: "Activos" },
  { value: "inactive" as const, label: "Inactivos" },
];

export default function AudiosPage() {
  const [audios, setAudios] = useState<AudioAsset[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("originalName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ originalName: "", durationSeconds: "", transcript: "" });

  async function load() {
    try { setAudios(await api<AudioAsset[]>("/audio-assets")); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return audios
      .filter((a) => {
        const matchSearch = `${a.originalName} ${a.mimeType}`.toLowerCase().includes(term);
        const matchStatus = statusFilter === "all" || (statusFilter === "active" ? a.isActive : !a.isActive);
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        const l = a[sortKey]; const r = b[sortKey];
        const res = typeof l === "number" && typeof r === "number" ? l - r : String(l).localeCompare(String(r));
        return sortDir === "asc" ? res : -res;
      });
  }, [audios, search, sortDir, sortKey, statusFilter]);

  function sortBy(key: SortKey) {
    if (sortKey === key) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); return; }
    setSortKey(key); setSortDir("asc");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length) return;
    setUploading(true);
    try {
      if (files.length === 1) {
        const fd = new FormData();
        fd.append("file", files[0]);
        await api("/audio-assets", { method: "POST", body: fd, formData: true });
      } else {
        const fd = new FormData();
        fd.append("action", "IMPORT");
        files.forEach((file) => fd.append("files", file));
        await api("/audio-assets/bulk", { method: "POST", body: fd, formData: true });
      }
      setFiles([]);
      await load();
    } finally { setUploading(false); }
  }

  function startEdit(a: AudioAsset) {
    setEditingId(a.id);
    setEditForm({ originalName: a.originalName, durationSeconds: a.durationSeconds?.toString() ?? "", transcript: a.transcript ?? "" });
  }

  async function saveEdit(id: string) {
    await api(`/audio-assets/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ originalName: editForm.originalName, durationSeconds: editForm.durationSeconds ? Number(editForm.durationSeconds) : null, transcript: editForm.transcript || null }),
    });
    setEditingId(null); await load();
  }

  async function setActive(id: string, isActive: boolean) {
    await api(`/audio-assets/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) });
    await load();
  }

  async function remove(id: string) {
    await api(`/audio-assets/${id}`, { method: "DELETE" });
    await load();
  }

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button type="button" onClick={() => sortBy(k)} className="inline-flex items-center gap-1 transition-colors hover:text-primary">
      {label} <span className="opacity-50">{sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );

  return (
    <ProtectedPage requiredPermissions={["audio:create"]}>
      <PageHeader title="Audios" description="Biblioteca de archivos MP3 y WAV." />

      {/* Upload panel */}
      <form onSubmit={upload} className="mb-6 flex items-center gap-4 rounded-2xl border border-outline-variant bg-surface-container p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Upload className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-on-surface">Archivo</p>
          <p className="text-xs text-on-surface-variant">
            {files.length === 0
              ? "Sin archivos seleccionados"
              : files.length === 1
                ? files[0].name
                : `${files.length} archivos seleccionados`}
          </p>
        </div>
        <label className="cursor-pointer rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2 text-sm text-on-surface transition-all hover:border-primary hover:text-primary">
          Seleccionar
          <input
            type="file"
            multiple
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="sr-only"
          />
        </label>
        <button
          type="submit"
          disabled={!files.length || uploading}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary shadow-elevation-1 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Subiendo..." : files.length > 1 ? "Importar lote" : "Subir"}
        </button>
      </form>

      {/* Filters row */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar value={search} onChange={setSearch} placeholder="Filtrar por nombre o tipo..." />
        <FilterBar value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
      </div>

      {/* Table */}
      {loading ? (
        <DataState>Cargando audios...</DataState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-outline-variant">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-high">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant"><SortBtn k="originalName" label="Nombre" /></th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant"><SortBtn k="mimeType" label="Tipo" /></th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant"><SortBtn k="sizeBytes" label="Tamaño" /></th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Duración</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant"><SortBtn k="isActive" label="Estado" /></th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-on-surface-variant">Sin resultados.</td>
                </tr>
              ) : (
                filtered.map((audio) => (
                  <tr key={audio.id} className="border-b border-outline-variant/40 bg-surface-container transition-colors last:border-0 hover:bg-surface-container-high">
                    {/* Name */}
                    <td className="px-4 py-3.5">
                      {editingId === audio.id ? (
                        <div className="grid gap-2">
                          <input value={editForm.originalName} onChange={(e) => setEditForm((f) => ({ ...f, originalName: e.target.value }))}
                            className="h-8 rounded-lg border border-outline bg-surface-container-highest px-2 text-sm text-on-surface focus:border-primary focus:outline-none" />
                          <textarea value={editForm.transcript} onChange={(e) => setEditForm((f) => ({ ...f, transcript: e.target.value }))} placeholder="Transcripción"
                            className="min-h-14 rounded-lg border border-outline bg-surface-container-highest px-2 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Music className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-on-surface">{audio.originalName}</span>
                        </div>
                      )}
                    </td>
                    {/* Type */}
                    <td className="px-4 py-3.5 text-on-surface-variant">{audio.mimeType}</td>
                    {/* Size */}
                    <td className="px-4 py-3.5 text-on-surface-variant">{formatBytes(audio.sizeBytes)}</td>
                    {/* Duration */}
                    <td className="px-4 py-3.5">
                      {editingId === audio.id ? (
                        <input value={editForm.durationSeconds} onChange={(e) => setEditForm((f) => ({ ...f, durationSeconds: e.target.value }))}
                          type="number" min="0"
                          className="h-8 w-24 rounded-lg border border-outline bg-surface-container-highest px-2 text-sm text-on-surface focus:border-primary focus:outline-none" />
                      ) : (
                        <span className="text-on-surface-variant">{audio.durationSeconds ? `${audio.durationSeconds}s` : "–"}</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3.5"><StatusBadge active={audio.isActive} /></td>
                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-2">
                        {editingId === audio.id ? (
                          <>
                            <button onClick={() => void saveEdit(audio.id)}
                              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90">Guardar</button>
                            <button onClick={() => setEditingId(null)}
                              className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-high">Cancelar</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(audio)} title="Editar"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition-all hover:border-primary hover:text-primary">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => void setActive(audio.id, !audio.isActive)} title={audio.isActive ? "Desactivar" : "Activar"}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition-all hover:border-primary hover:text-primary">
                              {audio.isActive ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => void remove(audio.id)} title="Eliminar"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-error/30 text-error transition-all hover:bg-error-container/20">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </ProtectedPage>
  );
}
