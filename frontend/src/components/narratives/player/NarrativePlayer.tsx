"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  AlertCircle,
  ArrowRight,
  Copy,
  Crosshair,
  CheckCircle2,
  Clock3,
  Lock,
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
import { ApiError } from "@/lib/api";

type NarrativePlayerProps = {
  runId: string;
  onReloadRequest?: () => void;
};

type NodeActionState = {
  label: string;
  targetNodeId?: string;
  eventType?: NarrativeRunEventType;
};

type PlayerNodeState =
  | "current"
  | "completed"
  | "available"
  | "locked"
  | "skipped"
  | "error"
  | "decision-selected";

type PlayerEdgeState = "traversed" | "active" | "pending" | "not-taken";

type NodeMeta = NarrativeGraphNode & {
  data?: Record<string, unknown>;
};

type PlayerFlowNodeData = {
  label: string;
  summary: string;
  status: PlayerNodeState;
  type: NarrativeNodeType;
};

function PlayerFlowNode({ data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const statusClass =
    data.status === "current"
      ? "border-primary bg-primary/12 shadow-[0_0_0_1px_rgba(168,139,250,0.28)]"
      : data.status === "completed"
        ? "border-emerald-400/40 bg-emerald-500/8"
        : data.status === "available"
          ? "border-sky-400/35 bg-sky-500/8"
          : data.status === "skipped"
            ? "border-amber-400/35 bg-amber-500/8"
            : data.status === "error"
              ? "border-red-400/40 bg-red-500/10"
              : data.status === "decision-selected"
                ? "border-fuchsia-400/40 bg-fuchsia-500/10"
                : "border-outline-variant bg-surface opacity-70";

  return (
    <div
      className={`min-w-[220px] rounded-2xl border px-4 py-3 text-left shadow-elevation-1 transition-colors ${statusClass} ${
        selected ? "ring-2 ring-primary/30" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
            {data.type}
          </p>
          <p className="mt-1 text-sm font-semibold text-on-surface">{data.label}</p>
        </div>
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full ${
            data.status === "current"
              ? "bg-primary"
              : data.status === "completed"
                ? "bg-emerald-400"
                : data.status === "available"
                  ? "bg-sky-400"
                  : data.status === "skipped"
                    ? "bg-amber-400"
                    : data.status === "error"
                      ? "bg-red-400"
                      : data.status === "decision-selected"
                        ? "bg-fuchsia-400"
                        : "bg-slate-500"
          }`}
        />
      </div>
      <p className="mt-2 line-clamp-3 text-xs text-on-surface-variant">{data.summary || "Sin resumen"}</p>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

const playerNodeTypes: NodeTypes = {
  playerNode: PlayerFlowNode,
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
      AUDIO_BUTTON: "Botón de Audio",
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
  if (nodeType === "AUDIO_BUTTON") {
    return data.audioButtonId ? `Botón ${String(data.audioButtonId)}` : "Sin botón asignado";
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

function statusTone(status: PlayerNodeState) {
  if (status === "completed") {
    return "border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-300";
  }
  if (status === "current") {
    return "border-primary/30 bg-primary/10 text-primary";
  }
  if (status === "available") {
    return "border-sky-300 bg-sky-500/10 text-sky-700 dark:border-sky-900/50 dark:text-sky-300";
  }
  if (status === "skipped") {
    return "border-amber-300 bg-amber-500/10 text-amber-700 dark:border-amber-900/50 dark:text-amber-300";
  }
  if (status === "error") {
    return "border-red-300 bg-red-500/10 text-red-700 dark:border-red-900/50 dark:text-red-300";
  }
  if (status === "decision-selected") {
    return "border-fuchsia-300 bg-fuchsia-500/10 text-fuchsia-700 dark:border-fuchsia-900/50 dark:text-fuchsia-300";
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

function boolLabel(value: unknown, truthy: string, falsy: string) {
  return value ? truthy : falsy;
}

export function NarrativePlayer({ runId, onReloadRequest }: NarrativePlayerProps) {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const reactFlowRef = useRef<ReactFlowInstance<Node<PlayerFlowNodeData>, Edge> | null>(null);
  const [run, setRun] = useState<NarrativeRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [runCompleted, setRunCompleted] = useState(false);
  const [selectedDecisionTarget, setSelectedDecisionTarget] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [currentButtonDetails, setCurrentButtonDetails] = useState<any>(null);
  const [buttonDetailsError, setButtonDetailsError] = useState<string | null>(null);
  const [pauseRemainingSeconds, setPauseRemainingSeconds] = useState<number | null>(null);

  function handleApiError(error: unknown, fallbackMessage: string) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        router.replace("/login");
        return "Tu sesión expiró o fue cerrada en otro dispositivo.";
      }
      if (error.status === 403) {
        return "No tienes permisos para ejecutar esta narrativa.";
      }
      return error.message || fallbackMessage;
    }

    return error instanceof Error ? error.message : fallbackMessage;
  }

  const { nodes, edges } = useMemo(() => readGraph(run?.narrativeVersion.graphJson ?? null), [run]);
  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node] as const)),
    [nodes],
  );

  const currentNode = run?.currentNodeId ? nodeMap.get(run.currentNodeId) : undefined;
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : undefined;
  const actionNode = selectedNode ?? currentNode;

  useEffect(() => {
    if (currentNode?.id) {
      setSelectedNodeId((previous) => previous ?? currentNode.id);
    }
  }, [currentNode?.id]);

  useEffect(() => {
    if (actionNode?.type === "AUDIO_BUTTON" && actionNode.data?.audioButtonId) {
      setButtonDetailsError(null);
      api(`/audio-buttons/${actionNode.data.audioButtonId}`)
        .then((res) => {
          setCurrentButtonDetails(res);
          setButtonDetailsError(null);
        })
        .catch((err) => {
          console.error("Error loading button details", err);
          setCurrentButtonDetails(null);
          setButtonDetailsError("No se pudo cargar el detalle del botón o el recurso ya no está disponible.");
        });
    } else {
      setCurrentButtonDetails(null);
      setButtonDetailsError(null);
    }
  }, [actionNode]);

  const completedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of run?.events ?? []) {
      if (event.eventType === "NODE_COMPLETED" || event.eventType === "NODE_SKIPPED") {
        ids.add(event.nodeId);
      }
    }
    return ids;
  }, [run?.events]);

  const skippedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of run?.events ?? []) {
      if (event.eventType === "NODE_SKIPPED") {
        ids.add(event.nodeId);
      }
    }
    return ids;
  }, [run?.events]);

  const selectedDecisionTargets = useMemo(() => {
    const targets = new Map<string, string>();
    for (const event of run?.events ?? []) {
      if (event.eventType === "DECISION_SELECTED") {
        const targetNodeId = typeof event.payload?.targetNodeId === "string" ? event.payload.targetNodeId : undefined;
        if (targetNodeId) {
          targets.set(event.nodeId, targetNodeId);
        }
      }
    }
    return targets;
  }, [run?.events]);

  const availableIds = useMemo(() => {
    const ids = new Set<string>();
    if (!currentNode) return ids;
    ids.add(currentNode.id);
    for (const edge of edges) {
      if (edge.source === currentNode.id) {
        ids.add(edge.target);
      }
    }
    return ids;
  }, [currentNode, edges]);

  const nodeStates = useMemo(() => {
    const states = new Map<string, PlayerNodeState>();
    for (const node of nodes) {
      const data = node.data ?? {};
      const type = node.type as NarrativeNodeType;
      let state: PlayerNodeState = "locked";

      const hasError =
        (type === "AUDIO" && !data.audioAssetId) ||
        (type === "AUDIO_BUTTON" && !data.audioButtonId) ||
        (type === "SCRIPT_TEXT" && !data.body) ||
        (type === "INSTRUCTION" && !data.instruction) ||
        (type === "DECISION" && findOutgoingEdges(node.id, edges).length === 0);

      if (hasError) {
        state = "error";
      } else if (run?.currentNodeId === node.id) {
        state = "current";
      } else if (skippedIds.has(node.id)) {
        state = "skipped";
      } else if (completedIds.has(node.id)) {
        state = "completed";
      } else if (selectedDecisionTargets.has(node.id)) {
        state = "decision-selected";
      } else if (availableIds.has(node.id)) {
        state = "available";
      }

      states.set(node.id, state);
    }
    return states;
  }, [availableIds, completedIds, edges, nodes, run?.currentNodeId, selectedDecisionTargets, skippedIds]);

  const currentStatus = currentNode ? nodeStates.get(currentNode.id) ?? "locked" : "locked";
  const actionNodeState = actionNode ? nodeStates.get(actionNode.id) ?? "locked" : "locked";
  const actionNodeIsCurrent = actionNode?.id === currentNode?.id;
  const actionNodeIsInteractive = actionNodeIsCurrent && run?.status === "RUNNING";
  const outgoing = currentNode ? findOutgoingEdges(currentNode.id, edges) : [];
  const decisionChoices = currentNode?.type === "DECISION"
    ? outgoing.map((edge) => ({
        label: edge.label?.trim() || "Opción",
        targetNodeId: edge.target,
      }))
    : [];
  const actionNodeDecisionChoices = actionNode?.type === "DECISION"
    ? findOutgoingEdges(actionNode.id, edges).map((edge) => ({
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

  const flowNodes = useMemo<Node<PlayerFlowNodeData>[]>(() => {
    return nodes.map((node, index) => ({
      id: node.id,
      type: "playerNode",
      position: node.position ?? { x: index * 260, y: index * 140 },
      draggable: false,
      selectable: true,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        label: nodeLabel(node),
        summary: nodeSummary(node),
        status: nodeStates.get(node.id) ?? "locked",
        type: node.type,
      },
    }));
  }, [nodeStates, nodes]);

  const flowEdges = useMemo<Edge[]>(() => {
    const edgeState = (edge: NarrativeGraphEdge): PlayerEdgeState => {
      const selectedTarget = selectedDecisionTargets.get(edge.source);
      if (selectedTarget) {
        return selectedTarget === edge.target ? "active" : "not-taken";
      }
      if (run?.currentNodeId === edge.source) return "active";
      if (completedIds.has(edge.source) && (completedIds.has(edge.target) || run?.currentNodeId === edge.target)) {
        return "traversed";
      }
      return "pending";
    };

    return edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label ?? undefined,
      animated: edgeState(edge) === "active",
      selectable: false,
      style:
        edgeState(edge) === "traversed"
          ? { stroke: "rgba(16, 185, 129, 0.85)", strokeWidth: 2.2 }
          : edgeState(edge) === "active"
            ? { stroke: "rgb(168, 139, 250)", strokeWidth: 2.4 }
            : edgeState(edge) === "not-taken"
              ? { stroke: "rgba(244, 114, 182, 0.4)", strokeWidth: 1.6, strokeDasharray: "6 4" }
              : { stroke: "rgba(148, 163, 184, 0.35)", strokeWidth: 1.3 },
      labelStyle: { fill: "rgb(148, 163, 184)", fontSize: 11, fontWeight: 600 },
    }));
  }, [completedIds, edges, run?.currentNodeId, selectedDecisionTargets]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const detail = await api<NarrativeRunDetail>(`/narrative-runs/${runId}`);
      setRun(detail);
      setRunCompleted(detail.status !== "RUNNING");
    } catch (error) {
      setMessage(handleApiError(error, "No se pudo cargar la ejecución."));
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [runId, router]);

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

  useEffect(() => {
    if (!actionNodeIsCurrent || actionNode?.type !== "PAUSE") {
      setPauseRemainingSeconds(null);
      return;
    }

    const isTimerPause = actionNode.data?.manual === false || actionNode.data?.pauseType === "timer";
    const duration = Number(actionNode.data?.durationSeconds ?? 0);

    if (!isTimerPause || !Number.isFinite(duration) || duration <= 0) {
      setPauseRemainingSeconds(null);
      return;
    }

    setPauseRemainingSeconds(duration);
  }, [actionNode, actionNodeIsCurrent]);

  useEffect(() => {
    if (pauseRemainingSeconds === null || pauseRemainingSeconds <= 0 || !actionNodeIsCurrent) return;
    const timer = window.setTimeout(() => {
      setPauseRemainingSeconds((value) => (value === null ? value : Math.max(value - 1, 0)));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [actionNodeIsCurrent, pauseRemainingSeconds]);

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
      setMessage(handleApiError(error, "No se pudo actualizar la ejecución."));
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
    if (!run || !currentNode) return;
    
    let audioAssetIdToPlay: string | undefined;
    
    if (currentNode.type === "AUDIO") {
      audioAssetIdToPlay = currentNode.data?.audioAssetId as string | undefined;
    } else if (currentNode.type === "AUDIO_BUTTON") {
      audioAssetIdToPlay = currentButtonDetails?.audioAssetId;
    }

    if (!audioAssetIdToPlay) {
      setMessage("Este nodo no tiene audio asignado o aún se está cargando.");
      return;
    }

    try {
      setWorking(true);
      setMessage(null);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      const response = await fetch(apiUrl(`/audio-assets/${audioAssetIdToPlay}/narrative-stream`), {
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
          payload: currentNode.type === "AUDIO_BUTTON" 
            ? { audioButtonId: currentNode.data?.audioButtonId, audioAssetId: audioAssetIdToPlay }
            : { audioAssetId: audioAssetIdToPlay },
        }),
      });
    } catch (error) {
      setMessage(handleApiError(error, "No se pudo reproducir el audio."));
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
      setMessage(handleApiError(error, "No se pudo finalizar la ejecución."));
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
      setMessage(handleApiError(error, "No se pudo cancelar la ejecución."));
    } finally {
      setWorking(false);
    }
  }

  const activeAudioNodeId = currentNode?.type === "AUDIO" || currentNode?.type === "AUDIO_BUTTON" ? currentNode.id : null;
  const audioAssetId = actionNode?.type === "AUDIO" 
    ? String(actionNode.data?.audioAssetId ?? "") 
    : actionNode?.type === "AUDIO_BUTTON" 
      ? String(currentButtonDetails?.audioAssetId ?? "") 
      : "";
  const hasAudio = Boolean(audioAssetId);
  const audioDescription = String(actionNode?.data?.description ?? "");
  const operatorNotes = String(actionNode?.data?.operatorNotes ?? actionNode?.data?.notes ?? "");
  const isRequiredNode = actionNode?.data?.required !== false;
  const canReplay = actionNode?.data?.allowReplay !== false;

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

  async function copyScriptText() {
    const text = String(actionNode?.data?.body ?? "");
    if (!text) {
      setMessage("Este nodo no tiene texto para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Texto copiado al portapapeles.");
    } catch {
      setMessage("No se pudo copiar el texto.");
    }
  }

  return (
    <ReactFlowProvider>
    <div className="space-y-4">
      {message ? (
        <div className="rounded-[24px] border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant shadow-elevation-1">
          {message}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Canvas de ejecución
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-on-surface">
              Flujo publicado en modo solo lectura
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!reactFlowRef.current || !currentNode?.position) return;
              reactFlowRef.current.setCenter(currentNode.position.x + 120, currentNode.position.y + 50, {
                zoom: Math.max(reactFlowRef.current.getZoom(), 0.9),
                duration: 500,
              });
            }}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
          >
            <Crosshair className="h-4 w-4" />
            Centrar paso actual
          </button>
        </div>

        <div className="h-[420px] overflow-hidden rounded-[24px] border border-outline-variant bg-[#120f1c]">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={playerNodeTypes}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onInit={(instance) => {
              reactFlowRef.current = instance;
              queueMicrotask(() => instance.fitView({ padding: 0.2, duration: 500 }));
            }}
            fitView
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable
            elementsSelectable
            zoomOnDoubleClick={false}
            panOnDrag
            selectionOnDrag={false}
            elevateNodesOnSelect={false}
          >
            <MiniMap
              pannable
              zoomable
              className="!bg-surface !border !border-outline-variant"
              nodeStrokeColor={(node) =>
                (node.data as PlayerFlowNodeData | undefined)?.status === "current"
                  ? "rgb(168, 139, 250)"
                  : "rgba(148, 163, 184, 0.6)"
              }
              nodeColor={(node) =>
                (node.data as PlayerFlowNodeData | undefined)?.status === "completed"
                  ? "rgba(16, 185, 129, 0.65)"
                  : (node.data as PlayerFlowNodeData | undefined)?.status === "current"
                    ? "rgba(168, 139, 250, 0.85)"
                    : "rgba(51, 65, 85, 0.9)"
              }
            />
            <Controls showInteractive={false} className="!bg-surface" />
            <Background color="rgba(148,163,184,0.16)" gap={20} size={1.1} />
          </ReactFlow>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
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
                    const status = nodeStates.get(node.id) ?? "locked";
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
        </section>

        <aside className="space-y-4">
          <section className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Panel de acción
                </p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-on-surface">
                  {actionNode ? nodeLabel(actionNode) : "Nodo sin seleccionar"}
                </h3>
              </div>
              {actionNode ? (
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(actionNodeState)}`}>
                  {actionNodeState}
                </span>
              ) : null}
            </div>

            {actionNode ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] border border-outline-variant bg-surface px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${actionNodeIsCurrent ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface"}`}>
                      {actionNode.type.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface">{actionNode.type}</p>
                      <p className="mt-1 text-sm text-on-surface-variant">{nodeSummary(actionNode)}</p>
                    </div>
                  </div>
                </div>

                {!actionNodeIsInteractive && actionNodeState === "locked" ? (
                  <div className="rounded-[24px] border border-outline-variant bg-surface px-4 py-4 text-sm text-on-surface-variant">
                    <div className="flex items-start gap-3">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" />
                      <p>Este nodo todavía no está disponible en la ruta actual. Puedes revisarlo, pero no ejecutarlo.</p>
                    </div>
                  </div>
                ) : null}

                {!actionNodeIsInteractive && actionNodeState !== "locked" ? (
                  <div className="rounded-[24px] border border-outline-variant bg-surface px-4 py-4 text-sm text-on-surface-variant">
                    Estás revisando un nodo fuera del paso actual. El contenido es de solo consulta.
                  </div>
                ) : null}

                <div className="rounded-[24px] border border-dashed border-outline-variant bg-surface-container px-4 py-4">
                  {actionNode.type === "AUDIO" ? (
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Audio</p>
                      <p className="text-sm font-medium text-on-surface">{nodeSummary(actionNode)}</p>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 ${statusTone(isRequiredNode ? "current" : "available")}`}>
                          {boolLabel(isRequiredNode, "Requerido", "Opcional")}
                        </span>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 ${statusTone(canReplay ? "available" : "locked")}`}>
                          {boolLabel(canReplay, "Permite repetir", "Sin repetición")}
                        </span>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 ${statusTone(hasAudio ? "completed" : "error")}`}>
                          {boolLabel(hasAudio, "Audio listo", "Audio faltante")}
                        </span>
                      </div>
                      {audioDescription ? (
                        <p className="text-sm text-on-surface-variant">{audioDescription}</p>
                      ) : null}
                      {operatorNotes ? (
                        <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-3 text-sm text-on-surface-variant">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Notas de operador</p>
                          <p className="mt-2 whitespace-pre-wrap">{operatorNotes}</p>
                        </div>
                      ) : null}
                      {!hasAudio ? (
                        <div className="rounded-2xl border border-red-300/40 bg-red-500/10 px-3 py-3 text-sm text-red-700 dark:text-red-300">
                          Este nodo no tiene un audio válido asignado.
                        </div>
                      ) : null}
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
                          disabled={working || !hasAudio || !actionNodeIsInteractive}
                          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Play className="h-4 w-4" />
                          Reproducir audio
                        </button>
                        <button
                          type="button"
                          onClick={() => void pauseAudio()}
                          disabled={!isPlaying || !actionNodeIsInteractive}
                          className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Pause className="h-4 w-4" />
                          Pausar
                        </button>
                        <button
                          type="button"
                          onClick={() => void resumeAudio()}
                          disabled={isPlaying || !actionNodeIsInteractive}
                          className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Play className="h-4 w-4" />
                          Reanudar
                        </button>
                        <button
                          type="button"
                          onClick={() => void stopAudio()}
                          disabled={!actionNodeIsInteractive}
                          className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Square className="h-4 w-4" />
                          Detener
                        </button>
                      </div>
                    </div>
                  ) : actionNode.type === "AUDIO_BUTTON" ? (
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Botón de audio</p>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 ${statusTone(isRequiredNode ? "current" : "available")}`}>
                          {boolLabel(isRequiredNode, "Requerido", "Opcional")}
                        </span>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 ${statusTone(hasAudio ? "completed" : "error")}`}>
                          {boolLabel(hasAudio, "Audio asociado", "Audio faltante")}
                        </span>
                      </div>
                      {currentButtonDetails ? (
                        <div className="rounded-xl border border-outline-variant bg-surface p-3" style={{ borderLeftColor: currentButtonDetails.color, borderLeftWidth: 4 }}>
                          <p className="font-semibold text-on-surface">{currentButtonDetails.label}</p>
                          <p className="text-xs text-on-surface-variant">
                            Categoría: {currentButtonDetails.category?.name || "Sin categoría"} | Acceso directo: {currentButtonDetails.shortcutKey || "Ninguno"}
                          </p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            Audio: {currentButtonDetails.audioAsset?.originalName || currentButtonDetails.audioAssetId || "No disponible"}
                          </p>
                          {currentButtonDetails.description ? (
                            <p className="mt-2 text-sm text-on-surface-variant">{currentButtonDetails.description}</p>
                          ) : null}
                        </div>
                      ) : buttonDetailsError ? (
                        <div className="rounded-2xl border border-red-300/40 bg-red-500/10 px-3 py-3 text-sm text-red-700 dark:text-red-300">
                          {buttonDetailsError}
                        </div>
                      ) : (
                        <p className="text-sm text-on-surface-variant">Cargando detalles del botón...</p>
                      )}
                      {operatorNotes ? (
                        <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-3 text-sm text-on-surface-variant">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Notas de operador</p>
                          <p className="mt-2 whitespace-pre-wrap">{operatorNotes}</p>
                        </div>
                      ) : null}
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
                          disabled={working || !hasAudio || !actionNodeIsInteractive}
                          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Play className="h-4 w-4" />
                          Reproducir botón
                        </button>
                        <button
                          type="button"
                          onClick={() => void pauseAudio()}
                          disabled={!isPlaying || !actionNodeIsInteractive}
                          className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Pause className="h-4 w-4" />
                          Pausar
                        </button>
                        <button
                          type="button"
                          onClick={() => void resumeAudio()}
                          disabled={isPlaying || !actionNodeIsInteractive}
                          className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Play className="h-4 w-4" />
                          Reanudar
                        </button>
                        <button
                          type="button"
                          onClick={() => void stopAudio()}
                          disabled={!actionNodeIsInteractive}
                          className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Square className="h-4 w-4" />
                          Detener
                        </button>
                      </div>
                    </div>
                  ) : actionNode.type === "SCRIPT_TEXT" ? (
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Texto para leer</p>
                      <p className="whitespace-pre-wrap text-base leading-7 text-on-surface">
                        {String(actionNode.data?.body ?? "Sin contenido")}
                      </p>
                      <button
                        type="button"
                        onClick={() => void copyScriptText()}
                        className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
                      >
                        <Copy className="h-4 w-4" />
                        Copiar texto
                      </button>
                    </div>
                  ) : actionNode.type === "INSTRUCTION" ? (
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Instrucción operativa</p>
                      <p className="whitespace-pre-wrap text-base leading-7 text-on-surface">
                        {String(actionNode.data?.instruction ?? "Sin instrucción")}
                      </p>
                    </div>
                  ) : actionNode.type === "PAUSE" ? (
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Pausa</p>
                      <p className="text-base leading-7 text-on-surface">
                        {actionNode.data?.manual === false || actionNode.data?.pauseType === "timer"
                          ? `Pausa temporizada de ${String(actionNode.data?.durationSeconds ?? "0")} segundos.`
                          : "Pausa manual. Espera la señal para continuar."}
                      </p>
                      {pauseRemainingSeconds !== null ? (
                        <div className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface">
                          <Clock3 className="h-4 w-4" />
                          {pauseRemainingSeconds > 0
                            ? `Continuar disponible en ${pauseRemainingSeconds}s`
                            : "Puedes continuar"}
                        </div>
                      ) : null}
                    </div>
                  ) : actionNode.type === "DECISION" ? (
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Decisión</p>
                      <p className="text-base leading-7 text-on-surface">
                        {String(actionNode.data?.question ?? "¿Qué sigue?")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {actionNodeDecisionChoices.length > 0 ? (
                          actionNodeDecisionChoices.map((choice) => (
                            <button
                              key={`${choice.targetNodeId}-${choice.label}`}
                              type="button"
                              onClick={() => actionNodeIsInteractive ? void handleDecision(choice.targetNodeId, choice.label) : undefined}
                              disabled={working || !actionNodeIsInteractive}
                              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors ${
                                selectedDecisionTarget === choice.targetNodeId
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-outline-variant bg-surface text-on-surface hover:border-primary"
                              } disabled:cursor-not-allowed disabled:opacity-60`}
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
                  ) : actionNode.type === "END" ? (
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

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void completeCurrentNode(false)}
                    disabled={working || run.status !== "RUNNING" || !actionNodeIsInteractive || actionNode?.type === "DECISION"}
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <SkipForward className="h-4 w-4" />
                    Siguiente
                  </button>
                  <button
                    type="button"
                    onClick={() => void completeCurrentNode(true)}
                    disabled={
                      working ||
                      run.status !== "RUNNING" ||
                      !actionNodeIsInteractive ||
                      actionNode?.data?.required !== false ||
                      actionNode?.type === "DECISION"
                    }
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

                {currentStatus === "current" && actionNodeIsCurrent ? (
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                    Estás en el paso actual de la narrativa.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-[24px] border border-outline-variant bg-surface px-4 py-6 text-sm text-on-surface-variant">
                Selecciona un nodo del canvas para revisar su contenido.
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
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
          </section>
        </aside>
      </div>
    </div>
    </ReactFlowProvider>
  );
}
