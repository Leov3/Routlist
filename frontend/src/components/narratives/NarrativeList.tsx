"use client";

import Link from "next/link";
import { ArrowUpRight, Copy, Edit3, RefreshCw } from "lucide-react";
import type { NarrativeListItem } from "@/types/narratives";
import { DataState } from "@/components/ui/DataState";

type NarrativeListProps = {
  narratives: NarrativeListItem[];
  onRefresh: () => void;
  onDuplicate: (id: string) => Promise<void>;
  canCreate: boolean;
  currentOrganizationId?: string;
};

function narrativeStatusLabel(status: NarrativeListItem["status"]) {
  if (status === "ACTIVE") return "Activa";
  if (status === "ARCHIVED") return "Archivada";
  return "Borrador";
}

function formatRelativeDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = date.getTime() - Date.now();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffHours) < 24) {
    return diffHours === 0
      ? "hace un momento"
      : diffHours > 0
        ? `en ${diffHours} h`
        : `hace ${Math.abs(diffHours)} h`;
  }

  return diffDays > 0 ? `en ${diffDays} días` : `hace ${Math.abs(diffDays)} días`;
}

export function NarrativeList({
  narratives,
  onRefresh,
  onDuplicate,
  canCreate,
  currentOrganizationId,
}: NarrativeListProps) {
  const visibleNarratives = currentOrganizationId
    ? narratives.filter((narrative) => narrative.organizationId === currentOrganizationId)
    : narratives;
  const hiddenCount = narratives.length - visibleNarratives.length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-on-surface">
            Narrativas
          </h2>
          <p className="text-sm text-on-surface-variant">
            Diseña flujos operativos y ejecútalos desde el player guiado.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="btn-surface-base btn-secondary-surface h-10 w-full rounded-2xl px-4 text-sm sm:w-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Recargar
        </button>
      </div>

      {hiddenCount > 0 ? (
        <div className="warning-surface rounded-2xl px-4 py-3 text-sm">
          Se ocultaron {hiddenCount} narrativa(s) que no pertenecen a la organización activa.
        </div>
      ) : null}

      {visibleNarratives.length > 0 ? (
        <>
          <div className="space-y-3 md:hidden">
            {visibleNarratives.map((narrative) => (
              <div
                key={narrative.id}
                className="rounded-[24px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-on-surface">{narrative.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                      {narrative.description || "Sin descripción"}
                    </p>
                  </div>
                  <span className="rounded-full border border-outline-variant bg-surface px-2.5 py-1 text-[10px] font-semibold text-on-surface">
                    {narrativeStatusLabel(narrative.status)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-on-surface-variant">
                  <div className="flex items-center justify-between gap-3">
                    <span>Organización</span>
                    <span className="truncate font-medium text-on-surface">
                      {narrative.organization?.name ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Versiones</span>
                    <span className="font-medium text-on-surface">{narrative._count?.versions ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Actualizada</span>
                    <span className="font-medium text-on-surface">{formatRelativeDate(narrative.updatedAt)}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <Link
                    href={`/admin/narratives/${narrative.id}/builder`}
                    className="btn-surface-base btn-secondary-surface inline-flex h-10 w-full items-center justify-center rounded-2xl px-3 text-xs"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Builder
                  </Link>
                  <button
                    type="button"
                    onClick={() => void onDuplicate(narrative.id)}
                    className="btn-surface-base btn-secondary-surface inline-flex h-10 w-full items-center justify-center rounded-2xl px-3 text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplicar
                  </button>
                  <Link
                    href={`/narratives/${narrative.id}/run`}
                    className="btn-surface-base btn-primary-surface inline-flex h-10 w-full items-center justify-center rounded-2xl px-3 text-xs"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Ejecutar
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-[28px] border border-outline-variant bg-surface-container shadow-elevation-1 md:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-surface-container-high text-xs uppercase tracking-widest text-on-surface-variant">
              <tr>
                <th className="px-5 py-3">Narrativa</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Organización</th>
                <th className="px-5 py-3">Versiones</th>
                <th className="px-5 py-3">Actualizada</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleNarratives.map((narrative) => (
                <tr key={narrative.id} className="border-t border-outline-variant">
                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-on-surface">{narrative.title}</p>
                      <p className="max-w-[420px] truncate text-xs text-on-surface-variant">
                        {narrative.description || "Sin descripción"}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full border border-outline-variant bg-surface px-3 py-1 text-xs font-semibold text-on-surface">
                      {narrativeStatusLabel(narrative.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-on-surface-variant">
                    <div className="space-y-1">
                      <p className="font-medium text-on-surface">
                        {narrative.organization?.name ?? "—"}
                      </p>
                      <p className="text-xs">
                        {narrative.organizationId ?? narrative.organization?.id ?? "—"}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-on-surface-variant">
                    {narrative._count?.versions ?? 0} versiones
                    {narrative.publishedVersion?.versionNumber ? (
                      <span className="block text-xs">
                        Publicada v{narrative.publishedVersion.versionNumber}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-sm text-on-surface-variant">
                    {formatRelativeDate(narrative.updatedAt)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/narratives/${narrative.id}/builder`}
                        className="btn-surface-base btn-secondary-surface h-9 rounded-2xl px-3 text-xs"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Builder
                      </Link>
                      <button
                        type="button"
                        onClick={() => void onDuplicate(narrative.id)}
                        className="btn-surface-base btn-secondary-surface h-9 rounded-2xl px-3 text-xs"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Duplicar
                      </button>
                      <Link
                        href={`/narratives/${narrative.id}/run`}
                        className="btn-surface-base btn-primary-surface h-9 rounded-2xl px-3 text-xs"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Ejecutar
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : (
        <DataState>
          <div className="flex flex-col items-center gap-2 text-center">
            <p>No hay narrativas todavía.</p>
            {canCreate ? (
              <p className="text-xs text-on-surface-variant">
                Crea la primera para empezar a construir el flujo.
              </p>
            ) : null}
          </div>
        </DataState>
      )}
    </section>
  );
}
