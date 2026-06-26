"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  Check,
  MonitorSmartphone,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  UserCircle2,
  Waves,
  Workflow,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { AuthUser, BoardPreferences } from "@/types/routlis";

type ThemeMode = "system" | "light" | "dark";
type DensityMode = "comfortable" | "compact";
type QuickSection = "board" | "narratives";
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
  const [narrativeDistance, setNarrativeDistance] = useState("normal");
  const [narrativeViewMode, setNarrativeViewMode] = useState<"simple" | "dual">("simple");
  const [savingSection, setSavingSection] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
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
      setNarrativeError(null);
      const [boardPrefsResult, narrativePrefsResult] = await Promise.allSettled([
        api<BoardPreferences>("/me/board-preferences").catch(() => null),
        api<NarrativePrefs>("/me/narrative-preferences").catch(() => null),
      ]);

      if (cancelled) return;
      const boardPrefs = boardPrefsResult.status === "fulfilled" ? boardPrefsResult.value : null;
      const narrativePrefs = narrativePrefsResult.status === "fulfilled" ? narrativePrefsResult.value : null;
      setBoardPreferences(boardPrefs);
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto bg-black/50 px-2 py-2 backdrop-blur-md sm:items-center sm:px-4 sm:py-4"
      onClick={onClose}
    >
      <div
        className="surface-panel flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[22px] sm:max-h-[calc(100vh-2rem)] sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-sidebar-border px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-on-surface-variant">Configuración de cuenta</p>
            <h3 className="mt-1 text-xl font-semibold text-on-surface">Personalización básica</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden xl:grid-cols-[.85fr_1.15fr]">
          <div className="border-b border-sidebar-border p-4 sm:p-5 xl:border-b-0 xl:border-r">
            <div className="rounded-[24px] border border-outline-variant bg-surface-container p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-primary">
                  <UserCircle2 className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-on-surface">{user.fullName}</p>
                  <p className="truncate text-sm text-on-surface-variant">{user.email}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm">
                <InfoRow label="Rol" value={user.role} />
                <InfoRow label="Organización" value={user.organizationId} />
                <InfoRow label="Permisos" value={`${user.permissions.length} disponibles`} />
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-outline-variant bg-surface-container p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Barra lateral</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-on-surface">Modo compacto</p>
                  <p className="text-sm text-on-surface-variant">Reduce el ancho de la navegación lateral.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className={`inline-flex h-11 min-w-[122px] items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
                    sidebarCollapsed
                      ? "bg-primary text-on-primary"
                      : "border border-outline-variant bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                  }`}
                >
                  {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  {sidebarCollapsed ? "Compacta" : "Expandida"}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-outline-variant bg-surface-container p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Densidad global</p>
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
                          ? "border-primary/40 bg-primary/10"
                          : "border-outline-variant bg-surface hover:bg-surface-container-high"
                      }`}
                    >
                      <p className="text-sm font-semibold text-on-surface">{label}</p>
                      <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
            <div className="rounded-[24px] border border-outline-variant bg-surface-container p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Tema</p>
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
                          ? "border-primary/40 bg-primary/10"
                          : "border-outline-variant bg-surface hover:bg-surface-container-high"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl ${active ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-on-surface">{option.label}</span>
                          <span className="mt-1 block text-sm text-on-surface-variant">{option.description}</span>
                        </span>
                      </span>
                      {active ? <Check className="mt-1 h-4 w-4 shrink-0 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-outline-variant bg-surface-container p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Preferencias por módulo</p>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                Ajusta directamente la Botonera, Audio IA o Llamadas sin salir del popup.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <SectionTab active={section === "board"} onClick={() => setSection("board")} icon={Waves} label="Botonera" />
                <SectionTab active={section === "narratives"} onClick={() => setSection("narratives")} icon={Workflow} label="Llamadas" />
              </div>

              <div className="mt-4 rounded-2xl border border-outline-variant bg-surface p-4">
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
                        setNarrativeError(error instanceof Error ? error.message : "No se pudo guardar Llamadas.");
                      } finally {
                        setSavingSection(false);
                      }
                    }}
                  />
                ) : null}

                {generalError ? <p className="mt-3 text-sm text-error">{generalError}</p> : null}
                {section === "board" && boardError ? <p className="mt-3 text-sm text-error">{boardError}</p> : null}
                {section === "narratives" && narrativeError ? <p className="mt-3 text-sm text-error">{narrativeError}</p> : null}
                {savingSection ? <p className="mt-3 text-sm text-on-surface-variant">Guardando cambios...</p> : null}
              </div>

              <button
                type="button"
                onClick={() => {
                  setTheme("system");
                  setDensity("comfortable");
                  setSidebarCollapsed(false);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
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
          ? "border-primary/40 bg-primary/10 text-on-surface"
          : "border-outline-variant bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
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
        <p className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Vista</p>
        <div className="inline-flex rounded-full border border-outline-variant bg-surface-container-high p-1">
          <button
            type="button"
            onClick={() => setViewMode("simple")}
            className={`rounded-full px-3 py-2 text-sm ${viewMode === "simple" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setViewMode("dual")}
            className={`rounded-full px-3 py-2 text-sm ${viewMode === "dual" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
          >
            Dual
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Densidad</p>
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
                  ? "border-primary/40 bg-primary/10"
                  : "border-outline-variant bg-surface hover:bg-surface-container-high"
              }`}
            >
              <p className="text-sm font-semibold text-on-surface">{label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Volumen</p>
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
          className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
        >
          Guardar Botonera
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
        <p className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Vista del player</p>
        <div className="inline-flex rounded-full border border-outline-variant bg-surface-container-high p-1">
          <button
            type="button"
            onClick={() => onChangeViewMode("simple")}
            className={`rounded-full px-3 py-2 text-sm ${viewMode === "simple" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("dual")}
            className={`rounded-full px-3 py-2 text-sm ${viewMode === "dual" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
          >
            Doble
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Distancia del layout</p>
        <div className="grid gap-2">
          {["compact", "tight", "normal", "wide", "max"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChangeDistance(item)}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                distance === item
                  ? "border-primary/40 bg-primary/10"
                  : "border-outline-variant bg-surface hover:bg-surface-container-high"
              }`}
            >
              <p className="text-sm font-semibold text-on-surface">{item}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => void onSave()}
          className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
        >
          Guardar Llamadas
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface px-3 py-2.5">
      <span className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">{label}</span>
      <span className="max-w-[55%] truncate text-sm text-on-surface">{value}</span>
    </div>
  );
}
