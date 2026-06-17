"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Pause, Play, Save, SkipForward, X } from "lucide-react";
import { api, formatBytes, mediaUrl } from "@/lib/api";
import type { AudioAsset, AudioCategory } from "@/types/routlis";

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

type WizardItem = AudioAsset & {
  assetId: string;
  audioBlobUrl?: string | null;
};

type Props = {
  open: boolean;
  assets: AudioAsset[];
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

function createDraft(asset: WizardItem, categories: AudioCategory[], defaults?: Partial<Draft>, index = 0): Draft {
  return {
    label: defaults?.label?.trim() || asset.transcript?.trim() || asset.originalName,
    description: defaults?.description ?? "",
    categoryId: defaults?.categoryId || categories[0]?.id || "",
    color: defaults?.color || "#047857",
    shortcutKey: defaults?.shortcutKey || "",
    sortOrder: defaults?.sortOrder || String(index),
    imageFile: null,
  };
}

export function AudioManualCreationModal({ open, assets, categories, onClose, onFinished }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [statuses, setStatuses] = useState<Record<string, AssetStatus>>({});
  const [defaults, setDefaults] = useState<Partial<Draft>>({});
  const [availableCategories, setAvailableCategories] = useState<AudioCategory[]>(categories);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const queueItems: WizardItem[] = assets.map((asset) => ({
    ...asset,
    assetId: asset.id,
    audioBlobUrl: asset.audioUrl ?? null,
  }));

  const currentAsset = queueItems[currentIndex] ?? null;
  const currentDraft = currentAsset
    ? drafts[currentAsset.id] ?? createDraft(currentAsset, availableCategories, defaults, currentIndex)
    : null;

  const pendingAssets = queueItems.filter((asset) => !statuses[asset.id] || statuses[asset.id] === "pending");
  const createdCount = queueItems.filter((asset) => statuses[asset.id] === "created").length;
  const skippedCount = queueItems.filter((asset) => statuses[asset.id] === "skipped").length;
  const errorCount = queueItems.filter((asset) => statuses[asset.id] === "error").length;
  const progress = queueItems.length ? ((createdCount + skippedCount) / queueItems.length) * 100 : 0;

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(0);
    setDrafts({});
    setStatuses({});
    setDefaults({});
    setAvailableCategories(categories);
    setBusy(false);
    setErrorMessage(null);
  }, [open, assets, categories]);

  useEffect(() => {
    setAvailableCategories(categories);
  }, [categories]);

  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPreviewPlaying(false);
  }, [currentAsset?.id]);

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
    if (!currentAsset) return;
    const source = currentAsset.audioBlobUrl ? currentAsset.audioBlobUrl : currentAsset.assetId ? mediaUrl(`/audio-assets/${currentAsset.assetId}/stream`) : null;
    if (!source) return;

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
    if (!currentAsset) return;
    setDrafts((current) => ({
      ...current,
      [currentAsset.id]: {
        ...(current[currentAsset.id] ?? createDraft(currentAsset, availableCategories, defaults, currentIndex)),
        [key]: value,
      },
    }));
    if (key !== "label" && key !== "imageFile") {
      setDefaults((current) => ({ ...current, [key]: value }));
    }
  }

  async function saveCurrentAndAdvance(action: "create" | "skip") {
    if (!currentAsset || !currentDraft) return;
    if (action === "skip") {
      setStatuses((current) => ({ ...current, [currentAsset.id]: "skipped" }));
      if (currentIndex >= queueItems.length - 1) {
        onFinished?.();
        return;
      }
      setCurrentIndex((index) => Math.min(index + 1, Math.max(queueItems.length - 1, 0)));
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      const categoryId = currentDraft.categoryId || (await ensureDefaultCategory());
      if (!categoryId) {
        setErrorMessage("No se pudo resolver una categoría para crear el botón.");
        return;
      }

      const payload = new FormData();
      payload.append("label", currentDraft.label.trim() || slugToLabel(currentAsset.originalName) || currentAsset.originalName);
      payload.append("description", currentDraft.description);
      payload.append("categoryId", categoryId);
      payload.append("audioAssetId", currentAsset.assetId);
      payload.append("color", currentDraft.color);
      payload.append("shortcutKey", currentDraft.shortcutKey);
      payload.append("sortOrder", currentDraft.sortOrder || "0");
      if (currentDraft.imageFile) payload.append("image", currentDraft.imageFile);

      await api("/audio-buttons", { method: "POST", body: payload, formData: true });
      setStatuses((current) => ({ ...current, [currentAsset.id]: "created" }));
      setDrafts((current) => ({
        ...current,
        [currentAsset.id]: {
          ...currentDraft,
          categoryId,
        },
      }));
      if (currentIndex >= queueItems.length - 1) {
        onFinished?.();
        return;
      }
      setCurrentIndex((index) => Math.min(index + 1, queueItems.length - 1));
    } catch (error) {
      setStatuses((current) => ({ ...current, [currentAsset.id]: "error" }));
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear el botón.");
    } finally {
      setBusy(false);
    }
  }

  async function ensureDefaultCategory() {
    const existingCategory = availableCategories[0];
    if (existingCategory) return existingCategory.id;

    const createdCategory = await api<AudioCategory>("/audio-categories", {
      method: "POST",
      body: JSON.stringify({
        name: "Principal",
        description: "Categoria creada automaticamente para nuevas importaciones.",
        sortOrder: 0,
      }),
    });

    setAvailableCategories((current) => [createdCategory, ...current]);
    setDefaults((current) => ({ ...current, categoryId: createdCategory.id }));
    return createdCategory.id;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 py-4 backdrop-blur-md" onClick={onClose}>
      <div className="flex h-[calc(100dvh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-outline-variant bg-surface shadow-[0_30px_90px_rgba(0,0,0,.45)]" onClick={(e) => e.stopPropagation()}>
        <div className="relative border-b border-outline-variant px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-on-surface-variant">Creador manual</p>
          <h3 className="mt-1 text-xl font-semibold text-on-surface">Crear botones desde audios subidos</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Recorre la tanda recién cargada, ajusta los datos del botón y crea cada elemento sin salir del flujo.
          </p>
          <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMessage ? <div className="border-b danger-surface px-5 py-3 text-sm">{errorMessage}</div> : null}

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(280px,.92fr)_minmax(0,1.08fr)]">
          <aside className="flex min-h-0 flex-col border-b border-outline-variant p-4 lg:border-b-0 lg:border-r lg:p-5">
            <div className="shrink-0 rounded-[22px] border border-outline-variant bg-surface-container p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Cola de audios</p>
                  <p className="mt-1 text-sm text-on-surface-variant">Define un botón por archivo y conserva los valores que repitas.</p>
                </div>
                <span className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-[11px] font-medium text-on-surface-variant">{queueItems.length} ítems</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">Creado</p>
                  <p className="mt-1 text-lg font-semibold text-on-surface">{createdCount}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">Pendiente</p>
                  <p className="mt-1 text-lg font-semibold text-on-surface">{pendingAssets.length}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">Saltado</p>
                  <p className="mt-1 text-lg font-semibold text-on-surface">{skippedCount}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">Error</p>
                  <p className="mt-1 text-lg font-semibold text-on-surface">{errorCount}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {queueItems.map((asset, index) => {
                const status = statuses[asset.id] ?? "pending";
                const isCurrent = index === currentIndex;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    className={`w-full rounded-[20px] border px-4 py-3 text-left transition-all ${
                      isCurrent ? "border-primary/40 bg-primary/10" : "border-outline-variant bg-surface-container hover:border-primary/20 hover:bg-surface-container-high"
                    }`}
                  >
                    <p className="truncate text-sm font-semibold text-on-surface">{asset.originalName}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{asset.mimeType || "N/D"} · {formatOptionalBytes(asset.sizeBytes)}</p>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-on-surface-variant">
                      <span>{asset.durationSeconds ? `${asset.durationSeconds}s` : "Duración no disponible"}</span>
                      <span className={status === "created" ? "success-surface" : status === "error" ? "danger-surface" : "text-on-surface-variant"}>{status}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden p-4 pr-2 pb-6 lg:p-5 lg:pb-6">
            {currentAsset && currentDraft ? (
              <div className="flex min-h-0 w-full flex-1 flex-col">
                <div className="shrink-0 rounded-[24px] border border-outline-variant bg-surface-container p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Audio actual</p>
                      <h4 className="mt-1 truncate text-lg font-semibold text-on-surface">{currentAsset.originalName}</h4>
                      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                        Usa este archivo como base para crear el botón. Los campos inferiores se conservan como defaults.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {currentIndex + 1} / {queueItems.length}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 rounded-[20px] border border-outline-variant bg-surface p-4 sm:grid-cols-3">
                    <Stat label="Formato" value={currentAsset.mimeType || "N/D"} />
                    <Stat label="Peso" value={formatOptionalBytes(currentAsset.sizeBytes)} />
                    <Stat label="Duración" value={currentAsset.durationSeconds ? `${currentAsset.durationSeconds}s` : "N/D"} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-outline-variant bg-surface px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Preescucha</p>
                      <p className="mt-1 text-sm text-on-surface-variant">Reproduce el archivo antes de crear el botón.</p>
                    </div>
                    <button type="button" onClick={() => void togglePreview()} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
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
                      <button type="button" onClick={() => setCurrentIndex((index) => Math.min(index + 1, queueItems.length - 1))} disabled={currentIndex >= queueItems.length - 1 || busy} className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-xs font-medium text-on-surface sm:px-4 sm:text-sm">
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void saveCurrentAndAdvance("skip")} disabled={busy} className="warning-surface inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium sm:px-4 sm:text-sm">
                        <SkipForward className="h-4 w-4" />
                        Saltar
                      </button>
                      <button type="button" onClick={() => void saveCurrentAndAdvance("create")} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-on-primary shadow-elevation-1 disabled:opacity-50 sm:px-5 sm:text-sm">
                        <Save className="h-4 w-4" />
                        {busy ? "Creando..." : "Crear botón"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 pb-4 overscroll-contain" style={{ scrollbarGutter: "stable" }}>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="min-w-0 rounded-[24px] border border-outline-variant bg-surface-container p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Datos del botón</p>
                      <div className="mt-4 grid gap-3">
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Etiqueta</span>
                          <input value={currentDraft.label} onChange={(e) => updateDraft("label", e.target.value)} className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none" />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Categoría</span>
                          <select value={currentDraft.categoryId} onChange={(e) => updateDraft("categoryId", e.target.value)} className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none">
                            {!availableCategories.length ? <option value="">Se creara Principal automaticamente</option> : null}
                            {availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                          </select>
                        </label>
                        <div className="grid gap-3">
                          <label className="grid gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Orden</span>
                            <input
                              type="number"
                              min="0"
                              value={currentDraft.sortOrder}
                              onChange={(e) => updateDraft("sortOrder", e.target.value)}
                              className="h-10 w-full min-w-0 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none"
                            />
                          </label>
                          <label className="grid gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Shortcut</span>
                            <input
                              value={currentDraft.shortcutKey}
                              onChange={(e) => updateDraft("shortcutKey", e.target.value)}
                              className="h-10 w-full min-w-0 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none"
                            />
                          </label>
                        </div>
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Descripción</span>
                          <textarea value={currentDraft.description} onChange={(e) => updateDraft("description", e.target.value)} className="min-h-28 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none" />
                        </label>
                      </div>
                    </div>

                    <div className="min-w-0 rounded-[24px] border border-outline-variant bg-surface-container p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Apariencia y archivo</p>
                      <div className="mt-4 grid gap-3">
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Color</span>
                          <input
                            type="color"
                            value={currentDraft.color}
                            onChange={(e) => updateDraft("color", e.target.value)}
                            className="h-10 w-full rounded-2xl border border-outline-variant bg-surface p-1"
                          />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Imagen opcional</span>
                          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface px-3 py-3">
                            <ImagePlus className="h-4 w-4 shrink-0 text-on-surface-variant" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-on-surface">{currentDraft.imageFile ? currentDraft.imageFile.name : "Adjuntar imagen"}</p>
                              <p className="text-xs text-on-surface-variant">Opcional. Sirve para asociar una imagen al botón.</p>
                            </div>
                            <input type="file" accept="image/*" onChange={(e) => updateDraft("imageFile", e.target.files?.[0] ?? null)} className="sr-only" />
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
            ) : (
              <div className="flex min-h-full items-center justify-center rounded-[24px] border border-dashed border-outline-variant bg-surface-container p-8 text-sm text-on-surface-variant">
                No hay audios pendientes para crear botones.
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
    <div className="rounded-2xl border border-outline-variant bg-surface-container-high px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}
