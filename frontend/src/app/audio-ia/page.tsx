"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  Wand2,
} from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, apiUrl, formatBytes } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import type {
  AudioCategory,
  AudioGenerationJob,
  AudioGenerationLibraryItem,
  AudioGenerationPreferences,
  AuthUser,
} from "@/types/routlis";

type GenerateResponse = {
  reused: boolean;
  asset: AudioGenerationLibraryItem;
  job: AudioGenerationJob;
  button?: {
    id: string;
    label: string;
    category?: { id: string; name: string };
  } | null;
};

type ButtonForm = {
  label: string;
  categoryId: string;
  description: string;
  color: string;
  shortcutKey: string;
  sortOrder: string;
};

type VoiceOption = {
  voiceId: string;
  name: string;
  category?: string | null;
  labels?: Record<string, string> | null;
  previewUrl?: string | null;
};

type ModelOption = {
  modelId: string;
  name: string;
  description?: string | null;
  languages?: string[] | null;
};

const emptyButtonForm: ButtonForm = {
  label: "",
  categoryId: "",
  description: "",
  color: "#047857",
  shortcutKey: "",
  sortOrder: "0",
};

const DEFAULT_COMPOSER_TEXT =
  "Hola, gracias por llamar. Te comparto la información que necesitamos resolver ahora mismo.";

export default function AudioIAPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [text, setText] = useState(DEFAULT_COMPOSER_TEXT);
  const [voiceId, setVoiceId] = useState("");
  const [modelId, setModelId] = useState("");
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [speakerBoost, setSpeakerBoost] = useState(true);
  const [createButton, setCreateButton] = useState(false);
  const [buttonForm, setButtonForm] = useState<ButtonForm>(emptyButtonForm);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [categories, setCategories] = useState<AudioCategory[]>([]);
  const [library, setLibrary] = useState<AudioGenerationLibraryItem[]>([]);
  const [jobs, setJobs] = useState<AudioGenerationJob[]>([]);
  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState<"all" | "TEMPORARY" | "PERSISTED">("all");
  const [loading, setLoading] = useState(true);
  const [loadingLookup, setLoadingLookup] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [creatingButton, setCreatingButton] = useState(false);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AudioGenerationLibraryItem | null>(null);
  const [selectedJob, setSelectedJob] = useState<AudioGenerationJob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackObjectUrlRef = useRef<string | null>(null);
  const preferencesSaveTimeoutRef = useRef<number | null>(null);

  const canCreateButton = Boolean(user?.permissions.includes("button:create"));

  async function loadLookups() {
    setLoadingLookup(true);
    setIntegrationError(null);
    setCategoryError(null);
    try {
      const [voicesResult, modelsResult, categoriesResult, currentUser, preferences] = await Promise.all([
        api<{ voices: VoiceOption[] }>("/integrations/elevenlabs/voices"),
        api<{ models: ModelOption[] }>("/integrations/elevenlabs/models"),
        api<AudioCategory[]>("/audio-categories").catch((error) => {
          setCategoryError(error instanceof Error ? error.message : "No se pudieron cargar las categorías.");
          return [] as AudioCategory[];
        }),
        getCurrentUser(),
        api<AudioGenerationPreferences>("/me/audio-generation-preferences"),
      ]);
      setUser(currentUser);
      setVoices(voicesResult.voices);
      setModels(modelsResult.models);
      const activeCategories = categoriesResult.filter((category) => category.isActive);
      setCategories(activeCategories);
      setText(preferences.composerText || DEFAULT_COMPOSER_TEXT);
      setVoiceId(preferences.composerVoiceId || voicesResult.voices[0]?.voiceId || "");
      setModelId(preferences.composerModelId || modelsResult.models[0]?.modelId || "");
      setOutputFormat(preferences.composerOutputFormat || "mp3_44100_128");
      setStability(preferences.composerStability ?? 0.5);
      setSimilarityBoost(preferences.composerSimilarityBoost ?? 0.75);
      setStyle(preferences.composerStyle ?? 0);
      setSpeed(preferences.composerSpeed ?? 1);
      setSpeakerBoost(
        typeof preferences.composerSpeakerBoost === "boolean"
          ? preferences.composerSpeakerBoost
          : true,
      );
      setButtonForm((current) => ({
        ...current,
        categoryId: current.categoryId || activeCategories[0]?.id || "",
      }));
      setPreferencesReady(true);
    } catch (error) {
      setIntegrationError(
        error instanceof Error
          ? error.message === "Forbidden resource"
            ? "No tienes acceso a algunas dependencias de Audio IA."
            : error.message
          : "No se pudo cargar la configuración de ElevenLabs o el usuario actual.",
      );
    } finally {
      setLoadingLookup(false);
    }
  }

  async function loadLibrary() {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    if (lifecycleFilter !== "all") query.set("lifecycleStatus", lifecycleFilter);

    const result = await api<{ items: AudioGenerationLibraryItem[] }>(
      `/audio-generation/library${query.toString() ? `?${query.toString()}` : ""}`,
    );
    setLibrary(result.items);
  }

  async function loadJobs() {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    const result = await api<{ items: AudioGenerationJob[] }>(
      `/audio-generation${query.toString() ? `?${query.toString()}` : ""}`,
    );
    setJobs(result.items);
  }

  useEffect(() => {
    void loadLookups();
  }, []);

  useEffect(() => {
    if (loadingLookup) return;
    void Promise.all([loadLibrary(), loadJobs()]).then(() => setLoading(false));
  }, [loadingLookup, search, lifecycleFilter]);

  useEffect(() => {
    if (!preferencesReady) return;
    if (preferencesSaveTimeoutRef.current) {
      window.clearTimeout(preferencesSaveTimeoutRef.current);
    }

    preferencesSaveTimeoutRef.current = window.setTimeout(() => {
      void api("/me/audio-generation-preferences", {
        method: "PATCH",
        body: JSON.stringify({
          composerText: text,
          composerVoiceId: voiceId,
          composerModelId: modelId,
          composerOutputFormat: outputFormat,
          composerStability: stability,
          composerSimilarityBoost: similarityBoost,
          composerStyle: style,
          composerSpeed: speed,
          composerSpeakerBoost: speakerBoost,
        }),
      }).catch(() => undefined);
    }, 600);

    return () => {
      if (preferencesSaveTimeoutRef.current) {
        window.clearTimeout(preferencesSaveTimeoutRef.current);
      }
    };
  }, [
    preferencesReady,
    text,
    voiceId,
    modelId,
    outputFormat,
    stability,
    similarityBoost,
    style,
    speed,
    speakerBoost,
  ]);

  useEffect(() => {
    return () => {
      if (playbackObjectUrlRef.current) {
        URL.revokeObjectURL(playbackObjectUrlRef.current);
        playbackObjectUrlRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  }, [selectedAsset?.id]);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.voiceId === voiceId) ?? null,
    [voiceId, voices],
  );

  const filteredLibrary = useMemo(() => {
    const term = search.trim().toLowerCase();
    return library.filter((item) => {
      const matchesSearch =
        !term ||
        `${item.originalName} ${item.generatedText ?? ""} ${item.generatedVoiceName ?? ""} ${item.generatedModelId ?? ""}`
          .toLowerCase()
          .includes(term);
      const matchesLifecycle =
        lifecycleFilter === "all" || item.lifecycleStatus === lifecycleFilter;
      return matchesSearch && matchesLifecycle;
    });
  }, [library, search, lifecycleFilter]);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerating(true);
    setMessage(null);
    try {
      const result = await api<GenerateResponse>("/audio-generation/generate", {
        method: "POST",
        body: JSON.stringify({
          text,
          voiceId,
          voiceName: selectedVoice?.name,
          modelId,
          outputFormat,
          stability,
          similarityBoost,
          style,
          speed,
          speakerBoost,
          createButton: canCreateButton && createButton,
          buttonLabel: buttonForm.label || undefined,
          buttonCategoryId: buttonForm.categoryId || undefined,
          buttonDescription: buttonForm.description || undefined,
          buttonColor: buttonForm.color || undefined,
          buttonShortcutKey: buttonForm.shortcutKey || undefined,
          buttonSortOrder: buttonForm.sortOrder ? Number(buttonForm.sortOrder) : undefined,
        }),
      });

      setSelectedAsset(result.asset);
      setSelectedJob(result.job);
      setMessage(result.reused ? "Se reutilizó un audio ya generado." : "Audio generado correctamente.");
      setButtonForm((current) => ({
        ...current,
        label: result.asset.originalName || current.label,
        description: result.asset.transcript ?? current.description,
      }));
      void Promise.all([loadLibrary(), loadJobs()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar el audio.");
    } finally {
      setGenerating(false);
    }
  }

  async function createButtonFromSelected() {
    if (!selectedAsset) return;
    if (!canCreateButton) {
      setMessage("No tienes permisos para convertir el audio en botón permanente.");
      return;
    }

    if (!buttonForm.label.trim() || !buttonForm.categoryId) {
      setMessage("Completa el nombre y la categoría antes de crear el botón.");
      return;
    }

    setCreatingButton(true);
    setMessage(null);
    try {
      const result = await api(`/audio-generation/${selectedAsset.id}/create-button`, {
        method: "POST",
        body: JSON.stringify({
          label: buttonForm.label,
          categoryId: buttonForm.categoryId,
          description: buttonForm.description,
          color: buttonForm.color,
          shortcutKey: buttonForm.shortcutKey,
          sortOrder: buttonForm.sortOrder ? Number(buttonForm.sortOrder) : undefined,
        }),
      });
      setSelectedAsset((current) =>
        current
          ? {
              ...current,
              lifecycleStatus: "PERSISTED",
              autoCreatedButtonId: (result as { id?: string }).id ?? current.autoCreatedButtonId,
            }
          : current,
      );
      setMessage("El audio quedó convertido en botón permanente.");
      void Promise.all([loadLibrary(), loadJobs()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo convertir el audio en botón.");
    } finally {
      setCreatingButton(false);
    }
  }

  async function deleteSelectedAsset() {
    if (!selectedAsset) return;
    if (selectedAsset.lifecycleStatus !== "TEMPORARY") {
      setMessage("Solo puedes eliminar audios temporales desde aquí.");
      return;
    }

    setMessage(null);
    try {
      await api(`/audio-generation/${selectedAsset.id}`, {
        method: "DELETE",
      });
      setSelectedAsset(null);
      setSelectedJob(null);
      setMessage("El audio temporal se eliminó correctamente.");
      void Promise.all([loadLibrary(), loadJobs()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el audio.");
    }
  }

  async function retryJob(job: AudioGenerationJob) {
    setMessage(null);
    try {
      const result = await api<GenerateResponse>(`/audio-generation/${job.id}/retry`, {
        method: "POST",
        body: JSON.stringify({
          text: job.normalizedText,
          voiceId: job.voiceId,
          modelId: job.modelId,
          outputFormat: job.outputFormat,
          stability: job.stability,
          similarityBoost: job.similarityBoost,
          style: job.style,
          speed: job.speed,
          speakerBoost: job.speakerBoost,
        }),
      });

      setSelectedAsset(result.asset);
      setSelectedJob(result.job);
      setMessage("Se reintentó la generación correctamente.");
      void Promise.all([loadLibrary(), loadJobs()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo reintentar la generación.");
    }
  }

  async function playSelected() {
    if (!selectedAsset) return;
    try {
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      if (playbackObjectUrlRef.current) {
        URL.revokeObjectURL(playbackObjectUrlRef.current);
        playbackObjectUrlRef.current = null;
      }

      const response = await fetch(apiUrl(`/audio-assets/${selectedAsset.id}/stream`), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("No se pudo cargar el audio para reproducirlo.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      playbackObjectUrlRef.current = objectUrl;
      audio.src = objectUrl;
      audio.preload = "auto";
      audio.onended = () => setIsPlaying(false);
      audio.onpause = () => setIsPlaying(false);
      audio.onplay = () => setIsPlaying(true);
      audio.load();

      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (error) {
      setIsPlaying(false);
      setMessage(error instanceof Error ? error.message : "No se pudo reproducir el audio.");
    }
  }

  function stopAudio() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    if (playbackObjectUrlRef.current) {
      URL.revokeObjectURL(playbackObjectUrlRef.current);
      playbackObjectUrlRef.current = null;
    }
  }

  function reuseAsset(item: AudioGenerationLibraryItem) {
    setText(item.generatedText ?? item.transcript ?? item.originalName);
    setVoiceId(item.generatedVoiceId ?? voiceId);
    setModelId(item.generatedModelId ?? modelId);
    setOutputFormat(item.generatedOutputFormat ?? outputFormat);
    setSelectedAsset(item);
    setButtonForm((current) => ({
      ...current,
      label: item.originalName,
      description: item.generatedText ?? item.transcript ?? current.description,
    }));
    setMessage("Texto y parámetros cargados para reutilizar este audio.");
  }

  async function refreshAll() {
    setLoading(true);
    await Promise.all([loadLibrary(), loadJobs()]);
    setLoading(false);
  }

  return (
    <ProtectedPage requiredPermissions={["audio:generate"]}>
      <div className="space-y-6">
        <PageHeader
          title="Audio IA"
          description="Genera audios con ElevenLabs, escúchalos al instante y decide si convertirlos en botón permanente."
          action={
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
            >
              <RefreshCw className="h-4 w-4" />
              Refrescar
            </button>
          }
        />

        {message ? (
          <div className="rounded-[24px] border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
            {message}
          </div>
        ) : null}

        {integrationError ? (
          <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {integrationError}
          </div>
        ) : null}
        {!integrationError && categoryError ? (
          <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {categoryError === "Forbidden resource"
              ? "No tienes acceso a categorías. Puedes generar audio, pero no convertirlo en botón sin ese permiso."
              : categoryError}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
          <section className="space-y-6">
            <form
              onSubmit={generate}
              className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-on-surface-variant">Composer</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-on-surface">
                    Texto, voz y parámetros
                  </h2>
                </div>
                <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {selectedVoice ? selectedVoice.name : "Sin voz"}
                </span>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                    Texto libre
                  </span>
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    className="min-h-40 rounded-[22px] border border-outline-variant bg-surface px-4 py-3 text-sm leading-6 text-on-surface outline-none transition-colors focus:border-primary"
                    placeholder="Escribe aquí el texto que se convertirá en audio..."
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,.9fr)]">
                  <label className="grid min-w-0 gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                      Voz ElevenLabs
                    </span>
                    <select
                      value={voiceId}
                      onChange={(event) => setVoiceId(event.target.value)}
                      className="h-11 w-full min-w-0 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none transition-colors focus:border-primary"
                      disabled={!voices.length}
                    >
                      {!voices.length ? <option value="">Sin voces disponibles</option> : null}
                      {voices.map((voice) => (
                        <option key={voice.voiceId} value={voice.voiceId}>
                          {voice.name} {voice.category ? `· ${voice.category}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid min-w-0 gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                      Modelo
                    </span>
                    <select
                      value={modelId}
                      onChange={(event) => setModelId(event.target.value)}
                      className="h-11 w-full min-w-0 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none transition-colors focus:border-primary"
                      disabled={!models.length}
                    >
                      {!models.length ? <option value="">Sin modelos disponibles</option> : null}
                      {models.map((model) => (
                        <option key={model.modelId} value={model.modelId}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid min-w-0 gap-1.5 md:col-span-2 xl:col-span-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                      Formato
                    </span>
                    <select
                      value={outputFormat}
                      onChange={(event) => setOutputFormat(event.target.value)}
                      className="h-11 w-full min-w-0 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none transition-colors focus:border-primary"
                    >
                      <option value="mp3_44100_128">mp3_44100_128</option>
                      <option value="mp3_44100_192">mp3_44100_192</option>
                      <option value="mp3_22050_32">mp3_22050_32</option>
                      <option value="wav_44100">wav_44100</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SliderField label="Stability" value={stability} onChange={setStability} />
                  <SliderField label="Similarity" value={similarityBoost} onChange={setSimilarityBoost} />
                  <SliderField label="Style" value={style} onChange={setStyle} />
                  <SliderField label="Speed" value={speed} onChange={setSpeed} min={0.7} max={1.2} step={0.01} />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSpeakerBoost((current) => !current)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      speakerBoost
                        ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-200"
                        : "border-outline-variant bg-surface text-on-surface-variant"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Speaker boost {speakerBoost ? "activado" : "desactivado"}
                  </button>

                  {canCreateButton ? (
                    <button
                      type="button"
                      onClick={() => setCreateButton((current) => !current)}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        createButton
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-outline-variant bg-surface text-on-surface-variant"
                      }`}
                    >
                      <Wand2 className="h-4 w-4" />
                      {createButton ? "Crear botón al generar" : "Convertir en botón al generar"}
                    </button>
                  ) : (
                    <span className="rounded-full border border-outline-variant bg-surface px-4 py-2 text-sm text-on-surface-variant">
                      Solo el admin puede crear botones permanentes
                    </span>
                  )}

                  <button
                    type="submit"
                    disabled={generating || !voices.length || !models.length || !text.trim()}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {generating ? "Generando..." : "Generar audio"}
                  </button>
                </div>
              </div>
            </form>

            <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-on-surface-variant">Biblioteca IA</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-on-surface">
                    Audios generados
                  </h2>
                </div>
                <span className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-xs font-medium text-on-surface-variant">
                  {filteredLibrary.length} audios
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por texto, voz o modelo..."
                  className="h-11 w-full rounded-2xl border border-outline-variant bg-surface px-4 text-sm outline-none transition-colors focus:border-primary"
                />

                <div className="flex flex-wrap gap-2">
                  {(["all", "TEMPORARY", "PERSISTED"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLifecycleFilter(value)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        lifecycleFilter === value
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-outline-variant bg-surface text-on-surface-variant"
                      }`}
                    >
                      {value === "all" ? "Todos" : value === "TEMPORARY" ? "Temporales" : "Persistentes"}
                    </button>
                  ))}
                </div>
              </div>

              {loading && !library.length ? (
                <div className="mt-5">
                  <DataState>Cargando biblioteca de audios IA...</DataState>
                </div>
              ) : filteredLibrary.length > 0 ? (
                <div className="mt-5 max-h-[560px] overflow-y-auto pr-1">
                  <div className="grid gap-3">
                    {filteredLibrary.map((item) => (
                      <article
                        key={item.id}
                        className={`rounded-[22px] border p-4 transition-colors ${
                          selectedAsset?.id === item.id
                            ? "border-primary/40 bg-primary/10"
                            : "border-outline-variant bg-surface hover:bg-surface-container-high"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-on-surface">{item.originalName}</p>
                            <p className="mt-1 text-xs text-on-surface-variant">
                              {item.generatedVoiceName ?? item.generatedVoiceId ?? "Voz desconocida"} ·{" "}
                              {item.generatedModelId ?? "Modelo desconocido"}
                            </p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            item.lifecycleStatus === "PERSISTED"
                              ? "border border-emerald-300/30 bg-emerald-500/10 text-emerald-200"
                              : "border border-amber-300/30 bg-amber-500/10 text-amber-200"
                          }`}>
                            {item.lifecycleStatus === "PERSISTED" ? "Persistente" : "Temporal"}
                          </span>
                        </div>

                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-on-surface-variant">
                          {item.generatedText ?? item.transcript ?? "Sin texto original"}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAsset(item);
                              setSelectedJob(
                                jobs.find((job) => job.audioAssetId === item.id) ?? null,
                              );
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Abrir
                          </button>
                          <button
                            type="button"
                            onClick={() => reuseAsset(item)}
                            className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Reutilizar
                          </button>
                          <a
                            href={item.audioDownloadUrl}
                            className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Descargar
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <DataState>No hay audios IA todavía.</DataState>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-on-surface-variant">Resultado</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-on-surface">
                    Audio listo para usar
                  </h2>
                </div>
                <span className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-xs font-medium text-on-surface-variant">
                  {selectedAsset ? selectedAsset.lifecycleStatus : "Sin audio"}
                </span>
              </div>

              {selectedAsset ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-[24px] border border-outline-variant bg-surface p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Reproductor</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void playSelected()}
                        className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:brightness-110"
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {isPlaying ? "Pausar" : "Reproducir"}
                      </button>
                      <button
                        type="button"
                        onClick={stopAudio}
                        className="inline-flex h-11 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
                      >
                        <Square className="h-4 w-4" />
                        Detener
                      </button>
                      <a
                        href={selectedAsset.audioDownloadUrl}
                        className="inline-flex h-11 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
                      >
                        <Download className="h-4 w-4" />
                        Descargar
                      </a>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-outline-variant bg-surface p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Texto original</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-on-surface">
                      {selectedAsset.generatedText ?? selectedAsset.transcript ?? "Sin texto original"}
                    </p>
                  </div>

                  <div className="grid gap-2 rounded-[24px] border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
                    <InfoRow label="Voz" value={selectedAsset.generatedVoiceName ?? selectedAsset.generatedVoiceId ?? "N/D"} />
                    <InfoRow label="Modelo" value={selectedAsset.generatedModelId ?? "N/D"} />
                    <InfoRow label="Formato" value={selectedAsset.generatedOutputFormat ?? "N/D"} />
                    <InfoRow label="Tamaño" value={formatBytes(selectedAsset.sizeBytes)} />
                    <InfoRow label="Creado" value={new Date(selectedAsset.createdAt).toLocaleString("es-CO")} />
                    <InfoRow label="Expira" value={selectedAsset.expiresAt ? new Date(selectedAsset.expiresAt).toLocaleString("es-CO") : "No aplica"} />
                  </div>

                  <div className="rounded-[24px] border border-amber-300/20 bg-amber-500/10 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-100">Ciclo de vida temporal</p>
                    <p className="mt-2 text-sm leading-6 text-amber-50/90">
                      {selectedAsset.lifecycleStatus === "TEMPORARY"
                        ? "Este audio se eliminará automáticamente en 48 horas si no lo conviertes en botón."
                        : "Este audio ya quedó persistente porque fue convertido en botón o marcado como definitivo."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedJob?.status === "FAILED" ? (
                      <button
                        type="button"
                        onClick={() => void retryJob(selectedJob)}
                        className="inline-flex h-11 items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-4 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-500/20"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Reintentar generación
                      </button>
                    ) : null}
                    {selectedAsset.lifecycleStatus === "TEMPORARY" ? (
                      <button
                        type="button"
                        onClick={() => void deleteSelectedAsset()}
                        className="inline-flex h-11 items-center gap-2 rounded-full border border-rose-300/20 bg-rose-500/10 px-4 text-sm font-semibold text-rose-100 transition-colors hover:bg-rose-500/20"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar temporal
                      </button>
                    ) : null}
                  </div>

                  {canCreateButton ? (
                    <div className="rounded-[24px] border border-outline-variant bg-surface p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Convertir a botón</p>
                      <div className="mt-4 grid gap-3">
                        <input
                          value={buttonForm.label}
                          onChange={(event) => setButtonForm((current) => ({ ...current, label: event.target.value }))}
                          placeholder="Nombre del botón"
                          className="h-11 rounded-2xl border border-outline-variant bg-surface-container px-3 text-sm outline-none transition-colors focus:border-primary"
                        />
                        <select
                          value={buttonForm.categoryId}
                          onChange={(event) => setButtonForm((current) => ({ ...current, categoryId: event.target.value }))}
                          className="h-11 rounded-2xl border border-outline-variant bg-surface-container px-3 text-sm outline-none transition-colors focus:border-primary"
                        >
                          {!categories.length ? <option value="">Sin categorías</option> : null}
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={creatingButton}
                          onClick={() => void createButtonFromSelected()}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {creatingButton ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                          Crear botón permanente
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4">
                  <DataState>Genera un audio para ver su resultado aquí.</DataState>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-on-surface-variant">Historial</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-on-surface">
                    Últimas generaciones
                  </h2>
                </div>
                <span className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-xs font-medium text-on-surface-variant">
                  {jobs.length} jobs
                </span>
              </div>

              <div className="mt-4">
                <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
                  {jobs.length > 0 ? (
                    jobs.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => {
                          if (job.asset) {
                            setSelectedAsset(job.asset);
                          }
                          setSelectedJob(job);
                        }}
                        className={`w-full rounded-[22px] border px-4 py-3 text-left transition-colors ${
                          selectedJob?.id === job.id
                            ? "border-primary/40 bg-primary/10"
                            : "border-outline-variant bg-surface hover:bg-surface-container-high"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-on-surface">
                              {job.voiceName ?? job.voiceId}
                            </p>
                            <p className="mt-1 text-xs text-on-surface-variant">
                              {job.modelId} · {new Date(job.createdAt).toLocaleString("es-CO")}
                            </p>
                          </div>
                          <span className="rounded-full border border-outline-variant bg-surface-container px-2.5 py-1 text-[10px] font-semibold text-on-surface-variant">
                            {job.status}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">
                          {job.normalizedText}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {job.status === "FAILED" ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void retryJob(job);
                              }}
                              className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-500/20"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Reintentar
                            </button>
                          ) : null}
                          {job.asset ? (
                            <span className="rounded-full border border-outline-variant bg-surface-container px-2.5 py-1 text-[10px] font-semibold text-on-surface-variant">
                              {job.asset.lifecycleStatus === "TEMPORARY" ? "Temporal" : "Persistente"}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))
                  ) : (
                  <DataState>Aún no has generado audios IA.</DataState>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </ProtectedPage>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
        {label}
      </span>
      <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full accent-primary"
        />
      </div>
      <span className="text-xs text-on-surface-variant">
        {value.toFixed(step < 0.1 ? 2 : 1)}
      </span>
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-high px-3 py-2.5">
      <span className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">{label}</span>
      <span className="max-w-[55%] truncate text-sm font-medium text-on-surface">{value}</span>
    </div>
  );
}
