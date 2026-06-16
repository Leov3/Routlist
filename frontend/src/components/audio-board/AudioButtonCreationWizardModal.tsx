"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Pause,
  Play,
  Save,
  SkipForward,
  X,
} from "lucide-react";
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

type ImportQueueItem = {
  id: string;
  rowNumber: number;
  originalName: string;
  fileName: string;
  path: string | null;
  mimeType: string;
  sizeBytes: number;
  transcript: string;
  label: string | null;
  buttonTitle: string | null;
  description: string | null;
  tag: string | null;
  status: "MATCHED" | "MISSING_FILE" | "DUPLICATE";
  matchedFileName: string | null;
};

type WizardItem = Pick<
  AudioAsset,
  | "id"
  | "fileName"
  | "originalName"
  | "mimeType"
  | "sizeBytes"
  | "durationSeconds"
  | "transcript"
  | "isActive"
  | "createdAt"
> & {
  audioUrl?: string;
  audioDownloadUrl?: string;
  importStatus?: ImportQueueItem["status"];
  importRowNumber?: number;
  importLabel?: string | null;
  importButtonTitle?: string | null;
  importDescription?: string | null;
  importTag?: string | null;
};

type Props = {
  open: boolean;
  assets: AudioAsset[];
  importQueue?: ImportQueueItem[];
  categories: AudioCategory[];
  onConfirmImport?: () => Promise<AudioAsset[]>;
  onClose: () => void;
  onFinished?: () => void;
};

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function slugToLabel(value: string) {
  return stripExtension(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
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

function statusMeta(status: AssetStatus) {
  switch (status) {
    case "created":
      return {
        label: "Creado",
        pill: "border-emerald-300/30 bg-emerald-500/10 text-emerald-200",
        dot: "bg-emerald-300",
      };
    case "skipped":
      return {
        label: "Saltado",
        pill: "border-amber-300/30 bg-amber-500/10 text-amber-200",
        dot: "bg-amber-300",
      };
    case "error":
      return {
        label: "Error",
        pill: "border-red-300/30 bg-red-500/10 text-red-200",
        dot: "bg-red-300",
      };
    default:
      return {
        label: "Pendiente",
        pill: "border-outline-variant bg-surface text-on-surface-variant",
        dot: "bg-on-surface-variant",
      };
  }
}

export function AudioButtonCreationWizardModal({
  open,
  assets,
  importQueue = [],
  categories,
  onConfirmImport,
  onClose,
  onFinished,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [statuses, setStatuses] = useState<Record<string, AssetStatus>>({});
  const [defaults, setDefaults] = useState<Partial<Draft>>({});
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedAssets, setConfirmedAssets] = useState<AudioAsset[]>([]);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const queueItems: WizardItem[] = confirmedAssets.length
    ? confirmedAssets
    : assets.length
      ? assets.map((asset) => ({
          ...asset,
          audioUrl: asset.audioUrl,
          audioDownloadUrl: asset.audioDownloadUrl,
        }))
      : importQueue.map((item) => ({
          id: item.id,
          fileName: item.fileName,
          originalName: item.originalName,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          transcript: item.transcript,
          isActive: false,
          createdAt: new Date().toISOString(),
          importStatus: item.status,
          importRowNumber: item.rowNumber,
          importLabel: item.label,
          importButtonTitle: item.buttonTitle,
          importDescription: item.description,
          importTag: item.tag,
        }));

  const isImportQueueMode = !confirmedAssets.length && !assets.length && importQueue.length > 0;
  const currentAsset = queueItems[currentIndex] ?? null;
  const currentDraft = useMemo(() => {
    if (!currentAsset) return null;
    return drafts[currentAsset.id] ?? createDraft(currentAsset, categories, defaults, currentIndex);
  }, [categories, currentAsset, currentIndex, defaults, drafts]);
  const currentAssetIsPlaceholder = Boolean((currentAsset as WizardItem | null)?.importRowNumber);

  const pendingAssets = queueItems.filter((asset) => !statuses[asset.id] || statuses[asset.id] === "pending");
  const processedCount = queueItems.filter((asset) => statuses[asset.id] === "created" || statuses[asset.id] === "skipped").length;
  const finished = queueItems.length > 0 && processedCount === queueItems.length && !isImportQueueMode;

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(0);
    setDrafts({});
    setStatuses({});
    setDefaults({});
    setConfirmedAssets([]);
    setBusy(false);
    setErrorMessage(null);
  }, [open, assets, importQueue]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    if (!open) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !currentAsset || drafts[currentAsset.id]) return;
    setDrafts((current) => ({
      ...current,
      [currentAsset.id]: createDraft(currentAsset, categories, defaults, currentIndex),
    }));
  }, [categories, currentAsset, currentIndex, defaults, drafts, open]);

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
    if (currentAssetIsPlaceholder) {
      setErrorMessage("Primero confirma la importación para reproducir el audio.");
      return;
    }

    const source = mediaUrl(`/audio-assets/${currentAsset.id}/stream`);
    let audio = previewAudioRef.current;

    if (!audio) {
      audio = new Audio(source);
      previewAudioRef.current = audio;
      audio.addEventListener("ended", () => setIsPreviewPlaying(false));
      audio.addEventListener("pause", () => setIsPreviewPlaying(false));
      audio.addEventListener("play", () => setIsPreviewPlaying(true));
    }

    audio.src = source;
    audio.currentTime = audio.currentTime || 0;

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

  async function saveCurrentAndAdvance(action: "create" | "skip") {
    if (!currentAsset || !currentDraft) return;

    if (currentAssetIsPlaceholder) {
      setErrorMessage("Primero confirma la importación CSV para crear botones.");
      return;
    }

    if (!currentDraft.categoryId) {
      setErrorMessage("Selecciona una categoría antes de crear el botón.");
      return;
    }

    if (action === "skip") {
      setStatuses((current) => ({ ...current, [currentAsset.id]: "skipped" }));
      if (currentIndex >= queueItems.length - 1) {
        onFinished?.();
        return;
      }
      setCurrentIndex((index) => Math.min(index + 1, Math.max(queueItems.length - 1, 0)));
      setErrorMessage(null);
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      const payload = new FormData();
      payload.append("label", currentDraft.label.trim() || slugToLabel(currentAsset.originalName) || currentAsset.originalName);
      payload.append("description", currentDraft.description);
      payload.append("categoryId", currentDraft.categoryId);
      payload.append("audioAssetId", currentAsset.id);
      payload.append("color", currentDraft.color);
      payload.append("shortcutKey", currentDraft.shortcutKey);
      payload.append("sortOrder", currentDraft.sortOrder || "0");
      if (currentDraft.imageFile) {
        payload.append("image", currentDraft.imageFile);
      }

      const created = await api<{ id: string }>("/audio-buttons", {
        method: "POST",
        body: payload,
        formData: true,
      });

      setStatuses((current) => ({ ...current, [currentAsset.id]: "created" }));
      setDefaults({
        description: currentDraft.description,
        categoryId: currentDraft.categoryId,
        color: currentDraft.color,
        shortcutKey: currentDraft.shortcutKey,
        sortOrder: String(Number(currentDraft.sortOrder || 0) + 1),
      });
      setDrafts((current) => ({
        ...current,
        [currentAsset.id]: {
          ...currentDraft,
          imageFile: null,
        },
      }));

      if (currentIndex >= queueItems.length - 1) {
        onFinished?.();
        return;
      }

      setCurrentIndex((index) => Math.min(index + 1, queueItems.length - 1));
      return created;
    } catch (error) {
      setStatuses((current) => ({ ...current, [currentAsset.id]: "error" }));
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear el botón.");
    } finally {
      setBusy(false);
    }
  }

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    if (!currentAsset) return;

    setDrafts((current) => ({
      ...current,
      [currentAsset.id]: {
        ...(current[currentAsset.id] ?? createDraft(currentAsset, categories, defaults, currentIndex)),
        [key]: value,
      },
    }));

    if (key !== "label" && key !== "imageFile") {
      setDefaults((current) => ({ ...current, [key]: value }));
    }
  }

  async function confirmImport() {
    if (!onConfirmImport) return;

    setBusy(true);
    setErrorMessage(null);
    try {
      const imported = await onConfirmImport();
      setConfirmedAssets(imported);
      setCurrentIndex(0);
      setStatuses({});
      setDrafts({});
      setDefaults({});
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo confirmar la importación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 px-3 py-3 backdrop-blur-md sm:items-center sm:px-4 sm:py-4"
      onClick={onClose}
    >
      <div
        className="flex h-[calc(100dvh-1.5rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-outline-variant bg-surface shadow-[0_30px_90px_rgba(0,0,0,.45)] sm:h-[calc(100dvh-2rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-outline-variant px-5 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.24em] text-on-surface-variant">Creador guiado</p>
              <h3 className="mt-1 text-xl font-semibold text-on-surface">
                {finished ? "Botones creados" : isImportQueueMode ? "Revisar importación CSV" : "Crear botones desde audios subidos"}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                {isImportQueueMode
                  ? "Revisa toda la tanda del CSV, confirma la importación y luego crea cada botón sin salir del flujo."
                  : "Recorre la tanda recién cargada, ajusta los datos del botón y crea cada elemento sin salir del flujo."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-outline-variant bg-surface-container px-3 py-1 text-xs font-medium text-on-surface-variant">
                {processedCount}/{queueItems.length} procesados
              </span>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {pendingAssets.length} pendientes
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${queueItems.length ? (processedCount / queueItems.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {errorMessage ? (
          <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        ) : null}

        {finished ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-md rounded-[26px] border border-emerald-300/20 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
              <h4 className="mt-4 text-xl font-semibold text-on-surface">Botonera creada</h4>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                Se procesaron {queueItems.length} audio(s). Puedes cerrar el asistente o volver al panel de botones.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:brightness-110"
              >
                Cerrar asistente
              </button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(280px,.92fr)_minmax(0,1.08fr)]">
            <aside className="border-b border-outline-variant p-4 lg:border-b-0 lg:border-r lg:p-5">
              <div className="rounded-[22px] border border-outline-variant bg-surface-container p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Cola de audios</p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Define un botón por archivo y conserva los valores que repitas.
                    </p>
                  </div>
                  <span className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-[11px] font-medium text-on-surface-variant">
                    {queueItems.length} ítems
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">Creado</p>
                    <p className="mt-1 text-lg font-semibold text-on-surface">
                      {queueItems.filter((asset) => statuses[asset.id] === "created").length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">Pendiente</p>
                    <p className="mt-1 text-lg font-semibold text-on-surface">{pendingAssets.length}</p>
                  </div>
                  <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">Error</p>
                    <p className="mt-1 text-lg font-semibold text-on-surface">
                      {queueItems.filter((asset) => statuses[asset.id] === "error").length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 max-h-[calc(100dvh-16rem)] space-y-2 overflow-y-auto pr-1">
                {queueItems.map((asset, index) => {
                  const status = statuses[asset.id] ?? "pending";
                  const isCurrent = index === currentIndex;
                  const meta = statusMeta(status);
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setCurrentIndex(index)}
                      className={`group w-full rounded-[20px] border px-4 py-3 text-left transition-all ${
                        isCurrent
                          ? "border-primary/40 bg-primary/10 shadow-[0_0_0_1px_rgba(167,139,250,.14)]"
                          : "border-outline-variant bg-surface-container hover:border-primary/20 hover:bg-surface-container-high"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                            <p className="truncate text-sm font-semibold text-on-surface">{asset.originalName}</p>
                          </div>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            {asset.mimeType} · {formatBytes(asset.sizeBytes)}
                          </p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${meta.pill}`}>
                          {meta.label}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-on-surface-variant">
                        <span className="truncate">
                          {asset.durationSeconds ? `${asset.durationSeconds}s` : asset.importStatus ? "Pendiente de importación" : "Duración no disponible"}
                        </span>
                        {isCurrent ? (
                          <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                            Actual
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="min-h-0 overflow-hidden p-4 lg:p-5">
              {currentAsset && currentDraft ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="rounded-[24px] border border-outline-variant bg-surface-container p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Audio actual</p>
                        <h4 className="mt-1 truncate text-lg font-semibold text-on-surface">{currentAsset.originalName}</h4>
                        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                          {currentAssetIsPlaceholder
                            ? "Esta fila aún no está persistida. Confirma la importación para usar el audio en la creación del botón."
                            : "Usa este archivo como base para crear el botón. Los campos inferiores se conservan como defaults."}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {currentIndex + 1} / {queueItems.length}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 rounded-[20px] border border-outline-variant bg-surface p-4 sm:grid-cols-3">
                      <Stat label="Formato" value={currentAsset.mimeType} />
                      <Stat label="Peso" value={formatBytes(currentAsset.sizeBytes)} />
                      <Stat label="Duración" value={currentAsset.durationSeconds ? `${currentAsset.durationSeconds}s` : "N/D"} />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-outline-variant bg-surface px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Preescucha</p>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          {currentAssetIsPlaceholder
                            ? "Disponible después de confirmar la importación."
                            : "Reproduce el archivo antes de crear el botón."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void togglePreview()}
                        disabled={currentAssetIsPlaceholder}
                        className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPreviewPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {currentAssetIsPlaceholder ? "Sin audio" : isPreviewPlaying ? "Pausar" : "Reproducir"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid min-h-0 gap-4 xl:grid-cols-2">
                    <div className="rounded-[24px] border border-outline-variant bg-surface-container p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Datos del botón</p>
                      <div className="mt-4 grid gap-3">
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Etiqueta</span>
                          <input
                            value={currentDraft.label}
                            onChange={(event) => updateDraft("label", event.target.value)}
                            className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none transition-colors focus:border-primary"
                            placeholder="Texto del botón"
                          />
                        </label>

                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Categoría</span>
                          <select
                            value={currentDraft.categoryId}
                            onChange={(event) => updateDraft("categoryId", event.target.value)}
                            className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none transition-colors focus:border-primary"
                            disabled={!categories.length}
                          >
                            {!categories.length ? <option value="">No hay categorías</option> : null}
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="grid gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Orden</span>
                            <input
                              type="number"
                              min="0"
                              value={currentDraft.sortOrder}
                              onChange={(event) => updateDraft("sortOrder", event.target.value)}
                              className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none transition-colors focus:border-primary"
                            />
                          </label>

                          <label className="grid gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Shortcut</span>
                            <input
                              value={currentDraft.shortcutKey}
                              onChange={(event) => updateDraft("shortcutKey", event.target.value)}
                              className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none transition-colors focus:border-primary"
                              placeholder="1, 2, A..."
                            />
                          </label>
                        </div>

                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Descripción</span>
                          <textarea
                            value={currentDraft.description}
                            onChange={(event) => updateDraft("description", event.target.value)}
                            className="min-h-28 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                            placeholder="Descripción o texto complementario"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-outline-variant bg-surface-container p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Apariencia y archivo</p>
                      <div className="mt-4 grid gap-3">
                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Color</span>
                          <div className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface px-3 py-2.5">
                            <input
                              type="color"
                              value={currentDraft.color}
                              onChange={(event) => updateDraft("color", event.target.value)}
                              className="h-8 w-10 rounded-lg border border-outline-variant bg-transparent p-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-on-surface">Color del botón</p>
                              <p className="text-xs text-on-surface-variant">{currentDraft.color}</p>
                            </div>
                          </div>
                        </label>

                        <label className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Imagen opcional</span>
                          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface px-3 py-3 transition-colors hover:border-primary/40 hover:bg-surface-container-high">
                            <ImagePlus className="h-4 w-4 shrink-0 text-on-surface-variant" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-on-surface">
                                {currentDraft.imageFile ? currentDraft.imageFile.name : "Adjuntar imagen"}
                              </p>
                              <p className="text-xs text-on-surface-variant">Opcional. Sirve para asociar una imagen al botón.</p>
                            </div>
                            <span className="rounded-full border border-outline-variant bg-surface-container px-3 py-1 text-xs font-medium text-on-surface-variant">
                              Buscar
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => updateDraft("imageFile", event.target.files?.[0] ?? null)}
                              className="sr-only"
                            />
                          </label>
                        </label>

                        <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Vista previa</p>
                          <p className="mt-2 text-sm font-semibold text-on-surface">{currentDraft.label || "Etiqueta del botón"}</p>
                          <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                            {currentDraft.description || "Sin descripción adicional"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[24px] border border-outline-variant bg-surface-container p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-on-surface-variant">
                        Los defaults se conservan para acelerar la tanda actual.
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isImportQueueMode ? (
                          <button
                            type="button"
                            onClick={() => void confirmImport()}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                            {busy ? "Confirmando..." : "Confirmar importación"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setCurrentIndex((index) => Math.max(index - 1, 0))}
                          disabled={currentIndex === 0 || busy}
                          className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Volver
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveCurrentAndAdvance("skip")}
                          disabled={busy || currentAssetIsPlaceholder}
                          className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <SkipForward className="h-4 w-4" />
                          Saltar
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveCurrentAndAdvance("create")}
                          disabled={busy || !categories.length || currentAssetIsPlaceholder}
                          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          {busy ? "Creando..." : currentAssetIsPlaceholder ? "Sin archivo" : "Crear botón"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentIndex((index) => Math.min(index + 1, queueItems.length - 1))}
                          disabled={currentIndex >= queueItems.length - 1 || busy}
                          className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Siguiente
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 max-h-[calc(100dvh-20rem)] overflow-y-auto pr-1 lg:mt-5">
                    <div className="rounded-[24px] border border-outline-variant bg-surface-container p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Detalles del archivo</p>
                      <div className="mt-4 grid gap-3">
                        <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">Etiqueta completa</p>
                          <p className="mt-2 text-sm leading-6 text-on-surface">{currentDraft.label || currentAsset.originalName}</p>
                        </div>
                        <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">Texto fuente</p>
                          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                            {currentAsset.transcript || "Sin texto fuente disponible"}
                          </p>
                        </div>
                        {currentAssetIsPlaceholder ? (
                          <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-200">
                            Esta fila es solo una previsualización del CSV. Confirma la importación para persistir el audio.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-outline-variant bg-surface-container p-8 text-sm text-on-surface-variant">
                  No hay audios pendientes para crear botones.
                </div>
              )}
            </section>
          </div>
        )}
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
