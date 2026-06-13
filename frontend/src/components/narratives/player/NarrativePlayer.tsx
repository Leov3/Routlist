"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Square,
  SkipForward,
  StopCircle,
  TriangleAlert,
} from "lucide-react";
import { api, apiUrl } from "@/lib/api";
import type {
  NarrativeGraphEdge,
  NarrativeGraphJson,
  NarrativeGraphNode,
  NarrativeNodeType,
  NarrativeRunDetail,
  NarrativeRunEventType,
} from "@/types/narratives";

type NarrativePlayerProps = {
  runId: string;
  onReloadRequest?: () => void;
};

type NodeActionState = {
  label: string;
  targetNodeId?: string;
  eventType?: NarrativeRunEventType;
};

type StepStatus = "completed" | "current" | "pending";

type NodeMeta = NarrativeGraphNode & {
  data?: Record<string, unknown>;
};

function readGraph(graphJson?: NarrativeGraphJson | null) {
  const nodes = Array.isArray(graphJson?.nodes) ? graphJson!.nodes : [];
  const edges = Array.isArray(graphJson?.edges) ? graphJson!.edges : [];
  return { nodes, edges };
}

function nodeLabel(node: NodeMeta | undefined) {
  if (!node) return "Nodo desconocido";
  const data = node.data ?? {};
  return (
    String(data.title ?? data.label ?? "") ||
    ({
      START: "Inicio",
      AUDIO: "Audio",
      SCRIPT_TEXT: "Texto / Guion",
      INSTRUCTION: "Instrucción",
      PAUSE: "Pausa",
      DECISION: "Decisión",
      END: "Fin",
    }[node.type as NarrativeNodeType] ?? node.type)
  );
}

function nodeSummary(node: NodeMeta | undefined) {
  if (!node) return "";

  const data = node.data ?? {};
  const nodeType = node.type as NarrativeNodeType;

  if (nodeType === "AUDIO") {
    return data.audioAssetId ? `Audio ${String(data.audioAssetId)}` : "Sin audio asignado";
  }
  if (nodeType === "SCRIPT_TEXT") {
    return data.body ? String(data.body) : "Sin texto";
  }
  if (nodeType === "INSTRUCTION") {
    return data.instruction ? String(data.instruction) : "Sin instrucción";
  }
  if (nodeType === "PAUSE") {
    return data.manual === false
      ? `Pausa temporizada${data.durationSeconds ? ` · ${String(data.durationSeconds)} s` : ""}`
      : "Pausa manual";
  }
  if (nodeType === "DECISION") {
    return data.question ? String(data.question) : "Sin pregunta";
  }

  return "";
}

function nodeStatus(nodeId: string, completedIds: Set<string>, currentNodeId?: string | null) {
  if (currentNodeId === nodeId) return "current" as const;
  if (completedIds.has(nodeId)) return "completed" as const;
  return "pending" as const;
}

function statusTone(status: StepStatus) {
  if (status === "completed") {
    return "border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-300";
  }
  if (status === "current") {
    return "border-primary/30 bg-primary/10 text-primary";
  }
  return "border-outline-variant bg-surface-container text-on-surface-variant";
}

function findOutgoingEdges(nodeId: string, edges: NarrativeGraphEdge[]) {
  return edges.filter((edge) => edge.source === nodeId);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function NarrativePlayer({ runId, onReloadRequest }: NarrativePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [run, setRun] = useState<NarrativeRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [runCompleted, setRunCompleted] = useState(false);
  const [selectedDecisionTarget, setSelectedDecisionTarget] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => readGraph(run?.narrativeVersion.graphJson ?? null), [run]);
  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node] as const)),
    [nodes],
  );

  const currentNode = run?.currentNodeId ? nodeMap.get(run.currentNodeId) : undefined;
  const completedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of run?.events ?? []) {
      if (event.eventType === "NODE_COMPLETED" || event.eventType === "NODE_SKIPPED") {
        ids.add(event.nodeId);
      }
    }
    return ids;
  }, [run?.events]);

  const currentStatus = currentNode ? nodeStatus(currentNode.id, completedIds, run?.currentNodeId) : "pending";
  const outgoing = currentNode ? findOutgoingEdges(currentNode.id, edges) : [];
  const decisionChoices = currentNode?.type === "DECISION"
    ? outgoing.map((edge) => ({
        label: edge.label?.trim() || "Opción",
        targetNodeId: edge.target,
      }))
    : [];

  const orderedNodes = useMemo(() => {
    if (!nodes.length) return [];

    const byId = new Map(nodes.map((node) => [node.id, node] as const));
    const startingNode = nodes.find((node) => node.type === "START") ?? nodes[0];
    const result: NodeMeta[] = [];
    const visited = new Set<string>();
    let currentId: string | undefined = startingNode?.id;

    while (currentId && !visited.has(currentId)) {
      const node = byId.get(currentId);
      if (!node) break;
      result.push(node);
      visited.add(currentId);
      const next = edges.find((edge) => edge.source === currentId);
      currentId = next?.target;
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        result.push(node);
      }
    }

    return result;
  }, [edges, nodes]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const detail = await api<NarrativeRunDetail>(`/narrative-runs/${runId}`);
      setRun(detail);
      setRunCompleted(detail.status !== "RUNNING");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la ejecución.");
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setSelectedDecisionTarget(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setIsPlaying(false);
  }, [run?.currentNodeId]);

  async function syncCurrentNode(nextNodeId: string, eventType: NarrativeRunEventType, payload?: Record<string, unknown>) {
    if (!run) return;

    setWorking(true);
    setMessage(null);

    try {
      await api(`/narrative-runs/${run.id}/events`, {
        method: "POST",
        body: JSON.stringify({
          eventType,
          nodeId: run.currentNodeId ?? nextNodeId,
          payload,
        }),
      });

      await api(`/narrative-runs/${run.id}/current-node`, {
        method: "PATCH",
        body: JSON.stringify({ currentNodeId: nextNodeId }),
      });

      await load();
      onReloadRequest?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la ejecución.");
    } finally {
      setWorking(false);
    }
  }

  async function completeCurrentNode(skip = false) {
    if (!run || !currentNode) return;

    if (currentNode.type === "END") {
      await finishRun();
      return;
    }

    const next = outgoing[0];
    if (!next) {
      await finishRun();
      return;
    }

    await syncCurrentNode(
      next.target,
      skip ? "NODE_SKIPPED" : "NODE_COMPLETED",
      skip ? { skipped: true } : { completed: true },
    );
  }

  async function handleDecision(targetNodeId: string, label: string) {
    if (!run) return;
    setSelectedDecisionTarget(targetNodeId);
    await syncCurrentNode(targetNodeId, "DECISION_SELECTED", {
      choiceLabel: label,
      targetNodeId,
    });
  }

  async function startAudioPlayback() {
    if (!run || !currentNode || currentNode.type !== "AUDIO") return;
    const audioAssetId = currentNode.data?.audioAssetId as string | undefined;
    if (!audioAssetId) {
      setMessage("Este nodo no tiene audio asignado.");
      return;
    }

    try {
      setWorking(true);
      setMessage(null);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      const response = await fetch(apiUrl(`/audio-assets/${audioAssetId}/narrative-stream`), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("No se pudo cargar el audio.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;

      if (!audioRef.current) return;

      audioRef.current.src = objectUrl;
      audioRef.current.volume = 1;
      await audioRef.current.play();
      setIsPlaying(true);

      await api(`/narrative-runs/${run.id}/events`, {
        method: "POST",
        body: JSON.stringify({
          eventType: "AUDIO_PLAYED",
          nodeId: currentNode.id,
          payload: { audioAssetId },
        }),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo reproducir el audio.");
    } finally {
      setWorking(false);
    }
  }

  async function pauseAudio() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  }

  async function resumeAudio() {
    if (!audioRef.current) return;
    await audioRef.current.play();
    setIsPlaying(true);
  }

  async function stopAudio() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  }

  async function finishRun() {
    if (!run) return;
    setWorking(true);
    setMessage(null);
    try {
      await api(`/narrative-runs/${run.id}/complete`, {
        method: "POST",
      });
      await load();
      setRunCompleted(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo finalizar la ejecución.");
    } finally {
      setWorking(false);
    }
  }

  async function cancelRun() {
    if (!run) return;
    setWorking(true);
    setMessage(null);
    try {
      await api(`/narrative-runs/${run.id}/cancel`, {
        method: "POST",
      });
      await load();
      setRunCompleted(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cancelar la ejecución.");
    } finally {
      setWorking(false);
    }
  }

  const activeAudioNodeId = currentNode?.type === "AUDIO" ? currentNode.id : null;
  const audioAssetId = currentNode?.type === "AUDIO" ? String(currentNode.data?.audioAssetId ?? "") : "";
  const hasAudio = Boolean(audioAssetId);

  if (loading) {
    return (
      <div className="rounded-[28px] border border-outline-variant bg-surface-container p-6 text-sm text-on-surface-variant shadow-elevation-1">
        Cargando player narrativo...
      </div>
    );
  }

  if (!run || !currentNode) {
    return (
      <div className="rounded-[28px] border border-outline-variant bg-surface-container p-6 shadow-elevation-1">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
            <TriangleAlert className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-on-surface">No se encontró la ejecución</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Vuelve a intentar desde el listado de narrativas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const eventLog = [...(run.events ?? [])].slice().reverse().slice(0, 10);

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-[24px] border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant shadow-elevation-1">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <section className="space-y-4 rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Narrativa en ejecución
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-on-surface">
                {run.narrative.title}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
                {run.narrative.description || "Sin descripción"}
              </p>
            </div>

            <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-on-surface-variant">Estado</p>
              <p className="mt-1 text-sm font-semibold text-on-surface">{run.status}</p>
              <p className="text-xs text-on-surface-variant">
                Inicio: {formatDateTime(run.startedAt)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.1fr_.9fr]">
            <div className="rounded-[24px] border border-outline-variant bg-surface px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Paso actual
              </p>
              <div className="mt-3 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary">
                  {currentNode.type.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold tracking-tight text-on-surface">
                    {nodeLabel(currentNode)}
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    {currentNode.type}
                    {currentNode.type === "AUDIO" && hasAudio ? ` · Audio ${audioAssetId}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-dashed border-outline-variant bg-surface-container px-4 py-4">
                {currentNode.type === "AUDIO" ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-on-surface">{nodeSummary(currentNode)}</p>
                    <audio
                      ref={audioRef}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      onLoadedMetadata={() => setMessage(null)}
                      className="hidden"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void startAudioPlayback()}
                        disabled={working || !hasAudio}
                        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Play className="h-4 w-4" />
                        Reproducir audio
                      </button>
                      <button
                        type="button"
                        onClick={() => void pauseAudio()}
                        disabled={!isPlaying}
                        className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Pause className="h-4 w-4" />
                        Pausar
                      </button>
                      <button
                        type="button"
                        onClick={() => void resumeAudio()}
                        disabled={isPlaying}
                        className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Play className="h-4 w-4" />
                        Reanudar
                      </button>
                      <button
                        type="button"
                        onClick={() => void stopAudio()}
                        className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
                      >
                        <Square className="h-4 w-4" />
                        Detener
                      </button>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {isPlaying ? "Reproducción activa" : "Audio listo para reproducirse"}
                    </p>
                  </div>
                ) : currentNode.type === "SCRIPT_TEXT" ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Texto para leer</p>
                    <p className="whitespace-pre-wrap text-base leading-7 text-on-surface">
                      {String(currentNode.data?.body ?? "Sin contenido")}
                    </p>
                  </div>
                ) : currentNode.type === "INSTRUCTION" ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Instrucción operativa</p>
                    <p className="whitespace-pre-wrap text-base leading-7 text-on-surface">
                      {String(currentNode.data?.instruction ?? "Sin instrucción")}
                    </p>
                  </div>
                ) : currentNode.type === "PAUSE" ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Pausa</p>
                    <p className="text-base leading-7 text-on-surface">
                      {currentNode.data?.manual === false
                        ? `Pausa temporizada de ${String(currentNode.data?.durationSeconds ?? "0")} segundos.`
                        : "Pausa manual. Espera la señal para continuar."}
                    </p>
                  </div>
                ) : currentNode.type === "DECISION" ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Decisión</p>
                    <p className="text-base leading-7 text-on-surface">
                      {String(currentNode.data?.question ?? "¿Qué sigue?")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {decisionChoices.length > 0 ? (
                        decisionChoices.map((choice) => (
                          <button
                            key={`${choice.targetNodeId}-${choice.label}`}
                            type="button"
                            onClick={() => void handleDecision(choice.targetNodeId, choice.label)}
                            disabled={working}
                            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors ${
                              selectedDecisionTarget === choice.targetNodeId
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-outline-variant bg-surface text-on-surface hover:border-primary"
                            }`}
                          >
                            <ArrowRight className="h-4 w-4" />
                            {choice.label}
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-on-surface-variant">
                          No hay salidas configuradas para esta decisión.
                        </p>
                      )}
                    </div>
                  </div>
                ) : currentNode.type === "END" ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Cierre</p>
                    <p className="text-base leading-7 text-on-surface">
                      La narrativa llegó al nodo final.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">
                    Sin contenido para mostrar.
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void completeCurrentNode(false)}
                  disabled={working || run.status !== "RUNNING"}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <SkipForward className="h-4 w-4" />
                  Siguiente
                </button>
                <button
                  type="button"
                  onClick={() => void completeCurrentNode(true)}
                  disabled={working || run.status !== "RUNNING" || currentNode.data?.required !== false}
                  className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" />
                  Omitir
                </button>
                <button
                  type="button"
                  onClick={() => void finishRun()}
                  disabled={working || run.status !== "RUNNING"}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-300"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Finalizar
                </button>
                <button
                  type="button"
                  onClick={() => void cancelRun()}
                  disabled={working || run.status !== "RUNNING"}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-300 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300"
                >
                  <StopCircle className="h-4 w-4" />
                  Cancelar
                </button>
              </div>

              {currentStatus === "current" ? (
                <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                  Estás en el paso actual de la narrativa.
                </div>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-outline-variant bg-surface px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Resumen
              </p>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Versión</span>
                  <span className="font-semibold text-on-surface">v{run.narrativeVersion.versionNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Paso actual</span>
                  <span className="font-semibold text-on-surface">{currentNode.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Eventos</span>
                  <span className="font-semibold text-on-surface">{run.events?.length ?? 0}</span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-outline-variant bg-surface-container p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                  Ruta
                </p>
                <div className="mt-3 space-y-2">
                  {orderedNodes.map((node) => {
                    const status = nodeStatus(node.id, completedIds, run.currentNodeId);
                    return (
                      <div
                        key={node.id}
                        className={`rounded-2xl border px-3 py-3 text-xs ${statusTone(status)}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-on-surface">{nodeLabel(node)}</span>
                          <span className="uppercase tracking-[0.18em]">{node.type}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] text-on-surface-variant">
                          {nodeSummary(node)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4 rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Actividad
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-on-surface">
              Eventos recientes
            </h3>
          </div>

          <div className="space-y-2">
            {eventLog.length > 0 ? (
              eventLog.map((event) => (
                <div key={event.id} className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-on-surface">{event.eventType}</p>
                    <span className="text-[11px] text-on-surface-variant">
                      {formatDateTime(event.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Nodo {event.nodeId}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-outline-variant px-4 py-8 text-center text-sm text-on-surface-variant">
                Todavía no hay eventos en esta ejecución.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-4 text-sm text-on-surface-variant">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                El player avanza por la ruta publicada y mantiene la ejecución asociada a esta sesión.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
