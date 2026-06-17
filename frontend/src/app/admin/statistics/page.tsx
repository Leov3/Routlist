"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Clock,
  Database,
  Mail,
  HardDrive,
  History,
  Library,
  ListMusic,
  PanelTop,
  RefreshCw,
  Server,
  Trash2,
  Users,
} from "lucide-react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, formatBytes } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import type {
  AudioAsset,
  AudioButton,
  AudioCategory,
  AuthUser,
  MaintenanceStatus,
  PlatformBranding,
  PlaybackEvent,
} from "@/types/routlis";

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  status: string;
  membershipStatus?: string;
  role: string;
};

type HealthState = {
  frontend: "ok";
  backend: "ok" | "down";
  database: "ok" | "down";
  latencyMs: number | null;
  checkedAt: string | null;
};

type DashboardData = {
  audios: AudioAsset[];
  categories: AudioCategory[];
  buttons: AudioButton[];
  users: UserRow[];
  history: PlaybackEvent[];
  invites: {
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
    createdAt: string;
    organization: { id: string; name: string };
    invitedBy?: { id: string; fullName: string; email: string } | null;
  }[];
};

type StorageHealth = {
  timestamp: string;
  filesystem: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
  };
  usage: {
    appBytes: number;
    backendSourceBytes: number;
    backendBuildBytes: number;
    frontendSourceBytes: number;
    frontendBuildBytes: number;
    documentsBytes: number;
    scriptsBytes: number;
    audioAssetsBytes: number;
    localDatabaseBytes: number;
    trackedBytes: number;
  };
  paths: {
    projectRoot: string;
    backendRoot: string;
    frontendRoot: string;
    audioPath: string;
    localDatabasePath: string;
  };
};

type Metric = {
  label: string;
  value: number | string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
  roles?: string[];
};

const emptyData: DashboardData = {
  audios: [],
  categories: [],
  buttons: [],
  users: [],
  history: [],
  invites: [],
};

export default function AdminDashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<DashboardData>(emptyData);
  const [health, setHealth] = useState<HealthState>({
    frontend: "ok",
    backend: "down",
    database: "down",
    latencyMs: null,
    checkedAt: null,
  });
  const [storage, setStorage] = useState<StorageHealth | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceStatus | null>(null);
  const [branding, setBranding] = useState<PlatformBranding | null>(null);
  const [mailCounts, setMailCounts] = useState({
    templates: 0,
    events: 0,
    queue: 0,
    logs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

  async function loadDashboard(showSpinner = false) {
    if (showSpinner) setRefreshing(true);

    const startedAt = performance.now();
    const [healthResult, currentUser] = await Promise.all([
      api<{ status: string; database: string; timestamp: string }>("/health")
        .then((result) => ({
          backend: result.status === "ok" ? ("ok" as const) : ("down" as const),
          database: result.database === "ok" ? ("ok" as const) : ("down" as const),
          checkedAt: result.timestamp,
        }))
        .catch(() => ({
          backend: "down" as const,
          database: "down" as const,
          checkedAt: new Date().toISOString(),
        })),
      getCurrentUser(),
    ]);
    setUser(currentUser);

    setHealth({
      frontend: "ok",
      backend: healthResult.backend,
      database: healthResult.database,
      latencyMs: Math.round(performance.now() - startedAt),
      checkedAt: healthResult.checkedAt,
    });
    setLoading(false);
    setRefreshing(false);

    void Promise.allSettled([
      api<AudioAsset[]>("/audio-assets"),
      api<AudioCategory[]>("/audio-categories"),
      api<AudioButton[]>("/audio-buttons"),
      api<UserRow[]>("/users"),
      api<PlaybackEvent[]>("/audit/playback-events"),
      currentUser.role === "OWNER"
        ? api<DashboardData["invites"]>("/admin/mail/invites")
        : Promise.resolve([]),
      currentUser.role === "OWNER"
        ? api<StorageHealth>("/health/storage")
        : Promise.resolve(null),
      currentUser.role === "OWNER"
        ? api<Array<{ key: string }>>("/admin/mail/templates")
        : Promise.resolve([]),
      currentUser.role === "OWNER"
        ? api<Array<{ key: string }>>("/admin/mail/events")
        : Promise.resolve([]),
      currentUser.role === "OWNER"
        ? api<Array<{ id: string; status?: string }>>("/admin/mail/queue")
        : Promise.resolve([]),
      currentUser.role === "OWNER"
        ? api<MaintenanceStatus>("/maintenance/status").catch(() => null)
        : Promise.resolve(null),
      api<PlatformBranding>("/platform-branding/public").catch(() => null),
    ]).then((results) => {
      const [audios, categories, buttons, users, history, invitesResult, storageResult, templatesResult, eventsResult, queueResult, maintenanceResult, brandingResult] = results;
      setData({
        audios: audios.status === "fulfilled" ? audios.value : [],
        categories: categories.status === "fulfilled" ? categories.value : [],
        buttons: buttons.status === "fulfilled" ? buttons.value : [],
        users: users.status === "fulfilled" ? users.value : [],
        history: history.status === "fulfilled" ? history.value : [],
        invites: invitesResult.status === "fulfilled" ? invitesResult.value : [],
      });
      setStorage(storageResult.status === "fulfilled" ? storageResult.value : null);
      setMailCounts({
        templates: templatesResult.status === "fulfilled" ? templatesResult.value.length : 0,
        events: eventsResult.status === "fulfilled" ? eventsResult.value.length : 0,
        queue: queueResult.status === "fulfilled" ? queueResult.value.length : 0,
        logs: history.status === "fulfilled" ? history.value.length : 0,
      });
      setMaintenance(maintenanceResult.status === "fulfilled" ? maintenanceResult.value : null);
      setBranding(brandingResult.status === "fulfilled" ? brandingResult.value : null);
    });
  }

  useEffect(() => {
    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const counts = useMemo(
    () => ({
      audios: data.audios.length,
      categories: data.categories.length,
      buttons: data.buttons.length,
      users: data.users.length,
      history: data.history.length,
    }),
    [data],
  );

  const metrics = useMemo<Metric[]>(
    () => [
      {
        label: "Audios",
        value: counts.audios,
        href: "/admin/audios",
        icon: Library,
        permission: "audio:create",
      },
      {
        label: "Plantillas",
        value: mailCounts.templates,
        href: "/admin/mail/templates",
        icon: Mail,
        permission: "audio:update",
        roles: ["OWNER"],
      },
      {
        label: "Eventos mail",
        value: mailCounts.events,
        href: "/admin/mail/events",
        icon: Mail,
        permission: "audio:update",
        roles: ["OWNER"],
      },
      {
        label: "Cola mail",
        value: mailCounts.queue,
        href: "/admin/mail/queue",
        icon: Mail,
        permission: "audio:update",
        roles: ["OWNER"],
      },
      {
        label: "Almacenamiento",
        value: storage ? formatBytes(storage.usage.audioAssetsBytes) : "-",
        href: "/admin/storage",
        icon: HardDrive,
        permission: "audio:update",
        roles: ["OWNER"],
      },
      {
        label: "Migraciones y backup",
        value: maintenance ? `${maintenance.backups.length} backups` : "Admin",
        href: "/admin/maintenance",
        icon: Database,
        permission: "audio:update",
        roles: ["OWNER"],
      },
      {
        label: "Branding",
        value: branding?.platformName ?? "Routlis",
        href: "/admin/platform",
        icon: Server,
        permission: "audio:update",
        roles: ["OWNER"],
      },
      {
        label: "Correo",
        value: "Operativo",
        href: "/admin/mail",
        icon: Mail,
        permission: "audio:update",
        roles: ["OWNER"],
      },
      {
        label: "Categorias",
        value: counts.categories,
        href: "/admin/categories",
        icon: ListMusic,
        permission: "category:create",
      },
      {
        label: "Botones",
        value: counts.buttons,
        href: "/admin/buttons",
        icon: PanelTop,
        permission: "button:create",
      },
      {
        label: "Usuarios",
        value: counts.users,
        href: "/admin/users",
        icon: Users,
        permission: "user:create",
      },
      {
        label: "Historial",
        value: mailCounts.logs + counts.history,
        href: "/admin/history",
        icon: History,
        permission: "history:read",
      },
    ],
    [branding?.platformName, counts.audios, counts.categories, counts.buttons, counts.history, mailCounts.events, mailCounts.logs, mailCounts.queue, mailCounts.templates, maintenance, storage],
  );

  const visibleMetrics = metrics.filter((metric) =>
    metric.roles
      ? metric.roles.includes(user?.role ?? "")
      : user?.permissions.includes(metric.permission),
  );
  const pendingInvites = data.invites.filter((invite) => invite.status === "PENDING");

  async function revokeInvite(inviteId: string, organizationId: string) {
    setRevokingInviteId(inviteId);
    try {
      await api(`/organizations/${organizationId}/invites/${inviteId}/revoke`, {
        method: "POST",
      });
      await loadDashboard(true);
    } finally {
      setRevokingInviteId(null);
    }
  }

  const statusBars = useMemo(
    () => [
      {
        label: "Audios activos",
        active: data.audios.filter((item) => item.isActive).length,
        inactive: data.audios.filter((item) => !item.isActive).length,
      },
      {
        label: "Categorias activas",
        active: data.categories.filter((item) => item.isActive).length,
        inactive: data.categories.filter((item) => !item.isActive).length,
      },
      {
        label: "Botones activos",
        active: data.buttons.filter((item) => item.isActive).length,
        inactive: data.buttons.filter((item) => !item.isActive).length,
      },
      {
        label: "Usuarios activos",
        active: data.users.filter(
          (item) => (item.membershipStatus ?? item.status) === "ACTIVE",
        ).length,
        inactive: data.users.filter(
          (item) => (item.membershipStatus ?? item.status) !== "ACTIVE",
        ).length,
      },
    ],
    [data],
  );

  const playbackSeries = useMemo(() => buildPlaybackSeries(data.history), [data.history]);
  const diskRows = useMemo(() => buildDiskRows(storage), [storage]);

  return (
    <AdminProtectedPage>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Estadísticas"
          description="Estado real de Routlis: operación, contenido, sistema y branding global."
        />
        <button
          type="button"
          onClick={() => void loadDashboard(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-outline bg-surface px-4 text-sm font-semibold text-on-surface hover:bg-surface-variant transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <DataState>Cargando estadisticas...</DataState>
      ) : (
        <div className="grid gap-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HealthCard
              icon={Activity}
              label="Frontend"
              value="Operativo"
              status={health.frontend}
            />
            <HealthCard
              icon={Server}
              label="Backend API"
              value={health.backend === "ok" ? "Operativo" : "Sin respuesta"}
              status={health.backend}
            />
            <HealthCard
              icon={Database}
              label="Base de datos"
              value={health.database === "ok" ? "Operativa" : "Sin respuesta"}
              status={health.database}
            />
            <HealthCard
              icon={Clock}
              label="Latencia"
              value={health.latencyMs === null ? "-" : `${health.latencyMs} ms`}
              status={health.backend}
              footer={
                health.checkedAt
                  ? `Ultima revision ${new Date(health.checkedAt).toLocaleTimeString()}`
                  : "Pendiente"
              }
            />
          </section>

          {user?.role === "OWNER" ? (
            <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
              <div className="rounded-xl border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                    Sistema y marca
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Branding global, mail y mantenimiento.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                  <InfoTile label="Marca" value={branding?.platformName ?? "Sin configurar"} />
                  <InfoTile label="Logo" value={branding?.logoUrl ? "Activo" : "Pendiente"} />
                  <InfoTile label="Favicon" value={branding?.faviconUrl ? "Activo" : "Pendiente"} />
                  <InfoTile label="Backups" value={maintenance ? String(maintenance.backups.length) : "-"} />
                  <InfoTile label="Plantillas mail" value={String(mailCounts.templates)} />
                  <InfoTile label="Eventos mail" value={String(mailCounts.events)} />
                </div>
              </div>

              <div className="rounded-xl border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                    Cola y actividad de mail
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Envíos, reintentos y actividad reciente.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                  <InfoTile label="Cola" value={String(mailCounts.queue)} />
                  <InfoTile label="Logs" value={String(mailCounts.logs)} />
                  <InfoTile label="Pendientes" value={pendingInvites.length ? String(pendingInvites.length) : "0"} />
                  <InfoTile label="Healthcheck" value={health.backend === "ok" ? "OK" : "Down"} />
                </div>
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
            {visibleMetrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <Link
                  key={metric.href}
                  href={metric.href}
                  className="rounded-xl border border-outline-variant bg-surface-container p-4 shadow-elevation-1 hover:border-outline transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-on-surface-variant">{metric.label}</p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-on-surface">
                        {metric.value}
                      </p>
                    </div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-outline-variant bg-surface-container p-5 shadow-elevation-1 2xl:p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                  Activos vs inactivos
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Distribución actual por módulo.
                </p>
              </div>
              <div className="grid gap-4">
                {statusBars.map((item) => (
                  <StackedStatusBar key={item.label} {...item} />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface-container p-5 shadow-elevation-1 2xl:p-6">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                    Reproducciones recientes
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Eventos agrupados por hora, refresco cada 10 segundos.
                  </p>
                </div>
                <span className="text-xs font-medium text-on-surface-variant">
                  {data.history.length} eventos cargados
                </span>
              </div>
              <LineChart data={playbackSeries} />
            </div>
          </section>

          {user?.role === "OWNER" ? (
            <section className="rounded-xl border border-outline-variant bg-surface-container p-5 shadow-elevation-1 2xl:p-6">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                    Invitaciones pendientes
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Vista global de invitaciones activas por organización.
                  </p>
                </div>
                <span className="text-xs font-medium text-on-surface-variant">
                  {pendingInvites.length} pendientes
                </span>
              </div>

              {pendingInvites.length ? (
                <div className="overflow-x-auto rounded-xl border border-outline-variant">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-surface-container-high text-xs uppercase text-on-surface-variant">
                      <tr>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Organización</th>
                        <th className="px-4 py-3">Rol</th>
                        <th className="px-4 py-3">Vence</th>
                        <th className="px-4 py-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingInvites.map((invite) => (
                        <tr key={invite.id} className="border-t border-outline-variant">
                          <td className="px-4 py-3">
                            <p className="font-medium text-on-surface">{invite.email}</p>
                            <p className="text-xs text-on-surface-variant">
                              {invite.invitedBy?.fullName ?? "Sistema"}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant">{invite.organization.name}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{invite.role}</td>
                          <td className="px-4 py-3 text-on-surface-variant">
                            {new Date(invite.expiresAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void revokeInvite(invite.id, invite.organization.id)}
                              disabled={revokingInviteId === invite.id}
                              className="danger-surface inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              {revokingInviteId === invite.id ? "Revocando..." : "Revocar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <DataState>No hay invitaciones pendientes.</DataState>
              )}
            </section>
          ) : null}

          <section className="rounded-xl border border-outline-variant bg-surface-container p-4 shadow-elevation-1 sm:p-5 2xl:p-6">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                  Uso de disco
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Separado por archivos de app, audios, builds y base local.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-on-surface-variant">
                <HardDrive className="h-4 w-4" />
                {storage
                  ? `${storage.filesystem.usedPercent}% del filesystem usado`
                  : "Sin lectura"}
              </span>
            </div>

            {storage ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
                <div className="grid gap-3 sm:grid-cols-3">
                  <DiskSummary
                    label="Total"
                    value={formatBytes(storage.filesystem.totalBytes)}
                  />
                  <DiskSummary
                    label="Usado"
                    value={formatBytes(storage.filesystem.usedBytes)}
                  />
                  <DiskSummary
                    label="Libre"
                    value={formatBytes(storage.filesystem.freeBytes)}
                  />
                </div>
                <div className="grid gap-3">
                  {diskRows.map((row) => (
                    <DiskUsageBar key={row.label} {...row} />
                  ))}
                </div>
              </div>
            ) : (
              <DataState>No se pudo leer el uso de disco.</DataState>
            )}
          </section>
        </div>
      )}
    </AdminProtectedPage>
  );
}

function DiskSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-high p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-on-surface">{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-high p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="mt-2 text-base font-semibold tracking-tight text-on-surface">{value}</p>
    </div>
  );
}

function DiskUsageBar({
  label,
  bytes,
  totalBytes,
  tone,
}: {
  label: string;
  bytes: number;
  totalBytes: number;
  tone: "emerald" | "blue" | "amber" | "zinc" | "red";
}) {
  const percent = totalBytes ? Math.max(1, Math.round((bytes / totalBytes) * 100)) : 0;
  const colors = {
    emerald: "bg-emerald-600",
    blue: "bg-sky-600",
    amber: "bg-amber-500",
    zinc: "bg-zinc-500",
    red: "bg-red-600",
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-on-surface">{label}</span>
        <span className="text-on-surface-variant">
          {formatBytes(bytes)} · {percent}%
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-surface-container-highest">
        <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function HealthCard({
  icon: Icon,
  label,
  value,
  status,
  footer,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  status: "ok" | "down";
  footer?: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container p-4 shadow-elevation-1 transition-colors hover:border-outline">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-on-surface-variant">{label}</p>
          <p className="mt-2 text-lg font-semibold tracking-tight text-on-surface">{value}</p>
        </div>
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            status === "ok"
              ? "bg-primary-container text-on-primary-container"
              : "bg-error-container text-on-error-container"
          }`}
        >
          <Icon className="h-6 w-6" />
        </span>
      </div>
      <p className="mt-4 text-xs text-on-surface-variant">
        {footer ?? (status === "ok" ? "Healthcheck OK" : "Revisar servicio")}
      </p>
    </div>
  );
}

function StackedStatusBar({
  label,
  active,
  inactive,
}: {
  label: string;
  active: number;
  inactive: number;
}) {
  const total = active + inactive;
  const activePercent = total ? Math.round((active / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-on-surface">{label}</span>
        <span className="text-on-surface-variant">
          {active} activos · {inactive} inactivos
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-surface-container-highest">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${activePercent}%` }}
        />
      </div>
    </div>
  );
}

function LineChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const width = 640;
  const height = 220;
  const padding = 28;
  const max = Math.max(1, ...data.map((item) => item.value));
  const points = data.map((item, index) => {
    const x =
      padding +
      (index * (width - padding * 2)) / Math.max(1, data.length - 1);
    const y =
      height - padding - (item.value / max) * (height - padding * 2);
    return { ...item, x, y };
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 min-w-[560px] w-full">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--md-sys-color-outline-variant)" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="var(--md-sys-color-outline-variant)" />
        <path d={path} fill="none" stroke="var(--md-sys-color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4" fill="var(--md-sys-color-primary)" />
            <text x={point.x} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--md-sys-color-on-surface-variant)">
              {point.label}
            </text>
            <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="11" fill="var(--md-sys-color-on-surface)">
              {point.value}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function buildPlaybackSeries(events: PlaybackEvent[]) {
  const now = new Date();
  const buckets = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now);
    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() - (11 - index));
    return {
      key: date.toISOString().slice(0, 13),
      label: date.toLocaleTimeString([], { hour: "2-digit" }),
      value: 0,
    };
  });

  for (const event of events) {
    const key = new Date(event.startedAt).toISOString().slice(0, 13);
    const bucket = buckets.find((item) => item.key === key);
    if (bucket) bucket.value += 1;
  }

  return buckets.map(({ label, value }) => ({ label, value }));
}

function buildDiskRows(storage: StorageHealth | null) {
  if (!storage) return [];

  const total = Math.max(1, storage.usage.trackedBytes);

  return [
    {
      label: "App total",
      bytes: storage.usage.appBytes,
      totalBytes: total,
      tone: "emerald" as const,
    },
    {
      label: "Audios",
      bytes: storage.usage.audioAssetsBytes,
      totalBytes: total,
      tone: "blue" as const,
    },
    {
      label: "Base local",
      bytes: storage.usage.localDatabaseBytes,
      totalBytes: total,
      tone: "amber" as const,
    },
    {
      label: "Backend source",
      bytes: storage.usage.backendSourceBytes,
      totalBytes: total,
      tone: "zinc" as const,
    },
    {
      label: "Backend build",
      bytes: storage.usage.backendBuildBytes,
      totalBytes: total,
      tone: "zinc" as const,
    },
    {
      label: "Frontend source",
      bytes: storage.usage.frontendSourceBytes,
      totalBytes: total,
      tone: "zinc" as const,
    },
    {
      label: "Frontend build",
      bytes: storage.usage.frontendBuildBytes,
      totalBytes: total,
      tone: "zinc" as const,
    },
    {
      label: "Documentos y scripts",
      bytes: storage.usage.documentsBytes + storage.usage.scriptsBytes,
      totalBytes: total,
      tone: "zinc" as const,
    },
  ];
}
