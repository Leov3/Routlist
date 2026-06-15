"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  FolderOpen,
  Gauge,
  HardDrive,
  History,
  Library,
  ListMusic,
  LogOut,
  Moon,
  PanelTop,
  Sparkles,
  Settings,
  Sun,
  Workflow,
  User,
  Users,
  Zap,
} from "lucide-react";
import type { AuthUser } from "@/types/routlis";
import { logout } from "@/lib/auth";
import { AccountSettingsModal } from "./AccountSettingsModal";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permissions?: string[];
  roles?: string[];
};

const navItems: NavItem[] = [
  { href: "/narratives", label: "Narrativas", icon: Workflow, permissions: ["narratives:run"] },
  { href: "/audio-ia", label: "Audio IA", icon: Sparkles, permissions: ["audio:generate"] },
  { href: "/board", label: "Botonera", icon: PanelTop, permissions: ["board:use"] },
];

const adminItems: NavItem[] = [
  { href: "/admin",           label: "Estadísticas",    icon: Gauge,     roles: ["OWNER","ADMIN","SUPERVISOR"] },
  { href: "/admin/organizations", label: "Organizaciones", icon: Database, roles: ["OWNER"] },
  { href: "/admin/audios",    label: "Audios",           icon: Library,   permissions: ["audio:create"] },
  { href: "/admin/storage",   label: "Almacenamiento",   icon: HardDrive, roles: ["OWNER"] },
  { href: "/admin/maintenance", label: "Migraciones y backup", icon: Database, roles: ["OWNER"] },
  { href: "/admin/categories",label: "Categorías",       icon: ListMusic, permissions: ["category:create"] },
  { href: "/admin/narratives",label: "Narrativas",       icon: Workflow,  permissions: ["narratives:view"] },
  { href: "/admin/buttons",   label: "Botones",          icon: PanelTop,  permissions: ["button:create"] },
  { href: "/admin/integraciones", label: "Integraciones", icon: Zap, permissions: ["integration:manage"] },
  { href: "/admin/users",     label: "Usuarios",         icon: Users,     permissions: ["user:create"] },
  { href: "/admin/history",   label: "Historial",        icon: History,   permissions: ["history:read"] },
];

function canSeeNavItem(user: AuthUser, item: NavItem) {
  const roleAllowed = !item.roles || item.roles.includes(user.role);
  const permissionsAllowed =
    !item.permissions ||
    item.permissions.every((p) => user.permissions.includes(p));
  return roleAllowed && permissionsAllowed;
}

const SIDEBAR_COLLAPSED_KEY = "routlis.sidebar.collapsed";

// ─── Topbar (inside sidebar layout) ──────────────────────────────────────────
function TopbarControls({
  user,
  onOpenAccountSettings,
}: {
  user: AuthUser;
  onOpenAccountSettings: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => setMounted(true), []);
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

  const isDark = theme === "dark";

  return (
    <div className="flex items-center gap-2">
      {/* Theme toggle pill */}
      {mounted && (
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          title="Alternar tema"
          className="relative flex h-8 w-16 items-center rounded-full border border-outline-variant bg-surface-container-high p-0.5 transition-colors hover:border-primary"
        >
          <span
            className={`absolute flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary shadow-elevation-1 transition-transform duration-300 ${
              isDark ? "translate-x-8" : "translate-x-0"
            }`}
          >
            {isDark ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
          </span>
          <Sun className="ml-1 h-3 w-3 text-on-surface-variant opacity-60" />
          <Moon className="ml-auto mr-1 h-3 w-3 text-on-surface-variant opacity-60" />
        </button>
      )}

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-9 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 text-sm font-medium text-on-surface transition-all hover:border-primary hover:bg-surface-container-high"
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
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-on-surface transition-colors hover:bg-surface-container hover:text-primary"
            >
              <Settings className="h-4 w-4" />
              Configuración de cuenta
            </button>
            <button type="button" onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-error transition-colors hover:bg-error-container/20">
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
  const [collapsed, setCollapsed] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const pageTitle = getPageTitle(pathname);

  const visibleAdminItems = adminItems.filter((item) => canSeeNavItem(user, item));
  const canSeeAdmin = visibleAdminItems.length > 0;

  const sidebarW = collapsed ? "w-[72px]" : "w-[260px]";
  const sidebarWidth = collapsed ? 72 : 260;

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved === "true") {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <div
      className="flex h-screen overflow-hidden bg-surface"
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
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          {/* Main items */}
          {navItems
            .filter((item) => canSeeNavItem(user, item))
            .map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 ${
                    active
                      ? "nav-active text-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}

          {/* Admin group */}
          {canSeeAdmin && (
            <div className="mt-1">
              <button type="button"
                onClick={() => !collapsed && setAdminOpen((v) => !v)}
                title={collapsed ? "Panel de control" : undefined}
                className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 ${
                  pathname.startsWith("/admin")
                    ? "nav-active text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}>
                <Gauge className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate text-left">Panel de control</span>
                    <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${adminOpen ? "rotate-180" : ""}`} />
                  </>
                )}
              </button>

              {adminOpen && !collapsed && (
                <div className="mt-1 ml-3 flex flex-col gap-0.5 border-l-2 border-outline-variant pl-3">
                  {visibleAdminItems.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link key={item.href} href={item.href}
                        className={`flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-all duration-200 ${
                          active
                            ? "bg-primary/15 font-semibold text-primary"
                            : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                        }`}>
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${active ? "bg-primary" : "bg-outline"}`} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Storage meter */}
        {!collapsed && user.role === "OWNER" && (
          <div className="mx-3 mb-2 rounded-xl border border-outline-variant bg-surface-container-high p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-on-surface-variant">Almacenamiento</span>
              <span className="text-xs font-bold text-primary">38%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-outline-variant">
              <div className="progress-bar h-1.5 rounded-full" style={{ width: "38%" }} />
            </div>
            <p className="mt-1 text-[10px] text-on-surface-variant">83.26 GB / 217.50 GB</p>
          </div>
        )}

        {/* User pill */}
        {!collapsed && (
          <div className="mx-3 mb-3 flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary text-xs font-bold">
              {user.fullName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-on-surface">{user.fullName}</p>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">{user.role}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
          </div>
        )}

        {/* Collapse toggle */}
        <button type="button" onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-outline-variant bg-surface-container text-on-surface-variant shadow-elevation-1 transition-all hover:bg-surface-container-high hover:text-primary">
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
           <div className="flex-1 p-6 lg:p-8">{children}</div>
         </main>
      </div>

      <AccountSettingsModal
        user={user}
        open={accountSettingsOpen}
        theme={theme as "system" | "light" | "dark" | undefined}
        setTheme={setTheme}
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
  if (pathname === "/admin/users") return "/Usuarios";
  if (pathname === "/admin/history") return "/Historial";
  if (pathname === "/admin") return "/Estadísticas";
  return "/Routlis";
}
