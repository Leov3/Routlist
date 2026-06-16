"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Pause, Play, Save, SkipForward, X } from "lucide-react";
import type { CsvImportQueueItem } from "@/components/audio-board/audio-csv-types";
import { api, formatBytes, mediaUrl } from "@/lib/api";
import type { AudioCategory } from "@/types/routlis";

type Draft = {
  label: string;
  description: string;
  categoryId: string;
  color: string;
  shortcutKey: string;
  sortOrder: string;
  imageFile: File | null;
};

type AssetStatus = "pending" | "created" | "skipped" | "error";

type Props = {
  open: boolean;
  queue: CsvImportQueueItem[];
  categories: AudioCategory[];
  onClose: () => void;
  onFinished?: () => void;
};

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function slugToLabel(value: string) {
  return stripExtension(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function formatOptionalBytes(bytes: number | null | undefined) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "N/D";
  return formatBytes(bytes);
}

function normalizeCategoryHint(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resolveCategoryId(tag: string | null, categories: AudioCategory[]) {
  if (!tag) return "";
  const normalizedTag = normalizeCategoryHint(tag);
  return categories.find((category) => normalizeCategoryHint(category.name) === normalizedTag)?.id ?? "";
}

function createDraft(item: CsvImportQueueItem, categories: AudioCategory[], defaults?: Partial<Draft>, index = 0): Draft {
  return {
    label: item.buttonTitle?.trim() || item.label?.trim() || item.transcript?.trim() || item.originalName,
    description: item.description?.trim() || "",
    categoryId: defaults?.categoryId || resolveCategoryId(item.tag, categories) || categories[0]?.id || "",
    color: defaults?.color || "#047857",
    shortcutKey: defaults?.shortcutKey || "",
    sortOrder: defaults?.sortOrder || String(index),
    imageFile: null,
  };
}

export function AudioCsvButtonCreationModal({ open, queue, categories, onClose, onFinished }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [statuses, setStatuses] = useState<Record<string, AssetStatus>>({});
  const [defaults, setDefaults] = useState<Partial<Draft>>({});
  const [availableCategories, setAvailableCategories] = useState<AudioCategory[]>(categories);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const creatableQueue = queue.filter((item) => Boolean(item.assetId));
  const currentItem = creatableQueue[currentIndex] ?? null;
  const currentDraft = currentItem
    ? drafts[currentItem.id] ?? createDraft(currentItem, availableCategories, defaults, currentIndex)
    : null;

  const pendingItems = creatableQueue.filter((item) => !statuses[item.id] || statuses[item.id] === "pending");
  const createdCount = creatableQueue.filter((item) => statuses[item.id] === "created").length;
  const skippedCount = creatableQueue.filter((item) => statuses[item.id] === "skipped").length;
  const errorCount = creatableQueue.filter((item) => statuses[item.id] === "error").length;
  const progress = creatableQueue.length ? ((createdCount + skippedCount) / creatableQueue.length) * 100 : 0;

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(0);
    setDrafts({});
    setStatuses({});
    setDefaults({});
    setAvailableCategories(categories);
    setBusy(false);
    setErrorMessage(null);
  }, [open, queue]);

  useEffect(() => {
    setAvailableCategories(categories);
  }, [categories]);

  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPreviewPlaying(false);
  }, [currentItem?.id]);

  useEffect(() => {
    return () => {
      const audio = previewAudioRef.current;
      if (!audio) return;
      audio.pause();
      audio.src = "";
    };
  }, []);

  if (!open) return null;

  async function togglePreview() {
    if (!currentItem?.assetId) return;
    const source = mediaUrl(`/audio-assets/${currentItem.assetId}/stream`);

    let audio = previewAudioRef.current;
    if (!audio) {
      audio = new Audio(source);
      previewAudioRef.current = audio;
      audio.addEventListener("ended", () => setIsPreviewPlaying(false));
      audio.addEventListener("pause", () => setIsPreviewPlaying(false));
      audio.addEventListener("play", () => setIsPreviewPlaying(true));
    }

    audio.src = source;
    if (audio.paused) {
      try {
        await audio.play();
        setIsPreviewPlaying(true);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "No se pudo reproducir la preescucha.");
      }
    } else {
      audio.pause();
      setIsPreviewPlaying(false);
    }
  }

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    if (!currentItem) return;
    setDrafts((current) => ({
      ...current,
      [currentItem.id]: {
        ...(current[currentItem.id] ?? createDraft(currentItem, availableCategories, defaults, currentIndex)),
        [key]: value,
      },
    }));

    if (key === "categoryId" || key === "color" || key === "shortcutKey" || key === "sortOrder") {
      setDefaults((current) => ({ ...current, [key]: value }));
    }
  }

  async function saveCurrentAndAdvance(action: "create" | "skip") {
    if (!currentItem || !currentDraft) return;

    if (action === "skip") {
      setStatuses((current) => ({ ...current, [currentItem.id]: "skipped" }));
      if (currentIndex >= creatableQueue.length - 1) {
        onFinished?.();
        return;
      }
      setCurrentIndex((index) => Math.min(index + 1, creatableQueue.length - 1));
      setErrorMessage(null);
      return;
    }

    if (!currentItem.assetId) {
      setErrorMessage("Esta fila no tiene un audio importado para crear el botón.");
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      const categoryId = currentDraft.categoryId || (await ensureCategoryForItem(currentItem));
      if (!categoryId) {
        setErrorMessage("No se pudo resolver una categoría para crear el botón.");
        return;
      }

      const payload = new FormData();
      payload.append("label", currentDraft.label.trim() || slugToLabel(currentItem.originalName) || currentItem.originalName);
      payload.append("description", currentDraft.description);
      payload.append("categoryId", categoryId);
      payload.append("audioAssetId", currentItem.assetId);
      payload.append("color", currentDraft.color);
      payload.append("shortcutKey", currentDraft.shortcutKey);
      payload.append("sortOrder", currentDraft.sortOrder || "0");
      if (currentDraft.imageFile) payload.append("image", currentDraft.imageFile);

      await api("/audio-buttons", { method: "POST", body: payload, formData: true });

      setStatuses((current) => ({ ...current, [currentItem.id]: "created" }));
      setDefaults((current) => ({
        ...current,
        categoryId,
        color: currentDraft.color,
        shortcutKey: currentDraft.shortcutKey,
        sortOrder: String(Number(currentDraft.sortOrder || 0) + 1),
      }));
      setDrafts((current) => ({
        ...current,
        [currentItem.id]: {
          ...currentDraft,
          categoryId,
        },
      }));

      if (currentIndex >= creatableQueue.length - 1) {
        onFinished?.();
        return;
      }
      setCurrentIndex((index) => Math.min(index + 1, creatableQueue.length - 1));
    } catch (error) {
      setStatuses((current) => ({ ...current, [currentItem.id]: "error" }));
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear el botón.");
    } finally {
      setBusy(false);
    }
  }

  async function ensureCategoryForItem(item: CsvImportQueueItem) {
    const matchedCategory = availableCategories.find((category) => normalizeCategoryHint(category.name) === normalizeCategoryHint(item.tag || ""));
    if (matchedCategory) return matchedCategory.id;
    if (availableCategories[0] && !item.tag?.trim()) return availableCategories[0].id;

    const categoryName = item.tag?.trim() || "Principal";
    const createdCategory = await api<AudioCategory>("/audio-categories", {
      method: "POST",
      body: JSON.stringify({
        name: categoryName,
        description: item.tag?.trim()
          ? `Categoria creada automaticamente desde el tag CSV "${item.tag.trim()}".`
          : "Categoria creada automaticamente para importaciones CSV.",
        sortOrder: availableCategories.length,
      }),
    });

    setAvailableCategories((current) => [...current, createdCategory]);
    return createdCategory.id;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 py-4 backdrop-blur-md" onClick={onClose}>
      <div className="flex h-[calc(100dvh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-outline-variant bg-surface shadow-[0_30px_90px_rgba(0,0,0,.45)]" onClick={(event) => event.stopPropagation()}>
        <div className="relative border-b border-outline-variant px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-on-surface-variant">Creador CSV</p>
          <h3 className="mt-1 text-xl font-semibold text-on-surface">Crear botones desde importación CSV</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
            Recorre la tanda importada y usa la metadata del CSV para sembrar título, descripción y sugerencias de categoría en cada botón.
          </p>
          <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMessage ? <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-300">{errorMessage}</div> : null}

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(280px,.92fr)_minmax(0,1.08fr)]">
          <aside className="flex min-h-0 flex-col border-b border-outline-variant p-4 lg:border-b-0 lg:border-r lg:p-5">
            <div className="shrink-0 rounded-[22px] border border-outline-variant bg-surface-container p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Cola importada</p>
                  <p className="mt-1 text-sm text-on-surface-variant">Cada fila conserva la metadata del CSV y puedes ajustar solo lo necesario antes de crear el botón.</p>
                </div>
                <span className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-[11px] font-medium text-on-surface-variant">{creatableQueue.length} filas</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Creado" value={String(createdCount)} />
                <Stat label="Pendiente" value={String(pendingItems.length)} />
                <Stat label="Saltado" value={String(skippedCount)} />
                <Stat label="Error" value={String(errorCount)} />
              </div>
            </div>

            <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {creatableQueue.map((item, index) => {
                const status = statuses[item.id] ?? "pending";
                const isCurrent = index === currentIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    className={`w-full rounded-[20px] border px-4 py-3 text-left transition-all ${
                      isCurrent ? "border-primary/40 bg-primary/10" : "border-outline-variant bg-surface-container hover:border-primary/20 hover:bg-surface-container-high"
                    }`}
                  >
                    <p className="truncate text-sm font-semibold text-on-surface">{item.buttonTitle || item.label || item.originalName}</p>
                    <p className="mt-1 truncate text-xs text-on-surface-variant">{item.tag || item.path || item.fileName}</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-on-surface-variant">
                      <span className="truncate">{`${item.mimeType || "N/D"} · ${formatOptionalBytes(item.sizeBytes)}`}</span>
                      <span className={status === "created" ? "text-emerald-300" : status === "error" ? "text-red-300" : "text-on-surface-variant"}>{status}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden p-4 pr-2 pb-6 lg:p-5 lg:pb-6">
            {currentItem && currentDraft ? (
              <div className="flex min-h-0 w-full flex-1 flex-col">
                <div className="shrink-0 rounded-[24px] border border-outline-variant bg-surface-container p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Fila actual</p>
                      <h4 className="mt-1 truncate text-lg font-semibold text-on-surface">{currentItem.buttonTitle || currentItem.label || currentItem.originalName}</h4>
                      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                        Esta fila ya trae metadata del CSV. Puedes aprovecharla tal cual o ajustar solo la capa final del botón.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {currentIndex + 1} / {creatableQueue.length}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 rounded-[20px] border border-outline-variant bg-surface p-4 sm:grid-cols-3">
                    <Stat label="Formato" value={currentItem.mimeType || "N/D"} />
                    <Stat label="Peso" value={formatOptionalBytes(currentItem.sizeBytes)} />
                    <Stat label="Tag CSV" value={currentItem.tag || "N/D"} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-outline-variant bg-surface px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Preescucha</p>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {currentItem.assetId ? "Reproduce el audio persistido antes de crear el botón." : "Esta fila no tiene audio disponible para crear botón."}
                      </p>
                    </div>
                    <button type="button" onClick={() => void togglePreview()} disabled={!currentItem.assetId} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">
                      {isPreviewPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {isPreviewPlaying ? "Pausar" : "Reproducir"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 shrink-0 rounded-[24px] border border-outline-variant bg-surface-container p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setCurrentIndex((index) => Math.max(index - 1, 0))} disabled={currentIndex === 0 || busy} className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-xs font-medium text-on-surface sm:px-4 sm:text-sm">
                        <ChevronLeft className="h-4 w-4" />
                        Volver
                      </button>
                      <button type="button" onClick={() => setCurrentIndex((index) => Math.min(index + 1, creatableQueue.length - 1))} disabled={currentIndex >= creatableQueue.length - 1 || busy} className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-xs font-medium text-on-surface sm:px-4 sm:text-sm">
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void saveCurrentAndAdvance("skip")} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200 sm:px-4 sm:text-sm">
                        <SkipForward className="h-4 w-4" />
                        Saltar
                      </button>
                      <button type="button" onClick={() => void saveCurrentAndAdvance("create")} disabled={busy || !currentItem.assetId} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-on-primary shadow-elevation-1 sm:px-5 sm:text-sm disabled:opacity-50">
                        <Save className="h-4 w-4" />
                        {busy ? "Creando..." : "Crear botón"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 pb-4 overscroll-contain" style={{ scrollbarGutter: "stable" }}>
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-outline-variant bg-surface-container p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Origen CSV</p>
                      <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        <InfoBlock label="Archivo" value={currentItem.fileName} />
                        <InfoBlock label="Path" value={currentItem.path || "N/D"} />
                        <InfoBlock label="Button title" value={currentItem.buttonTitle || "N/D"} />
                        <InfoBlock label="Label" value={currentItem.label || "N/D"} />
                        <div className="xl:col-span-2">
                          <InfoBlock label="Descripción CSV" value={currentItem.description || "Sin descripción en el CSV"} />
                        </div>
                        <div className="xl:col-span-2">
                          <InfoBlock label="Texto / transcripción" value={currentItem.transcript || "Sin texto en el CSV"} />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                    <div className="min-w-0 rounded-[24px] border border-outline-variant bg-surface-container p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Datos del botón</p>
                      <div className="mt-4 grid gap-3">
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Etiqueta</span>
                          <input value={currentDraft.label} onChange={(event) => updateDraft("label", event.target.value)} className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none" />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Categoría</span>
                          <select value={currentDraft.categoryId} onChange={(event) => updateDraft("categoryId", event.target.value)} className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none">
                            {!availableCategories.length ? <option value="">Se creara una categoria automaticamente</option> : null}
                            {availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                          </select>
                        </label>
                        <div className="grid gap-3">
                          <label className="grid gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Orden</span>
                            <input type="number" min="0" value={currentDraft.sortOrder} onChange={(event) => updateDraft("sortOrder", event.target.value)} className="h-10 w-full min-w-0 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none" />
                          </label>
                          <label className="grid gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Shortcut</span>
                            <input value={currentDraft.shortcutKey} onChange={(event) => updateDraft("shortcutKey", event.target.value)} className="h-10 w-full min-w-0 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none" />
                          </label>
                        </div>
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Descripción</span>
                          <textarea value={currentDraft.description} onChange={(event) => updateDraft("description", event.target.value)} className="min-h-28 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none" />
                        </label>
                      </div>
                    </div>

                    <div className="min-w-0 rounded-[24px] border border-outline-variant bg-surface-container p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Apariencia y archivo</p>
                      <div className="mt-4 grid gap-3">
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Color</span>
                          <input type="color" value={currentDraft.color} onChange={(event) => updateDraft("color", event.target.value)} className="h-10 w-full rounded-2xl border border-outline-variant bg-surface p-1" />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Imagen opcional</span>
                          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface px-3 py-3">
                            <ImagePlus className="h-4 w-4 shrink-0 text-on-surface-variant" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-on-surface">{currentDraft.imageFile ? currentDraft.imageFile.name : "Adjuntar imagen"}</p>
                              <p className="text-xs text-on-surface-variant">Opcional. Sirve para asociar una imagen al botón.</p>
                            </div>
                            <input type="file" accept="image/*" onChange={(event) => updateDraft("imageFile", event.target.files?.[0] ?? null)} className="sr-only" />
                          </label>
                        </label>
                        <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Vista previa</p>
                          <p className="mt-2 text-sm font-semibold text-on-surface">{currentDraft.label || "Etiqueta del botón"}</p>
                          <p className="mt-1 text-sm leading-6 text-on-surface-variant">{currentDraft.description || "Sin descripción adicional"}</p>
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-full items-center justify-center rounded-[24px] border border-dashed border-outline-variant bg-surface-container p-8 text-sm text-on-surface-variant">
                No hay filas importadas para crear botones.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
      <p className="mt-1 text-sm leading-6 text-on-surface">{value}</p>
    </div>
  );
}
