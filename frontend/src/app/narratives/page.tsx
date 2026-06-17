"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, History, Play, RefreshCw, Workflow } from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import type { AuthUser } from "@/types/routlis";
import type {
  NarrativeListItem,
  NarrativeRunDetail,
  NarrativeRunSummary,
} from "@/types/narratives";

export default function NarrativesPage() {
  const router = useRouter();
  const [narratives, setNarratives] = useState<NarrativeListItem[]>([]);
  const [runs, setRuns] = useState<NarrativeRunSummary[]>([]);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [startingNarrativeId, setStartingNarrativeId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);

    const [sessionResult, narrativesResult, runsResult] = await Promise.allSettled([
      api<{ user: AuthUser }>("/auth/me"),
      api<NarrativeListItem[]>("/narratives/active"),
      api<NarrativeRunSummary[]>("/narrative-runs"),
    ]);

    if (sessionResult.status === "fulfilled") {
      setCurrentOrganizationId(sessionResult.value.user.organizationId);
    } else {
      setCurrentOrganizationId("");
    }
    const activeOrgId =
      sessionResult.status === "fulfilled" ? sessionResult.value.user.organizationId : "";
    const visibleNarratives =
      narrativesResult.status === "fulfilled"
        ? narrativesResult.value.filter((narrative) => narrative.organizationId === activeOrgId)
        : [];
    const visibleRuns =
      runsResult.status === "fulfilled"
        ? runsResult.value.filter((run) => run.organizationId === activeOrgId)
        : [];

    setNarratives(visibleNarratives);
    setRuns(visibleRuns);
    if (sessionResult.status === "rejected" || narrativesResult.status === "rejected" || runsResult.status === "rejected") {
      setMessage("No se pudieron cargar todas las narrativas disponibles.");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function startNarrative(narrativeId: string) {
    setStartingNarrativeId(narrativeId);
    setMessage(null);
    try {
      const run = await api<NarrativeRunDetail>(`/narratives/${narrativeId}/runs`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      router.push(`/narratives/${narrativeId}/run?run=${run.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar la narrativa.");
      setStartingNarrativeId(null);
    }
  }

  const activeCount = useMemo(() => narratives.length, [narratives]);

  return (
    <ProtectedPage requiredPermissions={["narratives:run"]}>
      <div className="space-y-6">
        <PageHeader
          title="Narrativas"
          description="Selecciona un guion operativo activo para iniciar o revisar una ejecución."
          action={
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
            >
              <RefreshCw className="h-4 w-4" />
              Refrescar
            </button>
          }
        />

        <div className="rounded-[24px] border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
          Organización activa: <span className="font-medium text-on-surface">{currentOrganizationId || "—"}</span>
        </div>

        {message ? (
          <div className="rounded-[24px] border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.8fr)]">
          <section className="space-y-4">
            <div className="flex h-full flex-col rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1 xl:max-h-[calc(100dvh-18rem)]">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-on-primary">
                  <Workflow className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                    Narrativas activas
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    {loading ? "Cargando..." : `${activeCount} narrativas listas para ejecutar`}
                  </p>
                </div>
              </div>

              {loading ? (
                <DataState>Cargando narrativas activas...</DataState>
              ) : narratives.length > 0 ? (
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="grid gap-4 lg:grid-cols-2">
                  {narratives.map((narrative) => (
                    <article
                      key={narrative.id}
                      className="rounded-[24px] border border-outline-variant bg-surface px-4 py-4 shadow-elevation-1"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                            Activa
                          </p>
                          <h3 className="mt-1 text-lg font-semibold tracking-tight text-on-surface">
                            {narrative.title}
                          </h3>
                          <p className="mt-1 line-clamp-3 text-sm text-on-surface-variant">
                            {narrative.description || "Sin descripción"}
                          </p>
                          <p className="mt-2 text-xs text-on-surface-variant">
                            Organización:{" "}
                            <span className="font-medium text-on-surface">
                              {narrative.organization?.name ?? "—"}
                            </span>
                          </p>
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-tertiary text-on-tertiary">
                          <Play className="h-4 w-4" />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-on-surface-variant">
                          <p>
                            Versión publicada{" "}
                            <span className="font-semibold text-on-surface">
                              v{narrative.publishedVersion?.versionNumber ?? "-"}
                            </span>
                          </p>
                          <p>Actualizada {new Date(narrative.updatedAt).toLocaleDateString("es-CO")}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void startNarrative(narrative.id)}
                          disabled={startingNarrativeId === narrative.id}
                          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-on-primary transition-transform hover:scale-[1.01] disabled:cursor-wait disabled:opacity-70"
                        >
                          {startingNarrativeId === narrative.id ? "Iniciando..." : "Iniciar"}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  ))}
                  </div>
                </div>
              ) : (
                <DataState>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <p>No hay narrativas activas disponibles.</p>
                    <p className="text-xs text-on-surface-variant">
                      Cuando un ADMIN publique una narrativa aparecerá aquí para ejecución.
                    </p>
                  </div>
                </DataState>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="flex h-full flex-col rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1 xl:max-h-[calc(100dvh-18rem)]">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-on-primary">
                  <History className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                    Ejecuciones activas
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Reanuda o revisa narrativas ya iniciadas.
                  </p>
                </div>
              </div>

              {runs.length > 0 ? (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {runs.map((run) => (
                    <article
                      key={run.id}
                      className="rounded-[24px] border border-outline-variant bg-surface px-4 py-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                        {run.status}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-on-surface">
                        {run.narrative.title}
                      </h3>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Organización:{" "}
                        <span className="font-medium text-on-surface">
                          {run.narrative.organization?.name ?? "—"}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        Iniciada v{run.narrativeVersion.versionNumber}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Nodo actual: {run.currentNodeId || "Sin nodo"}
                      </p>

                      <div className="mt-3">
                        <Link
                          href={`/narratives/${run.narrativeId}/run?run=${run.id}`}
                          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
                        >
                          Reanudar
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <DataState>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <p>No hay ejecuciones activas.</p>
                    <p className="text-xs text-on-surface-variant">
                      Inicia una narrativa para verla en esta sección.
                    </p>
                  </div>
                </DataState>
              )}
            </div>
          </aside>
        </div>
      </div>
    </ProtectedPage>
  );
}
