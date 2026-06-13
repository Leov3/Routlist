"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { NarrativePlayer } from "@/components/narratives/player/NarrativePlayer";

type StartRunResult = {
  id: string;
};

export default function NarrativeRunPage() {
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawId = params?.id;
  const narrativeId = Array.isArray(rawId) ? rawId[0] : rawId;
  const existingRunId = searchParams.get("run");

  const [runId, setRunId] = useState<string | null>(existingRunId);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const startAttemptedRef = useRef(false);

  useEffect(() => {
    setRunId(existingRunId);
    if (existingRunId) {
      startAttemptedRef.current = true;
      setStarting(false);
    }
  }, [existingRunId]);

  useEffect(() => {
    if (!narrativeId || runId || starting || startAttemptedRef.current) return;

    let cancelled = false;
    async function start() {
      startAttemptedRef.current = true;
      setStarting(true);
      setMessage(null);
      try {
        const result = await api<StartRunResult>(`/narratives/${narrativeId}/runs`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        if (cancelled) return;
        setRunId(result.id);
        router.replace(`/narratives/${narrativeId}/run?run=${result.id}`);
      } catch (error) {
        if (!cancelled) {
          startAttemptedRef.current = false;
          setMessage(error instanceof Error ? error.message : "No se pudo iniciar la narrativa.");
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    void start();

    return () => {
      cancelled = true;
    };
  }, [narrativeId, runId, router, starting]);

  return (
    <ProtectedPage requiredPermissions={["narratives:run"]}>
      <div className="space-y-6">
        <PageHeader
          title="Player narrativo"
          description="Ejecuta el flujo guiado paso a paso para la operación diaria."
          action={
            <Link
              href="/narratives"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          }
        />

        {message ? (
          <div className="rounded-[24px] border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
            {message}
          </div>
        ) : null}

        {!narrativeId || (!runId && starting) ? (
          <div className="flex min-h-[40vh] items-center justify-center rounded-[28px] border border-outline-variant bg-surface-container text-sm text-on-surface-variant shadow-elevation-1">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Preparando la ejecución...
            </div>
          </div>
        ) : runId ? (
          <NarrativePlayer runId={runId} />
        ) : (
          <div className="rounded-[28px] border border-outline-variant bg-surface-container p-6 shadow-elevation-1">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-on-primary">
                <Play className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-on-surface">Inicia la narrativa</h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Se abrirá una nueva ejecución cuando el player termine de preparar el flujo.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
