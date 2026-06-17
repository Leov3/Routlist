"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bell,
  FileCode2,
  Gauge,
  Building2,
  HardDrive,
  History,
  Library,
  LogOut,
  Mail,
  PanelTop,
  MousePointerClick,
  PlugZap,
  Sparkles,
  Settings,
  ShieldCheck,
  Server,
  Send,
  Tags,
  Wrench,
  Workflow,
  Users,
} from "lucide-react";
import type { AuthUser } from "@/types/routlis";
import { logout } from "@/lib/auth";
import { api, formatBytes } from "@/lib/api";
import { AccountSettingsModal } from "./AccountSettingsModal";
import { ThemeToggleButton } from "./ThemeToggleButton";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permissions?: string[];
  roles?: string[];
  group?: "operation" | "access" | "platform" | "content" | "system";
};

type StorageHealth = {
  filesystem: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
  };
  usage?: {
    audioAssetsBytes?: number;
    trackedBytes?: number;
  };
  paths?: {
    audioPath?: string;
  };
  timestamp?: string;
};

type StorageHealthState = {
  data: StorageHealth | null;
  status: "ok" | "partial" | "error";
};

type SectionMeta = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
};

const adminGroupMeta: Record<"operation" | "access" | "platform" | "content" | "system", SectionMeta> = {
  operation: {
    title: "Operación",
    icon: Workflow,
    description: "Controles principales",
  },
  access: {
    title: "Acceso",
    icon: ShieldCheck,
    description: "Permisos y usuarios",
  },
  platform: {
    title: "Plataforma",
    icon: Gauge,
    description: "Estado general",
  },
  content: {
    title: "Contenido",
    icon: Library,
    description: "Biblioteca y flujos",
  },
  system: {
    title: "Sistema",
    icon: Wrench,
    description: "Correo, storage y mantenimiento",
  },
};

const navItems: NavItem[] = [
  { href: "/board", label: "Botonera", icon: PanelTop, permissions: ["board:use"], group: "operation" },
  { href: "/audio-ia", label: "Audio IA", icon: Sparkles, permissions: ["audio:generate"], group: "operation" },
  { href: "/narratives", label: "Narrativas", icon: Workflow, permissions: ["narratives:run"], group: "operation" },
];

const adminItems: NavItem[] = [
  { href: "/admin/access", label: "Accesos", icon: ShieldCheck, roles: ["OWNER"], group: "access" },
  { href: "/admin", label: "Estadísticas", icon: Gauge, roles: ["OWNER", "ADMIN", "SUPERVISOR"], group: "platform" },
  { href: "/admin/organizations", label: "Organizaciones", icon: Building2, roles: ["OWNER"], group: "platform" },
  { href: "/admin/users", label: "Usuarios", icon: Users, permissions: ["user:create"], group: "platform" },
  { href: "/admin/integraciones", label: "Integraciones", icon: PlugZap, permissions: ["integration:manage"], group: "system" },
  { href: "/admin/audios", label: "Audios", icon: Library, permissions: ["audio:create"], group: "content" },
  { href: "/admin/categories", label: "Categorías", icon: Tags, permissions: ["category:create"], group: "content" },
  { href: "/admin/buttons", label: "Botones", icon: MousePointerClick, permissions: ["button:create"], group: "content" },
  { href: "/admin/narratives", label: "Narrativas", icon: Workflow, permissions: ["narratives:view"], group: "content" },
  { href: "/admin/storage", label: "Almacenamiento", icon: HardDrive, roles: ["OWNER"], group: "system" },
  { href: "/admin/maintenance", label: "Migraciones y backup", icon: Wrench, roles: ["OWNER"], group: "system" },
  { href: "/admin/history", label: "Historial", icon: History, permissions: ["history:read"], group: "system" },
];

const mailItems: Array<{ href: string; label: string; icon: NavItem["icon"] }> = [
  { href: "/admin/mail/smtp", label: "SMTP", icon: Server },
  { href: "/admin/mail/test", label: "Pruebas", icon: Send },
  { href: "/admin/mail/templates", label: "Plantillas", icon: FileCode2 },
  { href: "/admin/mail/events", label: "Eventos", icon: Bell },
  { href: "/admin/mail/logs", label: "Historial", icon: History },
];

function canSeeNavItem(user: AuthUser, item: NavItem) {
  const roleAllowed = !item.roles || item.roles.includes(user.role);
  const permissionsAllowed =
    !item.permissions ||
    item.permissions.every((p) => user.permissions.includes(p));
  return roleAllowed && permissionsAllowed;
}

function isLocalHost() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

const SIDEBAR_COLLAPSED_KEY = "routlis.sidebar.collapsed";
const UI_DENSITY_KEY = "routlis.ui.density";

// ─── Topbar (inside sidebar layout) ──────────────────────────────────────────
function TopbarControls({
  user,
  onOpenAccountSettings,
}: {
  user: AuthUser;
  onOpenAccountSettings: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="flex items-center gap-2">
      <ThemeToggleButton variant="pill" />

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="btn-surface-base btn-secondary-surface h-9 rounded-full px-3 text-sm"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary text-xs font-bold">
            {user.fullName.charAt(0).toUpperCase()}
          </span>
          <span className="hidden max-w-[120px] truncate sm:block">{user.fullName}</span>
          <ChevronDown className={`h-3 w-3 text-on-surface-variant transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-[100] mt-2 w-60 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-highest shadow-elevation-3">
            <div className="border-b border-outline-variant px-4 py-3">
              <p className="text-sm font-semibold text-on-surface">{user.fullName}</p>
              <p className="text-xs text-on-surface-variant">{user.role}</p>
              <p className="mt-0.5 truncate text-xs text-on-surface-variant opacity-70">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenAccountSettings();
              }}
              className="btn-surface-base btn-ghost-surface flex w-full items-center gap-3 px-4 py-3 text-sm"
            >
              <Settings className="h-4 w-4" />
              Configuración de cuenta
            </button>
            <button type="button" onClick={handleLogout}
              className="btn-surface-base btn-destructive-surface flex w-full items-center gap-3 px-4 py-3 text-sm">
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────
export function AppShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [adminOpen, setAdminOpen] = useState(pathname.startsWith("/admin"));
  const [mailOpen, setMailOpen] = useState(pathname.startsWith("/admin/mail"));
  const [collapsed, setCollapsed] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [storageState, setStorageState] = useState<StorageHealthState>({ data: null, status: "error" });
  const pageTitle = getPageTitle(pathname);
  const visibleMainItems = navItems.filter((item) => canSeeNavItem(user, item));
  const visibleAdminItems = adminItems.filter((item) => canSeeNavItem(user, item));
  const canSeeAdmin = visibleAdminItems.length > 0;
  const groupedAdminItems = visibleAdminItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    const group = item.group ?? "platform";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const sidebarW = collapsed ? "w-[72px]" : "w-[260px]";
  const sidebarWidth = collapsed ? 72 : 260;

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved === "true") {
      setCollapsed(true);
    }
    const savedDensity = window.localStorage.getItem(UI_DENSITY_KEY);
    if (savedDensity === "compact") {
      setDensity("compact");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    window.localStorage.setItem(UI_DENSITY_KEY, density);
  }, [density]);

  useEffect(() => {
    if (user.role !== "OWNER") return;

    let cancelled = false;
    void api<StorageHealth>("/health/storage")
      .then((result) => {
        if (!cancelled) {
          const status =
            result.paths?.audioPath && result.usage?.trackedBytes !== undefined ? "ok" : "partial";
          setStorageState({ data: result, status });
        }
      })
      .catch(() => {
        if (!cancelled) setStorageState({ data: null, status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [user.role]);

  useEffect(() => {
    setMailOpen(pathname.startsWith("/admin/mail"));
  }, [pathname]);

  return (
    <div
      className={`flex h-screen overflow-hidden bg-surface ${density === "compact" ? "text-[0.98rem]" : ""}`}
      style={{ "--routlis-sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      {/* ── Sidebar ── */}
      <aside
        className={`relative flex flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-standard ${sidebarW}`}
        style={{ background: "var(--routlis-sidebar-bg)", borderColor: "var(--routlis-sidebar-border)" }}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-3 px-4 border-b border-sidebar-border"
          style={{ borderColor: "var(--routlis-sidebar-border)" }}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Routlis logo" className="h-full w-full brightness-0 invert" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-on-surface">Routlis</p>
              <p className="text-xs font-medium text-gradient-primary">AudioBoard</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-4">
          <div className="space-y-2">
            {!collapsed && (
              <div className="flex items-center gap-2 px-1 pb-1">
                <Workflow className="h-4 w-4 text-on-surface-variant" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                    Operación
                  </p>
                  <p className="text-[11px] text-on-surface-variant/80">Herramientas del día a día</p>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {visibleMainItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 ${
                      active
                        ? "nav-active text-primary"
                        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>

          {canSeeAdmin && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => !collapsed && setAdminOpen((v) => !v)}
                title={collapsed ? "Panel de control" : undefined}
                className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 ${
                  pathname.startsWith("/admin")
                    ? "nav-active text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <Gauge className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate text-left">Panel de control</span>
                    <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${adminOpen ? "rotate-180" : ""}`} />
                  </>
                )}
              </button>

              {adminOpen && !collapsed && (
                <div className="mt-4 space-y-5">
                  {(["operation", "access", "platform", "content", "system"] as const).map((group) => {
                    const items =
                      group === "system"
                        ? (groupedAdminItems[group] ?? []).filter((item) => item.href !== "/admin/mail")
                        : groupedAdminItems[group] ?? [];
                    if (!items.length) return null;
                    const meta = adminGroupMeta[group];
                    return (
                      <div key={group} className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                            <meta.icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                              {meta.title}
                            </p>
                            <p className="text-[11px] text-on-surface-variant/80">{meta.description}</p>
                          </div>
                        </div>

                        {group === "system" && (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => setMailOpen((current) => !current)}
                              className={`flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm transition-all duration-200 ${
                                pathname.startsWith("/admin/mail")
                                  ? "bg-primary/15 font-semibold text-primary"
                                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                  pathname.startsWith("/admin/mail") ? "bg-primary" : "bg-outline"
                                }`}
                              />
                              <Mail className="h-4 w-4 shrink-0" />
                              <span className="flex-1 truncate text-left">Correo</span>
                              <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${mailOpen ? "rotate-180" : ""}`} />
                            </button>

                            {mailOpen && (
                              <div className="space-y-1 pl-4">
                                {mailItems.map((item) => {
                                  const active = pathname === item.href;
                                  const Icon = item.icon;
                                  return (
                                    <Link
                                      key={item.href}
                                      href={item.href}
                                      className={`flex h-8 items-center gap-2 rounded-lg px-2 text-sm transition-all duration-200 ${
                                        active
                                          ? "bg-primary/15 font-semibold text-primary"
                                          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                                      }`}
                                    >
                                      <Icon className="h-4 w-4 shrink-0" />
                                      <span className="truncate">{item.label}</span>
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-1">
                          {items.map((item) => {
                            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={`flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-all duration-200 ${
                                  active
                                    ? "bg-primary/15 font-semibold text-primary"
                                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${active ? "bg-primary" : "bg-outline"}`} />
                                <span className="truncate">{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Storage meter */}
        {!collapsed && user.role === "OWNER" && (
          <div
            className="group mx-3 mb-2 pt-4"
            title={
              storageState.data
                ? [
                    `Entorno: ${isLocalHost() ? "Local" : "VPS"}`,
                    `Lectura: ${storageState.data.timestamp ? new Date(storageState.data.timestamp).toLocaleString("es-CO") : "N/D"}`,
                    `audioPath: ${storageState.data.paths?.audioPath ?? "N/D"}`,
                    `trackedBytes: ${
                      storageState.data.usage?.trackedBytes !== undefined
                        ? formatBytes(storageState.data.usage.trackedBytes)
                        : "N/D"
                    }`,
                    `audioAssetsBytes: ${
                      storageState.data.usage?.audioAssetsBytes !== undefined
                        ? formatBytes(storageState.data.usage.audioAssetsBytes)
                        : "N/D"
                    }`,
                  ].join(" | ")
                : "Sin lectura del backend"
            }
          >
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-on-surface-variant">Almacenamiento</span>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                  storageState.status === "ok"
                    ? "success-surface"
                    : storageState.status === "partial"
                      ? "bg-amber-500/10 text-amber-300"
                      : "bg-rose-500/10 text-rose-300"
                }`}
              >
                {storageState.status === "ok"
                  ? "OK"
                  : storageState.status === "partial"
                    ? "Parcial"
                    : "Sin lectura"}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-outline-variant">
              <div
                className="progress-bar h-1.5 rounded-full transition-all"
                style={{ width: `${storageState.data?.filesystem.usedPercent ?? 0}%` }}
              />
            </div>
            <div className="mt-1 space-y-0.5">
              <p className="text-[10px] text-on-surface-variant">
                {storageState.data
                  ? `${formatBytes(storageState.data.filesystem.usedBytes)} / ${formatBytes(storageState.data.filesystem.totalBytes)}`
                  : "Sin lectura del backend"}
              </p>
              <p className="truncate text-[10px] text-on-surface-variant">
                {storageState.data?.paths?.audioPath ?? "audioPath no disponible"}
              </p>
              <p className="text-[10px] text-on-surface-variant">
                Entorno: {isLocalHost() ? "Local" : "VPS"}
              </p>
            </div>
          </div>
        )}

        {/* User pill */}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setAccountSettingsOpen(true)}
            className="mx-3 mb-3 mt-4 flex items-center gap-2 text-left transition-colors hover:text-on-surface"
            aria-label="Abrir configuración de cuenta"
            title="Configuración de cuenta"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary text-xs font-bold">
              {user.fullName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-on-surface">{user.fullName}</p>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">{user.role}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
          </button>
        )}

        {/* Collapse toggle */}
        <button type="button" onClick={() => setCollapsed((v) => !v)}
          className="icon-button-surface absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-elevation-1">
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-outline-variant bg-surface px-6">
          <div className="min-w-0">
            {pathname !== "/board" ? (
              <p className="truncate text-lg font-semibold tracking-tight text-on-surface">
                {pageTitle}
              </p>
            ) : null}
          </div>

          <div className="flex min-w-0 justify-center">
            <div id="board-header-slot" className="flex min-w-0 items-center justify-center" />
          </div>

          <div className="flex justify-end">
            <TopbarControls
              user={user}
              onOpenAccountSettings={() => setAccountSettingsOpen(true)}
            />
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
           <div className={`flex-1 ${density === "compact" ? "p-4 lg:p-6" : "p-6 lg:p-8"}`}>{children}</div>
         </main>
      </div>

      <AccountSettingsModal
        user={user}
        open={accountSettingsOpen}
        theme={(theme ?? "system") as "system" | "light" | "dark"}
        setTheme={setTheme}
        density={density}
        setDensity={setDensity}
        sidebarCollapsed={collapsed}
        setSidebarCollapsed={setCollapsed}
        onClose={() => setAccountSettingsOpen(false)}
      />
    </div>
  );
}

function getPageTitle(pathname: string) {
  if (pathname === "/narratives" || pathname.startsWith("/narratives/")) return "/Narrativas";
  if (pathname === "/audio-ia") return "/Audio IA";
  if (pathname === "/board") return "/Botonera";
  if (pathname.startsWith("/admin/narratives")) return "/Narrativas";
  if (pathname === "/admin/buttons") return "/Botones";
  if (pathname === "/admin/integraciones") return "/Integraciones";
  if (pathname === "/admin/organizations") return "/Organizaciones";
  if (pathname === "/admin/audios") return "/Audios";
  if (pathname === "/admin/categories") return "/Categorías";
  if (pathname === "/admin/storage") return "/Almacenamiento";
  if (pathname === "/admin/mail" || pathname.startsWith("/admin/mail/")) return "/Correo";
  if (pathname === "/admin/users") return "/Usuarios";
  if (pathname === "/admin/history") return "/Historial";
  if (pathname === "/admin") return "/Estadísticas";
  return "/Routlis";
}
