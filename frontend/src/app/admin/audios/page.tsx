"use client";

import { FormEvent, type DragEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle, Music, Pencil, Trash2, Upload, XCircle } from "lucide-react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterBar } from "@/components/ui/FilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, formatBytes } from "@/lib/api";
import { AudioCsvImportModal } from "@/components/audio-board/AudioCsvImportModal";
import { AudioManualCreationModal } from "@/components/audio-board/AudioManualCreationModal";
import type { AudioAsset, AudioCategory } from "@/types/routlis";

type SortKey = "originalName" | "mimeType" | "sizeBytes" | "isActive";
type StatusFilter = "all" | "active" | "inactive";
type LifecycleFilter = "all" | "temporary" | "permanent";

function SortBtn({
  sortKey,
  sortDir,
  onSort,
  k,
  label,
}: {
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  k: SortKey;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      className="inline-flex items-center gap-1 transition-colors hover:text-primary"
    >
      {label}{" "}
      <span className="opacity-50">
        {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

const STATUS_OPTIONS = [
  { value: "all" as const, label: "Todos" },
  { value: "active" as const, label: "Activos" },
  { value: "inactive" as const, label: "Inactivos" },
];

const LIFECYCLE_OPTIONS = [
  { value: "all" as const, label: "Todos" },
  { value: "temporary" as const, label: "Temporales" },
  { value: "permanent" as const, label: "Permanentes" },
];

export default function AudiosPage() {
  const [audios, setAudios] = useState<AudioAsset[]>([]);
  const [categories, setCategories] = useState<AudioCategory[]>([]);
  const [importMode, setImportMode] = useState<"manual" | "csv">("manual");
  const [files, setFiles] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvAudioFiles, setCsvAudioFiles] = useState<CsvAudioSelection[]>([]);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [csvQueue, setCsvQueue] = useState<CsvImportQueueItem[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("originalName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ originalName: "", durationSeconds: "", transcript: "" });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAssets, setManualAssets] = useState<AudioAsset[]>([]);
  const [csvOpen, setCsvOpen] = useState(false);

  async function load() {
    try { setAudios(await api<AudioAsset[]>("/audio-assets")); }
    finally { setLoading(false); }
  }

  async function loadCategories() {
    try {
      setCategories(await api<AudioCategory[]>("/audio-categories"));
    } catch {
      setCategories([]);
    }
  }

  function downloadCsvTemplate() {
    const template = [
      "file_name,path,text,label,button_title,description,tag",
      "audio-ejemplo.mp3,carpeta/audio-ejemplo.mp3,\"Texto completo del audio\",\"Etiqueta visible\",\"Título del botón\",\"Descripción corta\",\"tag-1\"",
    ].join("\n");

    const blob = new Blob([template], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-audios-routlis.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    void load();
    void loadCategories();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function buildPreview() {
      if (!csvFile) {
        setCsvPreview(null);
        return;
      }

      try {
        const csvText = await csvFile.text();
        const { preview, queue } = buildCsvImportQueue(csvText, csvAudioFiles);

        if (!cancelled) {
          setCsvPreview(preview);
          setCsvQueue(queue);
        }
      } catch {
        if (!cancelled) {
          setCsvPreview({
            totalRows: 0,
            matchedCount: 0,
            missingCount: 0,
            duplicates: [],
            rows: [],
            error: "No se pudo leer el CSV.",
          });
          setCsvQueue([]);
        }
      }
    }

    void buildPreview();

    return () => {
      cancelled = true;
    };
  }, [csvAudioFiles, csvFile]);

  useEffect(() => {
    return () => {
      csvAudioFiles.forEach((selection) => URL.revokeObjectURL(selection.previewUrl));
    };
  }, [csvAudioFiles]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return audios
      .filter((a) => {
        const matchSearch = `${a.originalName} ${a.mimeType}`.toLowerCase().includes(term);
        const matchStatus = statusFilter === "all" || (statusFilter === "active" ? a.isActive : !a.isActive);
        const isTemporary = a.lifecycleStatus === "TEMPORARY" || Boolean(a.expiresAt);
        const matchLifecycle =
          lifecycleFilter === "all" ||
          (lifecycleFilter === "temporary" ? isTemporary : !isTemporary);
        return matchSearch && matchStatus && matchLifecycle;
      })
      .sort((a, b) => {
        const l = a[sortKey]; const r = b[sortKey];
        const res = typeof l === "number" && typeof r === "number" ? l - r : String(l).localeCompare(String(r));
        return sortDir === "asc" ? res : -res;
      });
  }, [audios, lifecycleFilter, search, sortDir, sortKey, statusFilter]);

  function sortBy(key: SortKey) {
    if (sortKey === key) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); return; }
    setSortKey(key); setSortDir("asc");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length) return;
    setUploading(true);
    try {
      let createdAssets: AudioAsset[] = [];
      if (files.length === 1) {
        const fd = new FormData();
        fd.append("file", files[0]);
        const created = await api<AudioAsset>("/audio-assets", { method: "POST", body: fd, formData: true });
        createdAssets = [created];
      } else {
        const fd = new FormData();
        fd.append("action", "IMPORT");
        files.forEach((file) => fd.append("files", file));
        const created = await api<{ assets?: AudioAsset[] }>("/audio-assets/bulk", { method: "POST", body: fd, formData: true });
        createdAssets = created.assets ?? [];
      }
      setFiles([]);
      if (createdAssets.length > 0) {
        setManualAssets(createdAssets);
        setManualOpen(true);
      }
      await load();
    } finally { setUploading(false); }
  }

  async function importCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csvFile || !csvAudioFiles.length) return;

    setCsvImporting(true);
    try {
      const csvText = await csvFile.text();
      const { preview, queue } = buildCsvImportQueue(csvText, csvAudioFiles);
      setCsvPreview(preview);
      setCsvQueue(queue);
      setCsvOpen(true);
    } finally {
      setCsvImporting(false);
    }
  }

  async function confirmCsvImport() {
    if (!csvFile || !csvAudioFiles.length) {
      return {
        createdCount: 0,
        skippedCount: csvQueue.length,
        duplicates: [],
        unmatchedFiles: [],
        rows: csvQueue,
        assets: [],
        queue: csvQueue,
      };
    }

    const fd = new FormData();
    fd.append("csv", csvFile);
    fd.append("paths", JSON.stringify(csvAudioFiles.map((selection) => selection.path ?? selection.file.name)));
    csvAudioFiles.forEach((selection) => fd.append("files", selection.file));

    const result = await api<CsvImportResult>("/audio-assets/import-csv", {
      method: "POST",
      body: fd,
      formData: true,
    });

    setCsvQueue(mergeCsvQueueItems(csvQueue, result.queue));
    setCsvFile(null);
    setCsvAudioFiles([]);
    setCsvPreview(null);
    await load();
    return result;
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
    await api(`/audio-assets/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
    await load();
  }

  async function remove(id: string) {
    await api(`/audio-assets/${id}`, {
      method: "DELETE",
    });
    await load();
  }

  return (
    <AdminProtectedPage>
      <PageHeader title="Audios" description="Biblioteca de archivos MP3 y WAV." />

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-outline-variant bg-surface-container p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-on-surface">Modo de carga</p>
          <p className="text-xs text-on-surface-variant">
            Alterna entre subida manual e importación por CSV.
          </p>
        </div>
        <div className="inline-flex rounded-2xl border border-outline-variant bg-surface-container-high p-1">
          <button
            type="button"
            onClick={() => setImportMode("manual")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              importMode === "manual"
                ? "bg-primary text-on-primary shadow-elevation-1"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Carga manual
          </button>
          <button
            type="button"
            onClick={() => setImportMode("csv")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              importMode === "csv"
                ? "bg-primary text-on-primary shadow-elevation-1"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Importación CSV
          </button>
        </div>
      </div>

      {importMode === "csv" ? (
      <section className="mb-6 rounded-3xl border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
        <div className="mb-5 flex flex-col gap-3 border-b border-outline-variant/60 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-on-surface-variant">Importación por CSV</p>
            <h2 className="mt-1 text-xl font-semibold text-on-surface">Carga audios en lote con texto, título y etiquetas</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Selecciona el CSV. Los archivos de audio se emparejan por <code className="rounded bg-surface-container-high px-1 py-0.5">path</code> + <code className="rounded bg-surface-container-high px-1 py-0.5">file_name</code> o por nombre exacto.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadCsvTemplate}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-all hover:border-primary hover:text-primary"
          >
            Descargar plantilla CSV
          </button>
        </div>

        <form onSubmit={importCsv} className="grid gap-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr_auto]">
            <FilePickerCard
              label="CSV"
              description="Selecciona el CSV"
              helper={csvFile ? csvFile.name : "Sin CSV seleccionado"}
              actionLabel="Elegir CSV"
              accept=".csv,text/csv"
              onChangeFile={setCsvFile}
            />
            <FilePickerCard
              label="Audios"
              description="Carga uno o varios audios."
              helper={
                csvAudioFiles.length === 0
                  ? "Sin archivos seleccionados"
                  : csvAudioFiles.length === 1
                    ? csvAudioFiles[0].file.name
                    : `${csvAudioFiles.length} archivos seleccionados`
              }
              actionLabel="Elegir carpeta o archivos"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav"
              multiple
              directory
              onChangeFiles={(files) =>
                setCsvAudioFiles(
                  files.map((file) => ({
                    file,
                    path: getRelativeCsvPath(file),
                    previewUrl: URL.createObjectURL(file),
                  })),
                )
              }
            />
            <div className="flex items-end">
              <button
                type="submit"
                disabled={!csvFile || !csvAudioFiles.length || csvImporting}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-on-primary shadow-elevation-1 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {csvImporting ? "Revisando..." : "Revisar importación"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <StatBox label="Filas detectadas" value={String(csvPreview?.totalRows ?? 0)} />
            <StatBox label="Coincidencias" value={String(csvPreview?.matchedCount ?? 0)} />
            <StatBox label="Pendientes" value={String(csvPreview?.missingCount ?? 0)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
            <div className="rounded-2xl border border-outline-variant bg-surface-container-high p-4">
              <p className="text-sm font-semibold text-on-surface">Estado de la importación</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <SummaryPill label="CSV" value={csvFile ? "Listo" : "Pendiente"} tone={csvFile ? "success" : "muted"} />
                <SummaryPill label="Audios" value={csvAudioFiles.length ? `${csvAudioFiles.length}` : "Pendiente"} tone={csvAudioFiles.length ? "success" : "muted"} />
                <SummaryPill label="Importar" value={csvPreview?.error ? "Revisar" : "Listo"} tone={csvPreview?.error ? "warning" : "muted"} />
              </div>

              {csvPreview?.error ? <p className="mt-4 text-sm text-error">{csvPreview.error}</p> : null}
              {csvPreview?.duplicates?.length ? (
                <p className="mt-4 text-sm text-amber-400">Duplicados detectados: {csvPreview.duplicates.join(", ")}</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-outline-variant bg-surface-container-high p-4">
              <p className="text-sm font-semibold text-on-surface">Vista previa</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Revisa todas las filas detectadas antes de abrir el asistente.
              </p>
            </div>
          </div>

          {csvPreview?.rows?.length ? (
            <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-high">
              <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Preview del CSV</p>
                  <p className="text-xs text-on-surface-variant">Archivo, texto, etiqueta y estado de match.</p>
                </div>
                <p className="text-xs text-on-surface-variant">{csvPreview.rows.length} filas</p>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-surface-container text-xs uppercase text-on-surface-variant">
                    <tr>
                      <th className="px-4 py-3">Archivo</th>
                      <th className="px-4 py-3">Título</th>
                      <th className="px-4 py-3">Etiqueta</th>
                      <th className="px-4 py-3">Texto</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.rows.map((row) => (
                      <tr key={`${row.rowNumber}-${row.fileName}`} className="border-t border-outline-variant/60">
                        <td className="px-4 py-3 font-medium text-on-surface">{row.fileName}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{row.buttonTitle || row.text || row.label || "—"}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{row.tag || "—"}</td>
                        <td className="px-4 py-3">
                          <p className="max-w-[420px] truncate text-on-surface-variant" title={row.text}>{row.text}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={row.status === "MATCHED" ? "text-emerald-400" : "text-amber-400"}>
                            {row.status === "MATCHED" ? `OK (${row.matchedFileName})` : "Pendiente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </form>
      </section>
      ) : null}

      {importMode === "manual" ? (
      <form onSubmit={upload} className="mb-6 rounded-2xl border border-outline-variant bg-surface-container p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-on-surface">Subida manual</p>
              <p className="text-xs text-on-surface-variant">Importa uno o varios audios sin CSV.</p>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant">
            {files.length === 0
              ? "Sin archivos seleccionados"
              : files.length === 1
                ? files[0].name
                : `${files.length} archivos seleccionados`}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-outline-variant bg-surface-container-high px-4 text-sm text-on-surface transition-all hover:border-primary hover:text-primary">
            Seleccionar archivos
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
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary shadow-elevation-1 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Subiendo..." : files.length > 1 ? "Importar lote" : "Subir"}
          </button>
        </div>
      </form>
      ) : null}

      {/* Filters row */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar value={search} onChange={setSearch} placeholder="Filtrar por nombre o tipo..." />
        <FilterBar value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
        <FilterBar value={lifecycleFilter} onChange={setLifecycleFilter} options={LIFECYCLE_OPTIONS} />
      </div>

      {/* Table */}
      {loading ? (
        <DataState>Cargando audios...</DataState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-outline-variant">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-high">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant"><SortBtn sortKey={sortKey} sortDir={sortDir} onSort={sortBy} k="originalName" label="Nombre" /></th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant"><SortBtn sortKey={sortKey} sortDir={sortDir} onSort={sortBy} k="mimeType" label="Tipo" /></th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant"><SortBtn sortKey={sortKey} sortDir={sortDir} onSort={sortBy} k="sizeBytes" label="Tamaño" /></th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Duración</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Lifecycle</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant"><SortBtn sortKey={sortKey} sortDir={sortDir} onSort={sortBy} k="isActive" label="Estado" /></th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-on-surface-variant">Sin resultados.</td>
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
                    {/* Lifecycle */}
                    <td className="px-4 py-3.5">
                      <div className="grid gap-1">
                        <span className="text-on-surface-variant">
                          {isTemporaryAudio(audio) ? "Temporal" : "Permanente"}
                        </span>
                        {isTemporaryAudio(audio) ? (
                          <span className="text-xs text-on-surface-variant">
                            {getRemainingTimeLabel(audio.expiresAt)}
                          </span>
                        ) : null}
                      </div>
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

      <AudioCsvImportModal
        open={csvOpen}
        preview={csvPreview}
        queue={csvQueue}
        busy={csvImporting}
        onConfirmImport={async () => {
          const result = await confirmCsvImport();
          setManualAssets(result.assets ?? []);
          setManualOpen((result.assets ?? []).length > 0);
          setCsvOpen(false);
          return result;
        }}
        onClose={() => setCsvOpen(false)}
      />

      <AudioManualCreationModal
        open={manualOpen}
        assets={manualAssets}
        categories={categories}
        onClose={() => setManualOpen(false)}
        onFinished={() => {
          setManualOpen(false);
          setManualAssets([]);
          void load();
        }}
      />
    </AdminProtectedPage>
  );
}

function isTemporaryAudio(audio: AudioAsset) {
  return audio.lifecycleStatus === "TEMPORARY" || Boolean(audio.expiresAt);
}

function getRemainingTimeLabel(expiresAt?: string | null) {
  if (!expiresAt) return "Sin vencimiento";

  const expiresAtDate = new Date(expiresAt);
  const diffMs = expiresAtDate.getTime() - Date.now();

  if (Number.isNaN(expiresAtDate.getTime())) return "Vencimiento inválido";
  if (diffMs <= 0) return "Vencido";

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [
    days > 0 ? `${days}d` : null,
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
  ].filter(Boolean);

  return `Le quedan ${parts.length ? parts.join(" ") : "menos de 1m"}`;
}

type CsvPreviewRow = {
  rowNumber: number;
  fileName: string;
  path: string | null;
  text: string;
  label: string | null;
  buttonTitle: string | null;
  description: string | null;
  tag: string | null;
  matchedFileName: string | null;
  status: "MATCHED" | "MISSING_FILE" | "DUPLICATE" | "CREATE_FAILED";
};

type CsvPreview = {
  totalRows: number;
  matchedCount: number;
  missingCount: number;
  duplicates: string[];
  rows: CsvPreviewRow[];
  error?: string;
};

type CsvImportQueueItem = {
  id: string;
  rowNumber: number;
  originalName: string;
  fileName: string;
  path: string | null;
  text: string;
  mimeType: string | null;
  sizeBytes: number | null;
  audioBlobUrl?: string | null;
  transcript: string;
  label: string | null;
  buttonTitle: string | null;
  description: string | null;
  tag: string | null;
  status: "MATCHED" | "MISSING_FILE" | "DUPLICATE" | "CREATE_FAILED";
  matchedFileName: string | null;
  assetId: string | null;
  errorMessage: string | null;
};

type CsvImportResult = {
  createdCount: number;
  skippedCount: number;
  duplicates: string[];
  unmatchedFiles: string[];
  rows: CsvImportQueueItem[];
  assets: AudioAsset[];
  queue: CsvImportQueueItem[];
};

function mergeCsvQueueItems(
  currentQueue: CsvImportQueueItem[],
  nextQueue: CsvImportQueueItem[] | undefined,
) {
  if (!nextQueue?.length) {
    return currentQueue;
  }
  if (!currentQueue.length) {
    return nextQueue;
  }

  const nextByRow = new Map(nextQueue.map((item) => [item.rowNumber, item]));
  return currentQueue.map((item) => ({
    ...item,
    ...Object.fromEntries(
      Object.entries(nextByRow.get(item.rowNumber) ?? {}).filter(([, value]) => value !== null && value !== undefined),
    ),
  }));
}

function buildCsvImportQueue(csvText: string, audioFiles: CsvAudioSelection[]) {
  const rows = parseCsvRows(csvText);
  const fileIndex = new Map<string, CsvAudioSelection>();
  const duplicates: string[] = [];

  for (const selection of audioFiles) {
    const keys = getCsvSelectionKeys(selection);
    const primaryKey = getCsvSelectionPrimaryKey(selection);
    if (fileIndex.has(primaryKey)) {
      duplicates.push(selection.file.name);
      continue;
    }
    for (const key of keys) {
      if (!fileIndex.has(key)) {
        fileIndex.set(key, selection);
      }
    }
  }

  const previewRows = rows.map((row) => {
    const matched = resolvePreviewFile(fileIndex, row);
    return {
      ...row,
      matchedFileName: matched?.file.name ?? null,
      status: matched ? "MATCHED" : "MISSING_FILE",
    } as CsvPreviewRow;
  });

  const queue = previewRows.map((row) => {
    const matched = resolvePreviewFile(fileIndex, row);
    return {
      id: `csv-row-${row.rowNumber}`,
      rowNumber: row.rowNumber,
      originalName: row.text?.trim() || row.fileName,
      fileName: row.fileName,
      path: row.path,
      text: row.text,
      mimeType: matched?.file.type || null,
      sizeBytes: typeof matched?.file.size === "number" ? matched.file.size : null,
      audioBlobUrl: matched?.previewUrl ?? null,
      transcript: row.text,
      label: row.label,
      buttonTitle: row.buttonTitle,
      description: row.description,
      tag: row.tag,
      status: row.status,
      matchedFileName: row.matchedFileName,
      assetId: null,
      errorMessage: row.status === "MISSING_FILE" ? "No se encontró un archivo para esta fila." : null,
    } satisfies CsvImportQueueItem;
  });

  return {
    preview: {
      totalRows: previewRows.length,
      matchedCount: previewRows.filter((row) => row.status === "MATCHED").length,
      missingCount: previewRows.filter((row) => row.status !== "MATCHED").length,
      duplicates,
      rows: previewRows,
    } satisfies CsvPreview,
    queue,
  };
}

function parseCsvRows(csvText: string) {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const indexOf = (name: string) => headers.findIndex((header) => header === name.toLowerCase());
  const fileNameIndex = indexOf("file_name");
  const textIndex = indexOf("text");
  if (fileNameIndex === -1 || textIndex === -1) return [];

  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const get = (index: number) => (index >= 0 ? values[index]?.trim() ?? "" : "");

    return {
      rowNumber: rowIndex + 2,
      fileName: get(fileNameIndex),
      path: indexOf("path") >= 0 ? get(indexOf("path")) || null : null,
      text: get(textIndex),
      label: indexOf("label") >= 0 ? get(indexOf("label")) || null : null,
      buttonTitle: indexOf("button_title") >= 0 ? get(indexOf("button_title")) || null : null,
      description: indexOf("description") >= 0 ? get(indexOf("description")) || null : null,
      tag: indexOf("tag") >= 0 ? get(indexOf("tag")) || null : null,
    } satisfies Omit<CsvPreviewRow, "matchedFileName" | "status">;
  });
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells;
}

function fileMatchKey(value: string) {
  return value.trim().toLowerCase();
}

function resolvePreviewFile(fileIndex: Map<string, CsvAudioSelection>, row: { fileName: string; path: string | null }) {
  if (row.path) {
    const pathKey = fileMatchKey(`${row.path}/${row.fileName}`);
    const byPath = fileIndex.get(pathKey);
    if (byPath) return byPath;
  }

  return fileIndex.get(fileMatchKey(row.fileName)) ?? null;
}

type CsvAudioSelection = {
  file: File;
  path: string | null;
  previewUrl: string;
};

function getCsvSelectionKeys(selection: CsvAudioSelection) {
  const keys = new Set<string>();
  const relativePath = getRelativeCsvPath(selection.file);
  if (relativePath) {
    keys.add(fileMatchKey(relativePath));
    const fileName = relativePath.split("/").pop();
    if (fileName) {
      keys.add(fileMatchKey(fileName));
    }
  }

  if (selection.path) {
    keys.add(fileMatchKey(selection.path));
    keys.add(fileMatchKey(`${selection.path}/${selection.file.name}`));
  }

  keys.add(fileMatchKey(selection.file.name));

  return Array.from(keys);
}

function getCsvSelectionPrimaryKey(selection: CsvAudioSelection) {
  const relativePath = getRelativeCsvPath(selection.file);
  if (relativePath) {
    return fileMatchKey(relativePath);
  }

  if (selection.path) {
    return fileMatchKey(`${selection.path}/${selection.file.name}`);
  }

  return fileMatchKey(selection.file.name);
}

function getRelativeCsvPath(file: File) {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
  if (!relativePath) return null;
  const trimmed = relativePath.trim();
  if (!trimmed) return null;
  return trimmed;
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="mt-1 text-xl font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "muted";
}) {
  const toneClasses = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    muted: "border-outline-variant bg-surface-container text-on-surface-variant",
  } as const;

  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneClasses[tone]}`}>
      <p className="text-[10px] uppercase tracking-[0.22em]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function FilePickerCard({
  label,
  description,
  helper,
  actionLabel,
  accept,
  multiple,
  directory,
  onChangeFile,
  onChangeFiles,
}: {
  label: string;
  description: string;
  helper: string;
  actionLabel: string;
  accept: string;
  multiple?: boolean;
  directory?: boolean;
  onChangeFile?: (file: File | null) => void;
  onChangeFiles?: (files: File[]) => void;
}) {
  const inputId = `${label.toLowerCase()}-input`;
  const [dragActive, setDragActive] = useState(false);

  function handleFiles(selected: File[]) {
    if (multiple) {
      onChangeFiles?.(selected);
      return;
    }
    onChangeFile?.(selected[0] ?? null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const selected = Array.from(event.dataTransfer.files ?? []);
    handleFiles(selected);
  }

  return (
    <div
      className={`rounded-2xl border bg-surface-container-high p-4 transition-all ${
        dragActive ? "border-primary bg-primary/5 shadow-elevation-1" : "border-outline-variant"
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragActive(false);
      }}
      onDrop={handleDrop}
    >
      <div className="mb-4">
        <p className="text-sm font-semibold text-on-surface">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{description}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container px-3 py-2">
          <p className="truncate text-sm text-on-surface">{helper}</p>
        </div>
        <label
          htmlFor={inputId}
          className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-outline-variant bg-surface-container px-4 text-sm font-medium text-on-surface transition-all hover:border-primary hover:text-primary"
        >
          {actionLabel}
        </label>
      </div>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        {...(directory ? { webkitdirectory: "" } : {})}
        onChange={(event) => {
          handleFiles(Array.from(event.target.files ?? []));
        }}
        className="sr-only"
      />
      <div className="mt-3 rounded-xl border border-dashed border-outline-variant px-4 py-3 text-xs text-on-surface-variant">
        {dragActive ? "Suelta los archivos aquí" : "También puedes arrastrar y soltar archivos en esta tarjeta"}
      </div>
    </div>
  );
}
