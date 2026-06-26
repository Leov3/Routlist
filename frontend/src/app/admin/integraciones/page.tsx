"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, PlugZap, RefreshCw, ShieldAlert, Sparkles, ToggleLeft } from "lucide-react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { FilterBar } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { api } from "@/lib/api";

type ConnectionStatus = "not_configured" | "pending" | "connected" | "error" | "inactive";

type ElevenLabsSettings = {
  isActive: boolean;
  connectionStatus: ConnectionStatus;
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
  baseUrl: string;
  defaultVoiceId: string | null;
  defaultModelId: string;
  defaultOutputFormat: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
  speakerBoost: boolean;
  lastTestAt: string | null;
  lastTestMessage: string | null;
};

type ElevenLabsVoice = {
  voiceId: string;
  name: string;
  category?: string | null;
  previewUrl?: string | null;
  labels?: Record<string, string> | null;
};

type ElevenLabsModel = {
  modelId: string;
  name: string;
  description?: string | null;
  languages?: string[] | null;
};

type ElevenLabsVoiceList = {
  voices: ElevenLabsVoice[];
  nextPageToken: string | null;
  totalCount: number | null;
};

type ElevenLabsModelList = {
  models: ElevenLabsModel[];
};

type ElevenLabsTestResponse = {
  connectionStatus: ConnectionStatus;
  message: string;
  checkedAt: string;
};

type ElevenLabsPreviewResponse = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  audioBase64: string;
};

type SettingsForm = {
  isActive: boolean;
  apiKey: string;
  baseUrl: string;
  defaultVoiceId: string;
  defaultModelId: string;
  defaultOutputFormat: string;
  stability: string;
  similarityBoost: string;
  style: string;
  speed: string;
  speakerBoost: boolean;
  sampleText: string;
};

const DEFAULT_FORM: SettingsForm = {
  isActive: true,
  apiKey: "",
  baseUrl: "https://api.elevenlabs.io",
  defaultVoiceId: "",
  defaultModelId: "eleven_multilingual_v2",
  defaultOutputFormat: "mp3_44100_128",
  stability: "0.5",
  similarityBoost: "0.75",
  style: "0",
  speed: "1",
  speakerBoost: true,
  sampleText: "Hola, esta es una prueba de integración de ElevenLabs en Routlis.",
};

const OUTPUT_FORMAT_OPTIONS = [
  "mp3_44100_128",
  "mp3_22050_32",
  "wav_44100",
  "wav_22050",
  "pcm_44100",
];

export default function IntegrationsSettingsPage() {
  const [settings, setSettings] = useState<ElevenLabsSettings | null>(null);
  const [form, setForm] = useState<SettingsForm>(DEFAULT_FORM);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [models, setModels] = useState<ElevenLabsModel[]>([]);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [voiceLanguageFilter, setVoiceLanguageFilter] = useState("all");
  const [voiceCategoryFilter, setVoiceCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settingsResult = await api<ElevenLabsSettings>("/integrations/elevenlabs/settings");
      setSettings(settingsResult);
      setForm((current) => ({
        ...current,
        isActive: settingsResult.isActive,
        baseUrl: settingsResult.baseUrl,
        defaultVoiceId: settingsResult.defaultVoiceId ?? "",
        defaultModelId: settingsResult.defaultModelId,
        defaultOutputFormat: settingsResult.defaultOutputFormat,
        stability: String(settingsResult.stability),
        similarityBoost: String(settingsResult.similarityBoost),
        style: String(settingsResult.style),
        speed: String(settingsResult.speed),
        speakerBoost: settingsResult.speakerBoost,
      }));

      if (settingsResult.apiKeyConfigured) {
        await Promise.all([loadVoices(), loadModels()]);
      } else {
        setVoices([]);
        setModels([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la integración.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadVoices() {
    setLoadingVoices(true);
    setError(null);
    try {
      const result = await api<ElevenLabsVoiceList>("/integrations/elevenlabs/voices");
      setVoices(result.voices);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron sincronizar las voces.");
    } finally {
      setLoadingVoices(false);
    }
  }

  async function loadModels() {
    setLoadingVoices(true);
    setError(null);
    try {
      const result = await api<ElevenLabsModelList>("/integrations/elevenlabs/models");
      setModels(result.models);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron sincronizar los modelos.");
    } finally {
      setLoadingVoices(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  const connectionColor = useMemo(() => {
    const status = settings?.connectionStatus ?? "not_configured";
    if (status === "connected") return "success-surface";
    if (status === "error") return "danger-surface";
    if (status === "pending") return "warning-surface";
    if (status === "inactive") return "text-on-surface-variant bg-outline-variant/30";
    return "text-on-surface-variant bg-outline-variant/30";
  }, [settings?.connectionStatus]);

  const connectionLabel = useMemo(() => {
    const status = settings?.connectionStatus ?? "not_configured";
    if (status === "connected") return "Conectada";
    if (status === "error") return "Error";
    if (status === "pending") return "Pendiente";
    if (status === "inactive") return "Inactiva";
    return "No configurada";
  }, [settings?.connectionStatus]);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.voiceId === form.defaultVoiceId) ?? voices[0] ?? null,
    [voices, form.defaultVoiceId],
  );

  const voiceLanguageOptions = useMemo(() => {
    const values = new Set<string>();
    for (const voice of voices) {
      const language = readVoiceLanguage(voice);
      if (language) values.add(language);
    }

    return [
      { value: "all", label: "Todos" },
      ...Array.from(values)
        .sort((left, right) => left.localeCompare(right))
        .map((value) => ({ value, label: value })),
    ];
  }, [voices]);

  const voiceCategoryOptions = useMemo(() => {
    const values = new Set<string>();
    for (const voice of voices) {
      const category = readVoiceCategory(voice);
      if (category) values.add(category);
    }

    return [
      { value: "all", label: "Todas" },
      ...Array.from(values)
        .sort((left, right) => left.localeCompare(right))
        .map((value) => ({ value, label: value })),
    ];
  }, [voices]);

  const filteredVoices = useMemo(() => {
    const term = voiceSearch.trim().toLowerCase();

    return voices.filter((voice) => {
      const language = readVoiceLanguage(voice);
      const category = readVoiceCategory(voice);
      const haystack = [
        voice.name,
        voice.voiceId,
        language,
        category,
        voice.labels ? Object.values(voice.labels).join(" ") : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !term || haystack.includes(term);
      const matchesLanguage =
        voiceLanguageFilter === "all" ||
        (language && normalizeVoiceFacet(language) === normalizeVoiceFacet(voiceLanguageFilter));
      const matchesCategory =
        voiceCategoryFilter === "all" ||
        (category && normalizeVoiceFacet(category) === normalizeVoiceFacet(voiceCategoryFilter));

      return matchesSearch && matchesLanguage && matchesCategory;
    });
  }, [voices, voiceSearch, voiceLanguageFilter, voiceCategoryFilter]);

  function updateField<K extends keyof SettingsForm>(field: K, value: SettingsForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function buildPayload(includeApiKey = true) {
    const payload: Record<string, unknown> = {
      isActive: form.isActive,
      baseUrl: form.baseUrl,
      defaultVoiceId: form.defaultVoiceId || null,
      defaultModelId: form.defaultModelId,
      defaultOutputFormat: form.defaultOutputFormat,
      stability: Number(form.stability),
      similarityBoost: Number(form.similarityBoost),
      style: Number(form.style),
      speed: Number(form.speed),
      speakerBoost: form.speakerBoost,
    };

    if (includeApiKey && form.apiKey.trim()) {
      payload.apiKey = form.apiKey.trim();
    }

    return payload;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const result = await api<ElevenLabsSettings>("/integrations/elevenlabs/settings", {
        method: "PATCH",
        body: JSON.stringify(buildPayload(true)),
      });
      setSettings(result);
      setForm((current) => ({
        ...current,
        apiKey: "",
        isActive: result.isActive,
        baseUrl: result.baseUrl,
        defaultVoiceId: result.defaultVoiceId ?? "",
        defaultModelId: result.defaultModelId,
        defaultOutputFormat: result.defaultOutputFormat,
        stability: String(result.stability),
        similarityBoost: String(result.similarityBoost),
        style: String(result.style),
        speed: String(result.speed),
        speakerBoost: result.speakerBoost,
      }));
      setFeedback("Configuración guardada.");
      if (result.apiKeyConfigured) {
        await loadVoices();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la integración.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setFeedback(null);
    setError(null);
    try {
      const hasDraftChanges =
        !settings ||
        form.isActive !== settings.isActive ||
        form.baseUrl !== settings.baseUrl ||
        form.defaultVoiceId !== (settings.defaultVoiceId ?? "") ||
        form.defaultModelId !== settings.defaultModelId ||
        form.defaultOutputFormat !== settings.defaultOutputFormat ||
        Number(form.stability) !== settings.stability ||
        Number(form.similarityBoost) !== settings.similarityBoost ||
        Number(form.style) !== settings.style ||
        Number(form.speed) !== settings.speed ||
        form.speakerBoost !== settings.speakerBoost ||
        Boolean(form.apiKey.trim());

      const result = await api<ElevenLabsTestResponse>("/integrations/elevenlabs/test", {
        method: "POST",
        body: hasDraftChanges ? JSON.stringify(buildPayload(true)) : undefined,
      });
      setFeedback(`${result.message} · ${new Date(result.checkedAt).toLocaleString()}`);
      if (settings) {
        setSettings((current) =>
          current
            ? {
                ...current,
                connectionStatus: result.connectionStatus,
                lastTestAt: result.checkedAt,
                lastTestMessage: result.message,
              }
            : current,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo probar la conexión.");
    } finally {
      setTesting(false);
    }
  }

  async function handleSyncVoices() {
    setLoadingVoices(true);
    setFeedback(null);
    setError(null);
    try {
      await loadVoices();
      setFeedback("Voces sincronizadas.");
    } finally {
      setLoadingVoices(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setFeedback(null);
    setError(null);
    try {
      await api("/integrations/elevenlabs/settings", { method: "DELETE" });
      setSettings(null);
      setVoices([]);
      setModels([]);
      setForm(DEFAULT_FORM);
      setPreviewUrl(null);
      setPreviewLabel(null);
      setFeedback("Integración desconectada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desconectar la integración.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleGeneratePreview() {
    setGenerating(true);
    setFeedback(null);
    setError(null);
    try {
      const result = await api<ElevenLabsPreviewResponse>("/integrations/elevenlabs/generate-test", {
        method: "POST",
        body: JSON.stringify({
          ...buildPayload(true),
          text: form.sampleText,
          defaultVoiceId: form.defaultVoiceId || selectedVoice?.voiceId || null,
        }),
      });
      setPreviewUrl(`data:${result.contentType};base64,${result.audioBase64}`);
      setPreviewLabel(result.fileName);
      setFeedback(`Audio de prueba generado (${Math.round(result.sizeBytes / 1024)} KB).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el audio de prueba.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AdminProtectedPage>
      <PageHeader
        title="Integraciones"
        description="Configura ElevenLabs por organización para pruebas y futuras generaciones de audio."
      />

      {loading ? (
        <DataState>Cargando integración ElevenLabs...</DataState>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
          <form
            onSubmit={(event) => void handleSave(event)}
            className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1 sm:p-5"
          >
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface-variant">
                  <PlugZap className="h-3.5 w-3.5" />
                  ElevenLabs
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-on-surface sm:text-2xl">
                  Integración de texto a voz
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                  La API key se guarda cifrada en backend, scoped por organización. El frontend nunca recibe la clave completa.
                </p>
              </div>

              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${connectionColor}`}>
                <span className="h-2 w-2 rounded-full bg-current" />
                {connectionLabel}
              </div>
            </div>

            {error ? (
              <div className="danger-surface mb-4 flex items-start gap-3 rounded-2xl p-4 text-sm">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {feedback ? (
              <div className="success-surface mb-4 flex items-start gap-3 rounded-2xl p-4 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{feedback}</span>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Estado de integración" hint="Activa o inactiva según el switch principal.">
                <button
                  type="button"
                  onClick={() => updateField("isActive", !form.isActive)}
                  className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
                    form.isActive
                      ? "success-surface"
                      : "border-outline-variant bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  <ToggleLeft className="h-4 w-4" />
                  {form.isActive ? "Activa" : "Inactiva"}
                </button>
              </Field>

              <Field
                label="Última prueba"
                hint={settings?.lastTestAt ? new Date(settings.lastTestAt).toLocaleString() : "Sin pruebas registradas"}
              >
                <div className="rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface">
                  {settings?.lastTestMessage ?? "Pendiente de validación"}
                </div>
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="API Key" hint={settings?.apiKeyConfigured ? `Guardada como ${settings.apiKeyMasked ?? "••••"}. Déjala vacía para conservarla.` : "Requerida para configurar la integración."}>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(event) => updateField("apiKey", event.target.value)}
                  placeholder={settings?.apiKeyConfigured ? settings.apiKeyMasked ?? "••••" : "Ingrese la API Key"}
                  className="h-11 w-full rounded-2xl border border-outline-variant bg-surface-container-high px-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none"
                />
              </Field>

              <Field label="Base URL" hint="Por defecto apunta a api.elevenlabs.io.">
                <input
                  type="url"
                  value={form.baseUrl}
                  onChange={(event) => updateField("baseUrl", event.target.value)}
                  className="h-11 w-full rounded-2xl border border-outline-variant bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Voice ID por defecto">
                <select
                  value={form.defaultVoiceId}
                  onChange={(event) => updateField("defaultVoiceId", event.target.value)}
                  className="h-11 w-full rounded-2xl border border-outline-variant bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary focus:outline-none"
                >
                  <option value="">Seleccionar voz</option>
                  {voices.map((voice) => (
                    <option key={voice.voiceId} value={voice.voiceId}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Model ID por defecto">
                {models.length > 0 ? (
                  <select
                    value={form.defaultModelId}
                    onChange={(event) => updateField("defaultModelId", event.target.value)}
                    className="h-11 w-full rounded-2xl border border-outline-variant bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary focus:outline-none"
                  >
                    <option value="">Seleccionar modelo</option>
                    {models.map((model) => (
                      <option key={model.modelId} value={model.modelId}>
                        {model.name} {model.languages?.length ? `· ${model.languages.join(", ")}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.defaultModelId}
                    onChange={(event) => updateField("defaultModelId", event.target.value)}
                    placeholder="eleven_multilingual_v2"
                    className="h-11 w-full rounded-2xl border border-outline-variant bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary focus:outline-none"
                  />
                )}
              </Field>

              <Field label="Formato de salida">
                <select
                  value={form.defaultOutputFormat}
                  onChange={(event) => updateField("defaultOutputFormat", event.target.value)}
                  className="h-11 w-full rounded-2xl border border-outline-variant bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary focus:outline-none"
                >
                  {OUTPUT_FORMAT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Speaker boost">
                <button
                  type="button"
                  onClick={() => updateField("speakerBoost", !form.speakerBoost)}
                  className={`inline-flex h-11 w-full items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition-colors ${
                    form.speakerBoost
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-outline-variant bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {form.speakerBoost ? "Activado" : "Desactivado"}
                </button>
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Stability">
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={form.stability}
                  onChange={(event) => updateField("stability", event.target.value)}
                  className="h-11 w-full rounded-2xl border border-outline-variant bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </Field>

              <Field label="Similarity boost">
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={form.similarityBoost}
                  onChange={(event) => updateField("similarityBoost", event.target.value)}
                  className="h-11 w-full rounded-2xl border border-outline-variant bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </Field>

              <Field label="Style">
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={form.style}
                  onChange={(event) => updateField("style", event.target.value)}
                  className="h-11 w-full rounded-2xl border border-outline-variant bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </Field>

              <Field label="Speed">
                <input
                  type="number"
                  min="0.7"
                  max="1.2"
                  step="0.01"
                  value={form.speed}
                  onChange={(event) => updateField("speed", event.target.value)}
                  className="h-11 w-full rounded-2xl border border-outline-variant bg-surface-container-high px-4 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </Field>
            </div>

            <Field
              className="mt-4"
              label="Texto de prueba"
              hint="Este texto se usa solo para la generación de audio de prueba."
            >
              <textarea
                value={form.sampleText}
                onChange={(event) => updateField("sampleText", event.target.value)}
                rows={4}
                className="min-h-28 w-full rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </Field>

            <div className="mt-4 rounded-[24px] border border-outline-variant bg-surface-container p-4">
              <div className="mb-3">
                <h3 className="text-base font-semibold tracking-tight text-on-surface">
                  Vista previa de audio
                </h3>
                <p className="text-sm text-on-surface-variant">
                  Reproduce aquí el último audio generado sin salir del formulario.
                </p>
              </div>

              {previewUrl ? (
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-3 text-xs text-on-surface-variant">
                    {previewLabel}
                  </div>
                  <audio controls src={previewUrl} className="w-full" />
                </div>
              ) : (
                <DataState>Genera un audio de prueba para previsualizarlo aquí.</DataState>
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:flex sm:items-center sm:justify-between">
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary shadow-elevation-1 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleTestConnection()}
                  disabled={testing}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-outline-variant bg-surface-container px-5 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Probar conexión
                </button>
                <button
                  type="button"
                  onClick={() => void handleGeneratePreview()}
                  disabled={generating || loadingVoices}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-outline-variant bg-surface-container px-5 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Generar audio de prueba
                </button>
              </div>

              <button
                type="button"
                onClick={() => void handleDisconnect()}
                disabled={disconnecting}
                className="danger-surface-strong inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {disconnecting ? "Desconectando..." : "Desconectar"}
              </button>
            </div>
          </form>

          <aside className="grid gap-5 self-start">
            <div className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-on-surface">
                    Conexión y estado
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Vista rápida de la integración guardada para esta organización.
                  </p>
                </div>
                <AlertTriangle className="h-5 w-5 text-on-surface-variant" />
              </div>

              <div className="grid gap-3">
                <InfoRow label="Organización" value={settings?.isActive ? "Activa" : "Inactiva"} />
                <InfoRow label="Conexión" value={connectionLabel} />
                <InfoRow label="API key" value={settings?.apiKeyConfigured ? settings.apiKeyMasked ?? "••••" : "No configurada"} />
                <InfoRow label="Modelo" value={settings?.defaultModelId ?? "eleven_multilingual_v2"} />
                <InfoRow label="Formato" value={settings?.defaultOutputFormat ?? "mp3_44100_128"} />
                <InfoRow label="Voz" value={selectedVoice?.name ?? settings?.defaultVoiceId ?? "Sin voz"} />
              </div>
            </div>

            <div className="flex max-h-[60vh] flex-col rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1 sm:max-h-[72vh] sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-on-surface">
                    Voces disponibles
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Sincroniza la biblioteca de voces de ElevenLabs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSyncVoices()}
                  disabled={loadingVoices}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-3 text-xs font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingVoices ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Sincronizar
                </button>
              </div>

              <div className="mb-4 grid gap-3">
                <SearchBar
                  value={voiceSearch}
                  onChange={setVoiceSearch}
                  placeholder="Buscar por nombre, idioma o ID..."
                />
                <div className="grid gap-3">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                      Idioma
                    </p>
                    <FilterBar
                      value={voiceLanguageFilter}
                      onChange={setVoiceLanguageFilter}
                      options={voiceLanguageOptions}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                      Categoria
                    </p>
                    <FilterBar
                      value={voiceCategoryFilter}
                      onChange={setVoiceCategoryFilter}
                      options={voiceCategoryOptions}
                    />
                  </div>
                </div>
              </div>

              <div className="mb-3 rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-3 text-xs text-on-surface-variant">
                {filteredVoices.length} de {voices.length} voces visibles
                {settings?.lastTestAt ? ` · última prueba ${new Date(settings.lastTestAt).toLocaleString()}` : ""}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {voices.length === 0 ? (
                  <DataState>No hay voces sincronizadas todavía.</DataState>
                ) : filteredVoices.length === 0 ? (
                  <DataState>No hay voces que coincidan con los filtros actuales.</DataState>
                ) : (
                  <div className="grid gap-2">
                    {filteredVoices.map((voice) => (
                    <button
                      key={voice.voiceId}
                      type="button"
                      onClick={() => updateField("defaultVoiceId", voice.voiceId)}
                      className={`rounded-2xl border px-3 py-3 text-left transition-colors sm:px-4 ${
                        form.defaultVoiceId === voice.voiceId
                          ? "border-primary/40 bg-primary/10"
                          : "border-outline-variant bg-surface-container-high hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-on-surface">{voice.name}</p>
                            <p className="text-xs text-on-surface-variant">
                              {readVoiceLanguage(voice) ?? "Idioma no declarado"} · {readVoiceCategory(voice) ?? "Sin categoría"}
                            </p>
                            <p className="mt-1 text-[11px] text-on-surface-variant/80">
                              {voice.voiceId}
                            </p>
                          </div>
                          {form.defaultVoiceId === voice.voiceId ? (
                            <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-on-primary">
                              Predeterminada
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </aside>
        </div>
      )}
    </AdminProtectedPage>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${className ?? ""}`}>
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-2 block text-xs text-on-surface-variant">{hint}</span> : null}
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
        {label}
      </span>
      <span className="max-w-full truncate text-sm font-medium text-on-surface sm:max-w-[220px]">{value}</span>
    </div>
  );
}

function readVoiceLanguage(voice: ElevenLabsVoice) {
  return (
    voice.labels?.language?.trim() ||
    voice.labels?.locale?.trim() ||
    voice.labels?.accent?.trim() ||
    null
  );
}

function readVoiceCategory(voice: ElevenLabsVoice) {
  return voice.category?.trim() || voice.labels?.category?.trim() || null;
}

function normalizeVoiceFacet(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}
