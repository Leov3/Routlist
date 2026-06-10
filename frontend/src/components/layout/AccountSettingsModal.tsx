"use client";

import { useEffect } from "react";
import { Check, MonitorSmartphone, Moon, PanelLeftClose, PanelLeftOpen, Sun, UserCircle2, X } from "lucide-react";
import type { AuthUser } from "@/types/routlis";

type ThemeMode = "system" | "light" | "dark";

type AccountSettingsModalProps = {
  user: AuthUser;
  open: boolean;
  theme: ThemeMode | undefined;
  setTheme: (theme: ThemeMode) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  onClose: () => void;
};

export function AccountSettingsModal({
  user,
  open,
  theme,
  setTheme,
  sidebarCollapsed,
  setSidebarCollapsed,
  onClose,
}: AccountSettingsModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (!open) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const themeOptions: Array<{
    value: ThemeMode;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      value: "system",
      label: "Sistema",
      description: "Sigue el modo de tu dispositivo.",
      icon: <MonitorSmartphone className="h-4 w-4" />,
    },
    {
      value: "light",
      label: "Claro",
      description: "Interfaz luminosa y limpia.",
      icon: <Sun className="h-4 w-4" />,
    },
    {
      value: "dark",
      label: "Oscuro",
      description: "Contraste alto para trabajo nocturno.",
      icon: <Moon className="h-4 w-4" />,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 px-4 py-4 backdrop-blur-md sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-[#161320] shadow-[0_30px_90px_rgba(0,0,0,.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
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
        </div>

        <div className="grid gap-0 lg:grid-cols-[.95fr_1.05fr]">
          <div className="border-b border-white/8 p-5 lg:border-b-0 lg:border-r">
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
          </div>

          <div className="p-5">
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#978cb9]">Tema</p>
              <div className="mt-3 grid gap-3">
                {themeOptions.map((option) => {
                  const active = theme === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? "border-[#8e5dff]/60 bg-[#8e5dff]/15"
                          : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl ${active ? "bg-[#8e5dff] text-white" : "bg-white/5 text-[#d7d0e7]"}`}>
                          {option.icon}
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
              <p className="text-xs uppercase tracking-[0.2em] text-[#978cb9]">Ajustes rápidos</p>
              <p className="mt-2 text-sm leading-6 text-[#a39bb4]">
                El modo compacto y el tema se guardan en tu navegador para que la próxima vez abras la app con tu preferencia activa.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTheme("system");
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
      <span className="text-xs uppercase tracking-[0.18em] text-[#978cb9]">{label}</span>
      <span className="max-w-[55%] truncate text-sm text-[#f0ebf8]">{value}</span>
    </div>
  );
}
