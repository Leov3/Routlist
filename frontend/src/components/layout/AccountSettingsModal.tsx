"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  Check,
  MonitorSmartphone,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Sun,
  UserCircle2,
  Waves,
  Workflow,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { AudioGenerationPreferences, AuthUser, BoardPreferences } from "@/types/routlis";

type ThemeMode = "system" | "light" | "dark";
type DensityMode = "comfortable" | "compact";
type QuickSection = "board" | "audio" | "narratives";
type AudioLookup = {
  voices: Array<{ voiceId: string; name: string; category?: string | null }>;
  models: Array<{ modelId: string; name: string }>;
};
type AudioLookupResponse = {
  voices?: AudioLookup["voices"];
  models?: AudioLookup["models"];
};
type NarrativePrefs = {
  playerDistance?: string;
  playerViewMode?: "simple" | "dual";
};

type AccountSettingsModalProps = {
  user: AuthUser;
  open: boolean;
  theme: ThemeMode | undefined;
  setTheme: (theme: ThemeMode) => void;
  density: DensityMode;
  setDensity: (value: DensityMode) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  onClose: () => void;
};

const BOARD_DENSITY_KEY = "routlis.board.density";

export function AccountSettingsModal({
  user,
  open,
  theme,
  setTheme,
  density,
  setDensity,
  sidebarCollapsed,
  setSidebarCollapsed,
  onClose,
}: AccountSettingsModalProps) {
  const [section, setSection] = useState<QuickSection>("board");
  const [boardPreferences, setBoardPreferences] = useState<BoardPreferences | null>(null);
  const [audioPreferences, setAudioPreferences] = useState<AudioGenerationPreferences | null>(null);
  const [audioLookups, setAudioLookups] = useState<AudioLookup>({ voices: [], models: [] });
  const [narrativeDistance, setNarrativeDistance] = useState("normal");
  const [narrativeViewMode, setNarrativeViewMode] = useState<"simple" | "dual">("simple");
  const [savingSection, setSavingSection] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadPreferences() {
      setGeneralError(null);
      setBoardError(null);
      setAudioError(null);
      setNarrativeError(null);
      const [boardPrefsResult, audioPrefsResult, narrativePrefsResult] = await Promise.allSettled([
        api<BoardPreferences>("/me/board-preferences").catch(() => null),
        api<AudioGenerationPreferences>("/me/audio-generation-preferences").catch(() => null),
        api<NarrativePrefs>("/me/narrative-preferences").catch(() => null),
      ]);

      if (cancelled) return;
      const boardPrefs = boardPrefsResult.status === "fulfilled" ? boardPrefsResult.value : null;
      const audioPrefs = audioPrefsResult.status === "fulfilled" ? audioPrefsResult.value : null;
      const narrativePrefs = narrativePrefsResult.status === "fulfilled" ? narrativePrefsResult.value : null;
      setBoardPreferences(boardPrefs);
      setAudioPreferences(audioPrefs);
      setNarrativeDistance(narrativePrefs?.playerDistance ?? "normal");
      setNarrativeViewMode(narrativePrefs?.playerViewMode === "dual" ? "dual" : "simple");
    }

    void loadPreferences().catch((error) => {
      if (!cancelled) {
        setGeneralError(error instanceof Error ? error.message : "No se pudieron cargar las preferencias.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || section !== "audio") return;
    if (audioLookups.voices.length || audioLookups.models.length) return;

    let cancelled = false;
    void Promise.all([
      api<AudioLookupResponse>("/integrations/elevenlabs/voices").catch(() => ({ voices: [] })),
      api<AudioLookupResponse>("/integrations/elevenlabs/models").catch(() => ({ models: [] })),
    ]).then(([voicesResult, modelsResult]) => {
      if (!cancelled) {
        setAudioLookups({
          voices: voicesResult.voices ?? [],
          models: modelsResult.models ?? [],
        });
        if (!(voicesResult.voices?.length || modelsResult.models?.length)) {
          setAudioError("No se pudieron cargar voces o modelos de ElevenLabs.");
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [audioLookups.models.length, audioLookups.voices.length, open, section]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto bg-black/60 px-3 py-3 backdrop-blur-md sm:items-center sm:px-4 sm:py-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#161320] shadow-[0_30px_90px_rgba(0,0,0,.55)] sm:max-h-[calc(100vh-2rem)] sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#998cc6]">Configuración de cuenta</p>
            <h3 className="mt-1 text-xl font-semibold text-white">Personalización básica</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-[#d7d0e7] transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden xl:grid-cols-[.85fr_1.15fr]">
          <div className="border-b border-white/8 p-4 sm:p-5 xl:border-b-0 xl:border-r">
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8e5dff] text-white">
                  <UserCircle2 className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">{user.fullName}</p>
                  <p className="truncate text-sm text-[#a39bb4]">{user.email}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm">
                <InfoRow label="Rol" value={user.role} />
                <InfoRow label="Organización" value={user.organizationId} />
                <InfoRow label="Permisos" value={`${user.permissions.length} disponibles`} />
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#978cb9]">Barra lateral</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#f0ebf8]">Modo compacto</p>
                  <p className="text-sm text-[#a39bb4]">Reduce el ancho de la navegación lateral.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className={`inline-flex h-11 min-w-[122px] items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
                    sidebarCollapsed
                      ? "bg-[#8e5dff] text-white"
                      : "border border-white/10 bg-white/5 text-[#f5efff] hover:bg-white/10"
                  }`}
                >
                  {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  {sidebarCollapsed ? "Compacta" : "Expandida"}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#978cb9]">Densidad global</p>
              <div className="mt-3 grid gap-2">
                {[
                  ["comfortable", "Cómoda", "Más aire y separación entre bloques."],
                  ["compact", "Compacta", "Más contenido visible en pantalla."],
                ].map(([value, label, description]) => {
                  const active = density === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDensity(value as DensityMode)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? "border-[#8e5dff]/60 bg-[#8e5dff]/15"
                          : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                    >
                      <p className="text-sm font-semibold text-[#f0ebf8]">{label}</p>
                      <p className="mt-1 text-sm text-[#a39bb4]">{description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#978cb9]">Tema</p>
              <div className="mt-3 grid gap-3">
                {[
                  { value: "system", label: "Sistema", description: "Sigue el modo de tu dispositivo.", icon: MonitorSmartphone },
                  { value: "light", label: "Claro", description: "Interfaz luminosa y limpia.", icon: Sun },
                  { value: "dark", label: "Oscuro", description: "Contraste alto para trabajo nocturno.", icon: Moon },
                ].map((option) => {
                  const active = theme === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value as ThemeMode)}
                      className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? "border-[#8e5dff]/60 bg-[#8e5dff]/15"
                          : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl ${active ? "bg-[#8e5dff] text-white" : "bg-white/5 text-[#d7d0e7]"}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-[#f0ebf8]">{option.label}</span>
                          <span className="mt-1 block text-sm text-[#a39bb4]">{option.description}</span>
                        </span>
                      </span>
                      {active ? <Check className="mt-1 h-4 w-4 shrink-0 text-[#c59bff]" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#978cb9]">Preferencias por módulo</p>
              <p className="mt-2 text-sm leading-6 text-[#a39bb4]">
                Ajusta directamente la Botonera, Audio IA o Narrativas sin salir del popup.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <SectionTab active={section === "board"} onClick={() => setSection("board")} icon={Waves} label="Botonera" />
                <SectionTab active={section === "audio"} onClick={() => setSection("audio")} icon={Sparkles} label="Audio IA" />
                <SectionTab active={section === "narratives"} onClick={() => setSection("narratives")} icon={Workflow} label="Narrativas" />
              </div>

              <div className="mt-4 rounded-2xl border border-white/8 bg-[#120f1c] p-4">
                {section === "board" ? (
                  <BoardQuickSettings
                    boardPreferences={boardPreferences}
                    onSave={async (next) => {
                      setSavingSection(true);
                      setBoardError(null);
                      try {
                        await api("/me/board-preferences", { method: "PATCH", body: JSON.stringify(next) });
                        setBoardPreferences(next);
                        window.localStorage.setItem(BOARD_DENSITY_KEY, next.density);
                      } catch (error) {
                        setBoardError(error instanceof Error ? error.message : "No se pudo guardar Botonera.");
                      } finally {
                        setSavingSection(false);
                      }
                    }}
                  />
                ) : null}

                {section === "audio" ? (
                  <AudioQuickSettings
                    preferences={audioPreferences}
                    lookups={audioLookups}
                    onSave={async (next) => {
                      setSavingSection(true);
                      setAudioError(null);
                      try {
                        await api("/me/audio-generation-preferences", {
                          method: "PATCH",
                          body: JSON.stringify(next),
                        });
                        setAudioPreferences(next);
                      } catch (error) {
                        setAudioError(error instanceof Error ? error.message : "No se pudo guardar Audio IA.");
                      } finally {
                        setSavingSection(false);
                      }
                    }}
                  />
                ) : null}

                {section === "narratives" ? (
                  <NarrativeQuickSettings
                    distance={narrativeDistance}
                    viewMode={narrativeViewMode}
                    onChangeDistance={setNarrativeDistance}
                    onChangeViewMode={setNarrativeViewMode}
                    onSave={async () => {
                      setSavingSection(true);
                      setNarrativeError(null);
                      try {
                        await api("/me/narrative-preferences", {
                          method: "PATCH",
                          body: JSON.stringify({
                            playerDistance: narrativeDistance,
                            playerViewMode: narrativeViewMode,
                          }),
                        });
                      } catch (error) {
                        setNarrativeError(error instanceof Error ? error.message : "No se pudo guardar Narrativas.");
                      } finally {
                        setSavingSection(false);
                      }
                    }}
                  />
                ) : null}

                {generalError ? <p className="mt-3 text-sm text-amber-300">{generalError}</p> : null}
                {section === "board" && boardError ? <p className="mt-3 text-sm text-amber-300">{boardError}</p> : null}
                {section === "audio" && audioError ? <p className="mt-3 text-sm text-amber-300">{audioError}</p> : null}
                {section === "narratives" && narrativeError ? <p className="mt-3 text-sm text-amber-300">{narrativeError}</p> : null}
                {savingSection ? <p className="mt-3 text-sm text-[#a39bb4]">Guardando cambios...</p> : null}
              </div>

              <button
                type="button"
                onClick={() => {
                  setTheme("system");
                  setDensity("comfortable");
                  setSidebarCollapsed(false);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f5efff] transition-colors hover:bg-white/10"
              >
                Restablecer ajustes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
        active
          ? "border-[#8e5dff]/60 bg-[#8e5dff]/15 text-[#f5efff]"
          : "border-white/10 bg-white/[0.03] text-[#a39bb4] hover:bg-white/[0.06]"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function BoardQuickSettings({
  boardPreferences,
  onSave,
}: {
  boardPreferences: BoardPreferences | null;
  onSave: (next: BoardPreferences) => Promise<void>;
}) {
  const [viewMode, setViewMode] = useState<BoardPreferences["viewMode"]>(boardPreferences?.viewMode ?? "simple");
  const [density, setDensity] = useState<BoardPreferences["density"]>(boardPreferences?.density ?? "medium");
  const [volume, setVolume] = useState(boardPreferences?.volume ?? 1);

  useEffect(() => {
    setViewMode(boardPreferences?.viewMode ?? "simple");
    setDensity(boardPreferences?.density ?? "medium");
    setVolume(boardPreferences?.volume ?? 1);
  }, [boardPreferences]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-[#978cb9]">Vista</p>
        <div className="inline-flex rounded-full border border-white/8 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setViewMode("simple")}
            className={`rounded-full px-3 py-2 text-sm ${viewMode === "simple" ? "bg-[#8e5dff] text-white" : "text-[#a39bb4]"}`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setViewMode("dual")}
            className={`rounded-full px-3 py-2 text-sm ${viewMode === "dual" ? "bg-[#8e5dff] text-white" : "text-[#a39bb4]"}`}
          >
            Dual
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-[#978cb9]">Densidad</p>
        <div className="grid gap-2">
          {([
            ["compact", "Compacta"],
            ["medium", "Mediana"],
            ["large", "Grande"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDensity(value)}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                density === value
                  ? "border-[#8e5dff]/60 bg-[#8e5dff]/15"
                  : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <p className="text-sm font-semibold text-[#f0ebf8]">{label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-[#978cb9]">Volumen</p>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          className="w-full"
        />
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => void onSave({ viewMode, density, volume })}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f5efff] transition-colors hover:bg-white/10"
        >
          Guardar Botonera
        </button>
      </div>
    </div>
  );
}

function AudioQuickSettings({
  preferences,
  lookups,
  onSave,
}: {
  preferences: AudioGenerationPreferences | null;
  lookups: AudioLookup;
  onSave: (next: AudioGenerationPreferences) => Promise<void>;
}) {
  const [text, setText] = useState(preferences?.composerText ?? "");
  const [voiceId, setVoiceId] = useState(preferences?.composerVoiceId ?? "");
  const [modelId, setModelId] = useState(preferences?.composerModelId ?? "");

  useEffect(() => {
    setText(preferences?.composerText ?? "");
    setVoiceId(preferences?.composerVoiceId ?? "");
    setModelId(preferences?.composerModelId ?? "");
  }, [preferences]);

  return (
    <div className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-xs uppercase tracking-[0.18em] text-[#978cb9]">Texto por defecto</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="min-h-28 rounded-2xl border border-white/8 bg-surface px-4 py-3 text-sm text-[#f0ebf8] outline-none focus:border-primary"
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-xs uppercase tracking-[0.18em] text-[#978cb9]">Voz</span>
          <select
            value={voiceId}
            onChange={(event) => setVoiceId(event.target.value)}
            className="h-11 rounded-2xl border border-white/8 bg-surface px-3 text-sm text-[#f0ebf8] outline-none focus:border-primary"
          >
            <option value="">Sin voz</option>
            {lookups.voices.map((voice) => (
              <option key={voice.voiceId} value={voice.voiceId}>
                {voice.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs uppercase tracking-[0.18em] text-[#978cb9]">Modelo</span>
          <select
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            className="h-11 rounded-2xl border border-white/8 bg-surface px-3 text-sm text-[#f0ebf8] outline-none focus:border-primary"
          >
            <option value="">Sin modelo</option>
            {lookups.models.map((model) => (
              <option key={model.modelId} value={model.modelId}>
                {model.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() =>
            void onSave({
              composerText: text,
              composerVoiceId: voiceId,
              composerModelId: modelId,
              composerOutputFormat: preferences?.composerOutputFormat ?? "mp3_44100_128",
              composerStability: preferences?.composerStability ?? 0.5,
              composerSimilarityBoost: preferences?.composerSimilarityBoost ?? 0.75,
              composerStyle: preferences?.composerStyle ?? 0,
              composerSpeed: preferences?.composerSpeed ?? 1,
              composerSpeakerBoost: preferences?.composerSpeakerBoost ?? true,
            })
          }
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f5efff] transition-colors hover:bg-white/10"
        >
          Guardar Audio IA
        </button>
      </div>
    </div>
  );
}

function NarrativeQuickSettings({
  distance,
  viewMode,
  onChangeDistance,
  onChangeViewMode,
  onSave,
}: {
  distance: string;
  viewMode: "simple" | "dual";
  onChangeDistance: (value: string) => void;
  onChangeViewMode: (value: "simple" | "dual") => void;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-[#978cb9]">Vista del player</p>
        <div className="inline-flex rounded-full border border-white/8 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => onChangeViewMode("simple")}
            className={`rounded-full px-3 py-2 text-sm ${viewMode === "simple" ? "bg-[#8e5dff] text-white" : "text-[#a39bb4]"}`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("dual")}
            className={`rounded-full px-3 py-2 text-sm ${viewMode === "dual" ? "bg-[#8e5dff] text-white" : "text-[#a39bb4]"}`}
          >
            Doble
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-[#978cb9]">Distancia del layout</p>
        <div className="grid gap-2">
          {["compact", "tight", "normal", "wide", "max"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChangeDistance(item)}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                distance === item
                  ? "border-[#8e5dff]/60 bg-[#8e5dff]/15"
                  : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <p className="text-sm font-semibold text-[#f0ebf8]">{item}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => void onSave()}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f5efff] transition-colors hover:bg-white/10"
        >
          Guardar Narrativas
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
      <span className="text-xs uppercase tracking-[0.18em] text-[#978cb9]">{label}</span>
      <span className="max-w-[55%] truncate text-sm text-[#f0ebf8]">{value}</span>
    </div>
  );
}
