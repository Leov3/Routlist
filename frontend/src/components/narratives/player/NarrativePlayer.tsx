"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
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
  Route,
  Timer,
  WandSparkles,
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
import type { BoardAudioButton, BoardCategory, BoardViewMode } from "@/types/routlis";
import { ApiError } from "@/lib/api";
import { AudioButtonDetailsModal } from "@/components/audio-board/AudioButtonDetailsModal";
import { BoardViewModeToggle } from "@/components/audio-board/BoardViewModeToggle";
import { NarrativeAudioLibraryPanel } from "./NarrativeAudioLibraryPanel";
import {
  NarrativePlayerContext,
  playerNodeTypes,
  type AudioButtonDetail,
  type AudioPlaybackState,
  type DecisionChoice,
  type PlayerFlowNodeData,
  type PlayerNodeState,
} from "@/components/narratives/player/nodes/playerNodeTypes";

type NarrativePlayerProps = {
  runId: string;
  onReloadRequest?: () => void;
};

type PlayerEdgeState = "traversed" | "active" | "pending" | "not-taken";

type NodeMeta = NarrativeGraphNode & {
  data?: Record<string, unknown>;
};

type ContextMenuState = {
  isOpen: boolean;
  x: number;
  y: number;
  nodeId: string | null;
};

type LayoutDistancePreset = {
  id: string;
  label: string;
  xScale: number;
  yScale: number;
};

type LayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutPosition = {
  x: number;
  y: number;
};

type NarrativePlayerPreferences = {
  playerDistance?: string;
  playerViewMode?: BoardViewMode;
  playerViewportX?: number;
  playerViewportY?: number;
  playerViewportZoom?: number;
};

type DynamicAudioGenerationResponse = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  audioBase64: string;
};

type DynamicAudioClip = {
  objectUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  generatedAt: string;
  text: string;
};

function mapBoardButtonToAudioButtonDetail(button: BoardAudioButton): AudioButtonDetail {
  return {
    id: button.id,
    label: button.label,
    category: button.category ? { name: button.category.name } : null,
    shortcutKey: button.shortcutKey ?? null,
    description: button.description ?? null,
    color: button.color ?? null,
    audioAsset: {
      originalName: button.audioAsset.originalName,
    },
    audioAssetId: button.audioAsset.id,
    imageUrl: button.imageUrl ?? null,
    imagePublicUrl: button.imageUrl ?? null,
  };
}

const DEFAULT_NARRATIVE_DISTANCE = "max";
const DEFAULT_NARRATIVE_VIEW_MODE: BoardViewMode = "simple";

const PLAYER_DISTANCE_PRESETS: LayoutDistancePreset[] = [
  { id: "compact", label: "Cerca", xScale: 0.92, yScale: 1.22 },
  { id: "tight", label: "Tenso", xScale: 1.08, yScale: 1.42 },
  { id: "normal", label: "Normal", xScale: 1.22, yScale: 1.68 },
  { id: "wide", label: "Amplio", xScale: 1.35, yScale: 1.88 },
  { id: "max", label: "Máximo", xScale: 1.45, yScale: 2.05 },
];

const PLAYER_NODE_SIZES: Record<string, { width: number; height: number }> = {
  START: { width: 220, height: 88 },
  END: { width: 220, height: 88 },
  AUDIO: { width: 280, height: 150 },
  AUDIO_BUTTON: { width: 280, height: 150 },
  DYNAMIC_AUDIO: { width: 330, height: 190 },
  SCRIPT_TEXT: { width: 320, height: 200 },
  INSTRUCTION: { width: 300, height: 190 },
  PAUSE: { width: 240, height: 120 },
  DECISION: { width: 320, height: 180 },
};

const PLAYER_LAYOUT_GAP = {
  x: 380,
  y: 280,
  annotationX: 340,
  annotationY: 210,
};

function getPlayerNodeSize(node: NodeMeta) {
  return PLAYER_NODE_SIZES[node.type] ?? { width: 280, height: 160 };
}

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
      DYNAMIC_AUDIO: "Audio dinámico IA",
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
  if (nodeType === "DYNAMIC_AUDIO") {
    return data.template ? String(data.template) : "Sin plantilla";
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

function findIncomingEdges(nodeId: string, edges: NarrativeGraphEdge[]) {
  return edges.filter((edge) => edge.target === nodeId);
}

function isAnnotationNodeType(type?: NarrativeNodeType) {
  return type === "INSTRUCTION";
}

function isFlowNodeType(type?: NarrativeNodeType) {
  return Boolean(type && !isAnnotationNodeType(type));
}

function getExecutionEdges(nodes: NodeMeta[], edges: NarrativeGraphEdge[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const annotationEdge = (edge: NarrativeGraphEdge) =>
    isAnnotationNodeType(nodeById.get(edge.source)?.type as NarrativeNodeType | undefined) ||
    isAnnotationNodeType(nodeById.get(edge.target)?.type as NarrativeNodeType | undefined);

  const directFlowEdges = edges.filter((edge) => !annotationEdge(edge));
  const bypassEdges = nodes
    .filter((node) => isAnnotationNodeType(node.type as NarrativeNodeType))
    .flatMap((node) => {
      const incoming = edges.filter((edge) => edge.target === node.id && isFlowNodeType(nodeById.get(edge.source)?.type as NarrativeNodeType | undefined));
      const outgoing = edges.filter((edge) => edge.source === node.id && isFlowNodeType(nodeById.get(edge.target)?.type as NarrativeNodeType | undefined));
      return incoming.flatMap((input) =>
        outgoing.map((output) => ({
          id: `annotation-bypass:${input.id}:${output.id}`,
          source: input.source,
          target: output.target,
          label: input.label,
        })),
      );
    });

  return [...directFlowEdges, ...bypassEdges];
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

function readDecisionLabels(value: unknown) {
  if (typeof value === "string") {
    return value.split("|").map((item) => item.trim()).filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      typeof item === "string"
        ? item.trim()
        : item && typeof item === "object" && "label" in item
          ? String(item.label ?? "").trim()
          : "",
    )
    .filter(Boolean);
}

function extractDynamicAudioVariables(template: string) {
  const variables = new Set<string>();
  const pattern = /{{\s*([A-Za-z][A-Za-z0-9_-]*)\s*}}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(template))) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

function normalizeDynamicAudioTemplate(template: string) {
  return template
    .replace(/<\s*([A-Za-z][A-Za-z0-9_-]*)\s*>/g, "{{$1}}")
    .replace(/{{\s*([A-Za-z][A-Za-z0-9_-]*)\s*}}/g, "{{$1}}");
}

function resolveDynamicAudioTemplate(template: string, values: Record<string, string>) {
  return normalizeDynamicAudioTemplate(template).replace(
    /{{\s*([A-Za-z][A-Za-z0-9_-]*)\s*}}/g,
    (_match, variable: string) => values[variable]?.trim() || `{{${variable}}}`,
  );
}

function buildDynamicAudioObjectUrl(contentType: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: contentType }));
}

export function NarrativePlayer({ runId, onReloadRequest }: NarrativePlayerProps) {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const reactFlowRef = useRef<ReactFlowInstance<Node<PlayerFlowNodeData>, Edge> | null>(null);
  const hasFitViewRef = useRef(false);
  const dynamicAudioClipsRef = useRef<Record<string, DynamicAudioClip | null>>({});
  const [run, setRun] = useState<NarrativeRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<AudioPlaybackState>("idle");
  const [selectedDecisionTarget, setSelectedDecisionTarget] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [audioButtonDetailsById, setAudioButtonDetailsById] = useState<Record<string, AudioButtonDetail>>({});
  const [currentButtonDetails, setCurrentButtonDetails] = useState<AudioButtonDetail | null>(null);
  const [buttonDetailsError, setButtonDetailsError] = useState<string | null>(null);
  const [buttonBoardModalButton, setButtonBoardModalButton] = useState<BoardAudioButton | null>(null);
  const [dynamicAudioDrafts, setDynamicAudioDrafts] = useState<Record<string, Record<string, string>>>({});
  const [dynamicAudioClips, setDynamicAudioClips] = useState<Record<string, DynamicAudioClip | null>>({});
  const [dynamicAudioGeneratingNodeId, setDynamicAudioGeneratingNodeId] = useState<string | null>(null);
  const [pauseRemainingSeconds, setPauseRemainingSeconds] = useState<number | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState({ current: 0, duration: 0 });
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ isOpen: false, x: 0, y: 0, nodeId: null });
  const [showBottomDock, setShowBottomDock] = useState(false);
  const [showActivityDock, setShowActivityDock] = useState(false);
  const [distancePresetId, setDistancePresetId] = useState<string>("max");
  const [playerViewMode, setPlayerViewMode] = useState<BoardViewMode>("simple");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [canvasViewport, setCanvasViewport] = useState({ x: 0, y: 0, zoom: 0.8 });
  const savePreferencesTimerRef = useRef<number | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    dynamicAudioClipsRef.current = dynamicAudioClips;
  }, [dynamicAudioClips]);

  useEffect(() => {
    return () => {
      for (const clip of Object.values(dynamicAudioClipsRef.current)) {
        if (clip?.objectUrl) {
          URL.revokeObjectURL(clip.objectUrl);
        }
      }
    };
  }, []);

  const handleApiError = useCallback((error: unknown, fallbackMessage: string) => {
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
  }, [router]);

  const { nodes, edges } = useMemo(() => readGraph(run?.narrativeVersion.graphJson ?? null), [run]);
  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node] as const)),
    [nodes],
  );
  const executionEdges = useMemo(() => getExecutionEdges(nodes, edges), [edges, nodes]);

  const currentNode = run?.currentNodeId ? nodeMap.get(run.currentNodeId) : undefined;
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : undefined;
  const actionNode = selectedNode ?? currentNode;
  const uiCurrentNodeId = selectedNodeId ?? run?.currentNodeId ?? null;

  const distancePreset = useMemo(
    () => PLAYER_DISTANCE_PRESETS.find((preset) => preset.id === distancePresetId) ?? PLAYER_DISTANCE_PRESETS[PLAYER_DISTANCE_PRESETS.length - 1],
    [distancePresetId],
  );

  const layoutPositions = useMemo(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
    const root = nodes.find((node) => node.type === "START") ?? nodes[0];
    const flowNodeIds = new Set(
      nodes.filter((node) => node.type !== "INSTRUCTION").map((node) => node.id),
    );
    const childrenById = new Map<string, string[]>();
    const parentsById = new Map<string, string[]>();
    const depthById = new Map<string, number>();
    const positions = new Map<string, LayoutPosition>();
    const sortedNodeIds = [...flowNodeIds].sort((a, b) => a.localeCompare(b));

    for (const nodeId of sortedNodeIds) {
      childrenById.set(nodeId, []);
      parentsById.set(nodeId, []);
    }

    for (const edge of executionEdges) {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target || source.type === "INSTRUCTION" || target.type === "INSTRUCTION") continue;
      const children = childrenById.get(source.id) ?? [];
      if (!children.includes(target.id)) children.push(target.id);
      childrenById.set(source.id, children);
      const parents = parentsById.get(target.id) ?? [];
      if (!parents.includes(source.id)) parents.push(source.id);
      parentsById.set(target.id, parents);
    }

    const assignDepth = (nodeId: string, nextDepth: number, trail = new Set<string>()) => {
      const current = depthById.get(nodeId);
      if (current === undefined || nextDepth > current) {
        depthById.set(nodeId, nextDepth);
      }
      if (trail.has(nodeId)) return;
      trail.add(nodeId);
      for (const childId of childrenById.get(nodeId) ?? []) {
        assignDepth(childId, nextDepth + 1, trail);
      }
      trail.delete(nodeId);
    };

    if (root) assignDepth(root.id, 0);
    for (const nodeId of sortedNodeIds) {
      if (!depthById.has(nodeId)) assignDepth(nodeId, 0);
    }

    const nodesByDepth = new Map<number, string[]>();
    for (const nodeId of sortedNodeIds) {
      const depth = depthById.get(nodeId) ?? 0;
      const bucket = nodesByDepth.get(depth) ?? [];
      bucket.push(nodeId);
      nodesByDepth.set(depth, bucket);
    }

    const maxDepth = Math.max(...Array.from(nodesByDepth.keys()), 0);
    const maxWidth = Math.max(...nodes.map((node) => getPlayerNodeSize(node).width), 320);
    const minStepX = Math.max(maxWidth + 120, PLAYER_LAYOUT_GAP.x) * distancePreset.xScale;
    const minStepY = Math.max(220, PLAYER_LAYOUT_GAP.y) * distancePreset.yScale;
    const rowEntries = new Map<number, Array<{ nodeId: string; width: number; desiredX: number }>>();

    for (let depth = maxDepth; depth >= 0; depth -= 1) {
      const row = nodesByDepth.get(depth) ?? [];
      row.sort((a, b) => a.localeCompare(b));

      for (const nodeId of row) {
        const node = nodeById.get(nodeId);
        if (!node) continue;
        const size = getPlayerNodeSize(node);
        const children = (childrenById.get(nodeId) ?? []).filter((childId) => flowNodeIds.has(childId));
        const entry = rowEntries.get(depth) ?? [];
        rowEntries.set(depth, entry);

        let desiredX = entry.length * minStepX;
        if (children.length) {
          const childCenters = children
            .map((childId) => {
              const childPosition = positions.get(childId);
              const childNode = nodeById.get(childId);
              if (!childPosition || !childNode) return null;
              return childPosition.x + getPlayerNodeSize(childNode).width / 2;
            })
            .filter((value): value is number => value !== null);
          if (childCenters.length) {
            desiredX = childCenters.reduce((sum, value) => sum + value, 0) / childCenters.length - size.width / 2;
          }
        } else {
          const parentCenters = (parentsById.get(nodeId) ?? [])
            .map((parentId) => {
              const parentPosition = positions.get(parentId);
              const parentNode = nodeById.get(parentId);
              if (!parentPosition || !parentNode) return null;
              return parentPosition.x + getPlayerNodeSize(parentNode).width / 2;
            })
            .filter((value): value is number => value !== null);
          if (parentCenters.length) {
            desiredX = parentCenters.reduce((sum, value) => sum + value, 0) / parentCenters.length - size.width / 2;
          }
        }

        entry.push({ nodeId, width: size.width, desiredX });
      }
    }

    for (const [depth, row] of rowEntries.entries()) {
      row.sort((a, b) => a.desiredX - b.desiredX || a.nodeId.localeCompare(b.nodeId));
      let cursorX = 0;
      for (const entry of row) {
        const node = nodeById.get(entry.nodeId);
        if (!node) continue;
        const width = entry.width;
        const x = Math.max(entry.desiredX, cursorX);
        positions.set(entry.nodeId, { x, y: depth * minStepY });
        cursorX = x + width + minStepX * 0.35;
      }
    }

    const annotationBySource = new Map<string, NodeMeta[]>();
    for (const node of nodes) {
      if (node.type !== "INSTRUCTION") continue;
      const incoming = findIncomingEdges(node.id, edges)
        .map((edge) => nodeById.get(edge.source))
        .filter((source): source is NodeMeta => Boolean(source && source.type !== "INSTRUCTION"));
      const source = incoming[0] ?? root;
      if (!source) continue;
      const bucket = annotationBySource.get(source.id) ?? [];
      bucket.push(node);
      annotationBySource.set(source.id, bucket);
    }

    for (const [sourceId, instructionNodes] of annotationBySource.entries()) {
      const sourcePosition = positions.get(sourceId);
      if (!sourcePosition) continue;
      const sourceNode = nodeById.get(sourceId);
      const sourceWidth = sourceNode ? getPlayerNodeSize(sourceNode).width : maxWidth;
      instructionNodes.sort((a, b) => a.id.localeCompare(b.id));
      instructionNodes.forEach((node, index) => {
        const sourceOriginal = nodeById.get(sourceId)?.position;
        const instructionOriginal = node.position;
        const relativeX = sourceOriginal && instructionOriginal ? instructionOriginal.x - sourceOriginal.x : sourceWidth + PLAYER_LAYOUT_GAP.annotationX;
        const relativeY = sourceOriginal && instructionOriginal ? instructionOriginal.y - sourceOriginal.y : index * PLAYER_LAYOUT_GAP.annotationY;
        positions.set(node.id, {
          x: sourcePosition.x + relativeX * distancePreset.xScale,
          y: sourcePosition.y + relativeY * distancePreset.yScale,
        });
      });
    }

    const rowWidths = Array.from(rowEntries.entries()).map(([depth, row]) => ({
      depth,
      width: row.reduce((sum, entry) => sum + entry.width, 0) + Math.max(0, row.length - 1) * minStepX * 0.35,
    }));
    const widestRow = Math.max(...rowWidths.map((row) => row.width), minStepX);
    const centeredOffset = widestRow / 2;

    const boxes = Array.from(positions.entries())
      .map(([nodeId, position]) => {
        const node = nodeById.get(nodeId);
        if (!node) return null;
        const size = getPlayerNodeSize(node);
        return {
          left: position.x,
          right: position.x + size.width,
        };
      })
      .filter((value): value is { left: number; right: number } => value !== null);
    const minLeft = boxes.length ? Math.min(...boxes.map((box) => box.left)) : 0;
    const maxRight = boxes.length ? Math.max(...boxes.map((box) => box.right)) : 0;
    const centerOffsetX = (minLeft + maxRight) / 2;

    if (boxes.length) {
      for (const [nodeId, position] of positions.entries()) {
        positions.set(nodeId, {
          x: position.x - centerOffsetX + centeredOffset,
          y: position.y,
        });
      }
    }

    return positions;
  }, [distancePreset.xScale, distancePreset.yScale, edges, executionEdges, nodes]);

  useEffect(() => {
    if (!selectedNodeId && currentNode?.id) {
      setSelectedNodeId(currentNode.id);
    }
  }, [currentNode?.id, selectedNodeId]);

  useEffect(() => {
    let cancelled = false;

    async function loadButtonCatalog() {
      if (!nodes.some((node) => node.type === "AUDIO_BUTTON")) {
        setAudioButtonDetailsById({});
        return;
      }

      try {
        const boardData = await api<BoardCategory[]>("/audio-buttons/board");
        if (cancelled) return;

        const nextMap: Record<string, AudioButtonDetail> = {};

        for (const category of boardData) {
          for (const button of category.buttons ?? []) {
            nextMap[button.id] = mapBoardButtonToAudioButtonDetail(button);
          }
        }

        setAudioButtonDetailsById(nextMap);
      } catch {
        if (!cancelled) {
          setAudioButtonDetailsById({});
        }
      }
    }

    void loadButtonCatalog();

    return () => {
      cancelled = true;
    };
  }, [nodes]);

  useEffect(() => {
    const actionData = actionNode?.data;
    const audioButtonId = actionNode?.type === "AUDIO_BUTTON" && actionData?.audioButtonId
      ? String(actionData.audioButtonId)
      : "";

    if (audioButtonId) {
      const cachedDetails = audioButtonDetailsById[audioButtonId];
      if (cachedDetails) {
        setCurrentButtonDetails(cachedDetails);
        setButtonDetailsError(null);
        return;
      }

      setCurrentButtonDetails({
        id: audioButtonId,
        label: String(actionData?.label ?? actionData?.title ?? "Botón de audio"),
        category: null,
        shortcutKey: null,
        description: typeof actionData?.description === "string" ? actionData.description : null,
        color: null,
        audioAsset: null,
        audioAssetId: typeof actionData?.audioAssetId === "string" ? actionData.audioAssetId : null,
        imageUrl: null,
        imagePublicUrl: null,
      });
      setButtonDetailsError(
        "No se encontró el botón en la biblioteca cargada. El recurso puede haberse eliminado o no pertenecer a esta organización.",
      );
    } else {
      setCurrentButtonDetails(null);
      setButtonDetailsError(null);
    }
  }, [actionNode, audioButtonDetailsById]);

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
    for (const edge of executionEdges) {
      if (edge.source === currentNode.id) {
        ids.add(edge.target);
      }
    }
    return ids;
  }, [currentNode, executionEdges]);

  const nodeStates = useMemo(() => {
    const states = new Map<string, PlayerNodeState>();
    for (const node of nodes) {
      const data = node.data ?? {};
      const type = node.type as NarrativeNodeType;
      let state: PlayerNodeState = "locked";

      const hasError =
        (type === "AUDIO" && !data.audioAssetId) ||
        (type === "AUDIO_BUTTON" && !data.audioButtonId) ||
        (type === "DYNAMIC_AUDIO" && !data.template) ||
        (type === "SCRIPT_TEXT" && !data.body) ||
        (type === "DECISION" && findOutgoingEdges(node.id, executionEdges).length === 0);

      if (type === "INSTRUCTION") {
        state = "available";
      } else if (hasError) {
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
  }, [availableIds, completedIds, executionEdges, nodes, run?.currentNodeId, selectedDecisionTargets, skippedIds]);

  const flowNodes = useMemo<Node<PlayerFlowNodeData>[]>(() => {
    return nodes.map((node, index) => ({
      id: node.id,
      type: node.type || "narrativeNode",
      position: layoutPositions.get(node.id)
        ? { x: layoutPositions.get(node.id)!.x, y: layoutPositions.get(node.id)!.y }
        : { x: index * PLAYER_LAYOUT_GAP.x, y: index * PLAYER_LAYOUT_GAP.y },
      draggable: false,
      selectable: true,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        id: node.id,
        label: nodeLabel(node),
        summary: nodeSummary(node),
        status: nodeStates.get(node.id) ?? "locked",
        type: node.type,
        nodeData: node.data,
        audioButtonId: node.data?.audioButtonId as string | undefined,
        audioAssetId: node.data?.audioAssetId as string | undefined,
        template: node.data?.template as string | undefined,
        variables: node.data?.variables as string[] | undefined,
        voiceId: node.data?.voiceId as string | undefined,
        modelId: node.data?.modelId as string | undefined,
        outputFormat: node.data?.outputFormat as string | undefined,
        stability: node.data?.stability as number | string | undefined,
        similarityBoost: node.data?.similarityBoost as number | string | undefined,
        style: node.data?.style as number | string | undefined,
        speed: node.data?.speed as number | string | undefined,
        speakerBoost: node.data?.speakerBoost as boolean | undefined,
        audioButtonDetail: node.data?.audioButtonId ? audioButtonDetailsById[String(node.data.audioButtonId)] ?? null : null,
        isRequired: node.data?.required !== false,
        decisionChoices: node.type === "DECISION"
          ? findOutgoingEdges(node.id, executionEdges).map((edge, choiceIndex) => ({
              label: edge.label?.trim() || readDecisionLabels(node.data?.options)[choiceIndex] || "Opción",
              targetNodeId: edge.target,
            }))
          : undefined,
      },
    }));
  }, [audioButtonDetailsById, executionEdges, layoutPositions, nodeStates, nodes]);

  const currentStatus = currentNode ? nodeStates.get(currentNode.id) ?? "locked" : "locked";
  const actionNodeState = actionNode ? nodeStates.get(actionNode.id) ?? "locked" : "locked";
  const actionNodeIsCurrent = actionNode?.id === uiCurrentNodeId;
  const actionNodeIsInteractive = actionNodeIsCurrent && run?.status === "RUNNING";
  const outgoing = currentNode ? findOutgoingEdges(currentNode.id, executionEdges) : [];
  const actionDecisionLabels = readDecisionLabels(actionNode?.data?.options);
  const actionNodeDecisionChoices = actionNode?.type === "DECISION"
    ? findOutgoingEdges(actionNode.id, executionEdges).map((edge, index) => ({
        label: edge.label?.trim() || actionDecisionLabels[index] || "Opción",
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
      const next = executionEdges.find((edge) => edge.source === currentId);
      currentId = next?.target;
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        result.push(node);
      }
    }

    return result;
  }, [executionEdges, nodes]);

  const flowEdges = useMemo<Edge[]>(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
    const annotationEdge = (edge: NarrativeGraphEdge) =>
      isAnnotationNodeType(nodeById.get(edge.source)?.type as NarrativeNodeType | undefined) ||
      isAnnotationNodeType(nodeById.get(edge.target)?.type as NarrativeNodeType | undefined);
    const edgeState = (edge: NarrativeGraphEdge): PlayerEdgeState => {
      if (annotationEdge(edge)) return "pending";
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

    return edges.map((edge) => {
      const isAnnotation = annotationEdge(edge);
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label ?? (isAnnotation ? "Nota" : undefined),
        labelShowBg: Boolean(edge.label || isAnnotation),
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 999,
        labelBgStyle: isAnnotation
          ? { fill: "rgba(42, 29, 13, 0.9)", stroke: "rgba(245, 158, 11, 0.3)", strokeWidth: 1 }
          : {
              fill: "rgba(15, 23, 42, 0.88)",
              stroke: "rgba(148, 163, 184, 0.18)",
              strokeWidth: 1,
            },
        animated: !isAnnotation && edgeState(edge) === "active",
        selectable: false,
        style: isAnnotation
          ? { stroke: "rgba(245, 158, 11, 0.65)", strokeWidth: 1.5, strokeDasharray: "6 6" }
          : edgeState(edge) === "traversed"
            ? { stroke: "rgba(16, 185, 129, 0.85)", strokeWidth: 2.4 }
            : edgeState(edge) === "active"
              ? { stroke: "rgb(168, 139, 250)", strokeWidth: 2.8 }
              : edgeState(edge) === "not-taken"
                ? { stroke: "rgba(244, 114, 182, 0.4)", strokeWidth: 1.6, strokeDasharray: "6 4" }
                : { stroke: "rgba(148, 163, 184, 0.28)", strokeWidth: 1.4 },
        labelStyle: { fill: isAnnotation ? "rgb(251, 191, 36)" : "rgb(203, 213, 225)", fontSize: 10, fontWeight: 700 },
      };
    });
  }, [completedIds, edges, nodes, run?.currentNodeId, selectedDecisionTargets]);

  const resolveNodeCenter = useCallback((node: NodeMeta, index = 0) => {
    const layoutPosition = layoutPositions.get(node.id);
    const position = layoutPosition ? { x: layoutPosition.x, y: layoutPosition.y } : { x: index * PLAYER_LAYOUT_GAP.x, y: index * PLAYER_LAYOUT_GAP.y };
    const size = getPlayerNodeSize(node);
    return {
      x: position.x + size.width / 2,
      y: position.y + size.height / 2,
    };
  }, [layoutPositions]);

  const centerCurrentNode = useCallback(() => {
    if (!reactFlowRef.current || !currentNode) return;
    const position = resolveNodeCenter(currentNode);
    reactFlowRef.current.setCenter(position.x + 150, position.y + 90, {
      zoom: Math.max(reactFlowRef.current.getZoom(), 0.8),
      duration: 350,
    });
  }, [currentNode, resolveNodeCenter]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const detail = await api<NarrativeRunDetail>(`/narrative-runs/${runId}`);
      setRun(detail);
    } catch (error) {
      setMessage(handleApiError(error, "No se pudo cargar la ejecución."));
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [handleApiError, runId]);

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
      setPlaybackState("idle");
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

  useEffect(() => {
    if (!actionNodeIsInteractive || actionNode?.type !== "AUDIO_BUTTON") return;
    
    const shortcut = currentButtonDetails?.shortcutKey?.toLowerCase();
    if (!shortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key.toLowerCase() === shortcut) {
        e.preventDefault();
        void startAudioPlayback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionNodeIsInteractive, actionNode, currentButtonDetails]);

  useEffect(() => {
    if (!contextMenu.isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu({ isOpen: false, x: 0, y: 0, nodeId: null });
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [contextMenu.isOpen]);

  useEffect(() => {
    hasFitViewRef.current = false;
  }, [runId]);

  useEffect(() => {
    let cancelled = false;
    setPreferencesReady(false);

    api<NarrativePlayerPreferences>("/me/narrative-preferences")
      .then((preferences) => {
        if (cancelled) return;
        const backendDistance = PLAYER_DISTANCE_PRESETS.find((item) => item.id === preferences.playerDistance);
        const backendViewMode = preferences.playerViewMode === "dual" ? "dual" : "simple";
        const backendViewport = {
          x: typeof preferences.playerViewportX === "number" ? preferences.playerViewportX : 0,
          y: typeof preferences.playerViewportY === "number" ? preferences.playerViewportY : 0,
          zoom: typeof preferences.playerViewportZoom === "number" ? preferences.playerViewportZoom : 0.8,
        };

        setDistancePresetId(backendDistance?.id || DEFAULT_NARRATIVE_DISTANCE);
        setPlayerViewMode(backendViewMode || DEFAULT_NARRATIVE_VIEW_MODE);
        setCanvasViewport(backendViewport);
      })
      .catch(() => {
        if (!cancelled) {
          setDistancePresetId(DEFAULT_NARRATIVE_DISTANCE);
          setPlayerViewMode(DEFAULT_NARRATIVE_VIEW_MODE);
          setCanvasViewport({ x: 0, y: 0, zoom: 0.8 });
        }
      })
      .finally(() => {
        if (!cancelled) setPreferencesReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setHeaderSlot(document.getElementById("board-header-slot"));
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    if (savePreferencesTimerRef.current) {
      window.clearTimeout(savePreferencesTimerRef.current);
    }

    savePreferencesTimerRef.current = window.setTimeout(() => {
      void api("/me/narrative-preferences", {
        method: "PATCH",
        body: JSON.stringify({
          playerDistance: distancePresetId,
          playerViewMode,
          playerViewportX: canvasViewport.x,
          playerViewportY: canvasViewport.y,
          playerViewportZoom: canvasViewport.zoom,
        }),
      }).catch(() => {
        // No bloqueamos la experiencia si falla la persistencia.
      });
    }, 250);

    return () => {
      if (savePreferencesTimerRef.current) {
        window.clearTimeout(savePreferencesTimerRef.current);
      }
    };
  }, [distancePresetId, playerViewMode, canvasViewport, preferencesReady]);

  useEffect(() => {
    if (hasFitViewRef.current || !reactFlowRef.current || flowNodes.length === 0 || !preferencesReady) return;

    const frame = window.requestAnimationFrame(() => {
      const hasSavedViewport = !(canvasViewport.x === 0 && canvasViewport.y === 0 && canvasViewport.zoom === 0.8);
      if (hasSavedViewport) {
        reactFlowRef.current?.setViewport(canvasViewport, { duration: 0 });
      } else {
        reactFlowRef.current?.fitView({
          padding: 0.2,
          minZoom: 0.2,
          maxZoom: 2,
          duration: 500,
        });
      }
      hasFitViewRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [canvasViewport, flowNodes.length, preferencesReady, runId]);

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

    if (currentNode.type === "INSTRUCTION") {
      const nextFlowEdge = edges.find((edge) => {
        const target = nodeMap.get(edge.target);
        return edge.source === currentNode.id && isFlowNodeType(target?.type as NarrativeNodeType | undefined);
      });
      if (nextFlowEdge) {
        await syncCurrentNode(nextFlowEdge.target, "NODE_COMPLETED", { annotationBypassed: true });
        return;
      }
    }

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

  async function startAudioPlayback(overrideNodeId?: string) {
    const targetNode = overrideNodeId ? nodes.find(n => n.id === overrideNodeId) : actionNode;

    if (!run || !targetNode) {
      console.warn("[audio] abort: no run or targetNode", { run: !!run, targetNode: targetNode?.id });
      return;
    }

    const hasUsableAudio = Boolean(
      targetNode.type === "AUDIO" && targetNode.data?.audioAssetId ||
      targetNode.type === "AUDIO_BUTTON" && targetNode.data?.audioButtonId
    );

    if (run?.status !== "RUNNING" || !hasUsableAudio) {
      console.warn("[audio] abort: not usable", { targetNodeId: targetNode.id, currentNodeId: currentNode?.id, runStatus: run?.status });
      setMessage("Este recurso no está disponible o no tiene contenido válido.");
      return;
    }

    let audioAssetIdToPlay: string | undefined;

    if (targetNode.type === "AUDIO") {
      audioAssetIdToPlay = targetNode.data?.audioAssetId as string | undefined;
      console.log("[audio] AUDIO node assetId:", audioAssetIdToPlay, "nodeData:", targetNode.data);
    } else if (targetNode.type === "AUDIO_BUTTON") {
      // Use already-loaded details, or fetch them on-demand if not available yet
      let buttonDetails = currentButtonDetails;
      if (!buttonDetails && targetNode.data?.audioButtonId) {
        try {
          buttonDetails = await api<any>(`/audio-buttons/${targetNode.data.audioButtonId}`);
          setCurrentButtonDetails(buttonDetails);
        } catch {
          console.warn("[audio] failed to fetch button details on demand");
        }
      }
      audioAssetIdToPlay = buttonDetails?.audioAssetId ?? (buttonDetails as any)?.audioAsset?.id ?? undefined;
      console.log("[audio] AUDIO_BUTTON details:", buttonDetails, "assetId:", audioAssetIdToPlay);
    }

    if (!audioAssetIdToPlay) {
      console.warn("[audio] abort: no audioAssetId. targetNode.type:", targetNode.type, "currentButtonDetails:", currentButtonDetails);
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

      if (!audioRef.current) {
        URL.revokeObjectURL(objectUrl);
        objectUrlRef.current = null;
        setMessage("No se pudo inicializar el reproductor de audio.");
        return;
      }

      audioRef.current.src = objectUrl;
      audioRef.current.volume = 1;
      await audioRef.current.play();
      setPlaybackState("playing");

      await api(`/narrative-runs/${run.id}/events`, {
        method: "POST",
        body: JSON.stringify({
          eventType: "AUDIO_PLAYED",
          nodeId: targetNode.id,
          payload: targetNode.type === "AUDIO_BUTTON"
            ? { audioButtonId: targetNode.data?.audioButtonId, audioAssetId: audioAssetIdToPlay }
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
    setPlaybackState("paused");
  }

  async function resumeAudio() {
    if (!audioRef.current) return;
    await audioRef.current.play();
    setPlaybackState("playing");
  }

  async function stopAudio() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlaybackState("idle");
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
    } catch (error) {
      setMessage(handleApiError(error, "No se pudo cancelar la ejecución."));
    } finally {
      setWorking(false);
    }
  }

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
  const actionableNodes = useMemo(
    () => nodes.filter((node) => node.type !== "START" && node.type !== "INSTRUCTION").length,
    [nodes],
  );
  const progressedNodes = useMemo(
    () =>
      nodes.filter((node) => node.type !== "INSTRUCTION" && (completedIds.has(node.id) || skippedIds.has(node.id))).length +
      (currentNode && currentNode.type !== "START" && currentNode.type !== "INSTRUCTION" ? 1 : 0),
    [completedIds, currentNode, nodes, skippedIds],
  );
  const elapsedLabel = useMemo(() => {
    if (!run?.startedAt) return null;
    const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(run.startedAt).getTime()) / 1000));
    const hh = String(Math.floor(diffSeconds / 3600)).padStart(2, "0");
    const mm = String(Math.floor((diffSeconds % 3600) / 60)).padStart(2, "0");
    const ss = String(diffSeconds % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }, [run?.startedAt]);

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
  const isDualView = playerViewMode === "dual";

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

  async function copyNodeText(nodeId: string) {
    const node = nodeMap.get(nodeId);
    const text = String(
      node?.data?.body ??
        node?.data?.instruction ??
        node?.data?.template ??
        node?.data?.label ??
        "",
    );
    if (!text) {
      setMessage("Este nodo no tiene contenido para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Contenido copiado al portapapeles.");
    } catch {
      setMessage("No se pudo copiar el contenido.");
    }
  }

  async function generateDynamicAudio(nodeId: string) {
    if (!run) return;
    const node = nodeMap.get(nodeId);
    if (!node || node.type !== "DYNAMIC_AUDIO") {
      setMessage("Este nodo no es de audio dinámico.");
      return;
    }

    const template = normalizeDynamicAudioTemplate(String(node.data?.template ?? "")).trim();
    if (!template) {
      setMessage("Este nodo no tiene plantilla configurada.");
      return;
    }

    const variables = (() => {
      const configured = Array.isArray(node.data?.variables)
        ? node.data?.variables.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
        : [];
      return configured.length > 0 ? configured : extractDynamicAudioVariables(template);
    })();

    const draftValues = (dynamicAudioDrafts[nodeId] ?? {}) as Record<string, string>;
    const missingVariables = variables.filter((variable) => !String(draftValues[variable] ?? "").trim());

    if (missingVariables.length > 0) {
      setMessage(`Completa las variables: ${missingVariables.map((variable) => `{{${variable}}}`).join(", ")}.`);
      return;
    }

    const resolvedText = resolveDynamicAudioTemplate(template, draftValues);

    setDynamicAudioGeneratingNodeId(nodeId);
    setMessage(null);
    try {
      const result = await api<DynamicAudioGenerationResponse>(`/narrative-runs/${run.id}/dynamic-audio`, {
        method: "POST",
        body: JSON.stringify({
          text: resolvedText,
          defaultVoiceId: String(node.data?.voiceId ?? "") || undefined,
          defaultModelId: String(node.data?.modelId ?? "") || undefined,
          defaultOutputFormat: String(node.data?.outputFormat ?? "") || undefined,
          stability: node.data?.stability !== undefined ? Number(node.data.stability) : undefined,
          similarityBoost: node.data?.similarityBoost !== undefined ? Number(node.data.similarityBoost) : undefined,
          style: node.data?.style !== undefined ? Number(node.data.style) : undefined,
          speed: node.data?.speed !== undefined ? Number(node.data.speed) : undefined,
          speakerBoost: typeof node.data?.speakerBoost === "boolean" ? node.data.speakerBoost : undefined,
        }),
      });

      const objectUrl = buildDynamicAudioObjectUrl(result.contentType, result.audioBase64);
      setDynamicAudioClips((current) => {
        const previousClip = current[nodeId];
        if (previousClip?.objectUrl) {
          URL.revokeObjectURL(previousClip.objectUrl);
        }
        return {
          ...current,
          [nodeId]: {
            objectUrl,
            fileName: result.fileName,
            contentType: result.contentType,
            sizeBytes: result.sizeBytes,
            generatedAt: new Date().toISOString(),
            text: resolvedText,
          },
        };
      });
      setMessage("Audio dinámico generado. Ya puedes reproducirlo cuando quieras.");
    } catch (error) {
      setMessage(handleApiError(error, "No se pudo generar el audio dinámico."));
    } finally {
      setDynamicAudioGeneratingNodeId(null);
    }
  }

  async function playDynamicAudio(nodeId: string) {
    const clip = dynamicAudioClips[nodeId];
    if (!clip) {
      setMessage("Primero genera el audio dinámico.");
      return;
    }

    if (!audioRef.current) {
      setMessage("No se pudo inicializar el reproductor de audio.");
      return;
    }

    try {
      if (audioRef.current.src) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      audioRef.current.src = clip.objectUrl;
      audioRef.current.volume = 1;
      await audioRef.current.play();
      setPlaybackState("playing");
      setMessage("Audio dinámico en reproducción.");
    } catch (error) {
      setMessage(handleApiError(error, "No se pudo reproducir el audio dinámico."));
    }
  }

  function renderAudioControls(label: string) {
    return (
      <>
        <div className="space-y-4">
          {playbackState !== "idle" && playbackProgress.duration > 0 ? (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold text-on-surface-variant">
                <span>{Math.floor(playbackProgress.current)}s</span>
                <span>{Math.floor(playbackProgress.duration)}s</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-variant/30">
                <div 
                  className="h-full bg-primary transition-all duration-200 ease-linear" 
                  style={{ width: `${(playbackProgress.current / playbackProgress.duration) * 100}%` }}
                />
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void startAudioPlayback()}
              disabled={working || !hasAudio || playbackState === "playing" || run?.status !== "RUNNING"}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              {label}
            </button>
            <button
              type="button"
              onClick={() => void pauseAudio()}
              disabled={playbackState !== "playing"}
              className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Pause className="h-4 w-4" />
              Pausar
            </button>
            <button
              type="button"
              onClick={() => void resumeAudio()}
              disabled={playbackState !== "paused"}
              className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              Reanudar
            </button>
            <button
              type="button"
              onClick={() => void stopAudio()}
              disabled={playbackState === "idle"}
              className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Square className="h-4 w-4" />
              Detener
            </button>
          </div>
        </div>
      </>
    );
  }

  function renderActionContent() {
    if (!actionNode) return null;

    if (actionNode.type === "AUDIO") {
      return (
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
          {audioDescription ? <p className="text-sm text-on-surface-variant">{audioDescription}</p> : null}
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
          {renderAudioControls("Reproducir audio")}
        </div>
      );
    }

    if (actionNode.type === "AUDIO_BUTTON") {
      return (
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
            <div className="rounded-xl border border-outline-variant bg-surface p-3" style={{ borderLeftColor: currentButtonDetails.color ?? undefined, borderLeftWidth: 4 }}>
              <p className="font-semibold text-on-surface">{currentButtonDetails.label}</p>
              <p className="text-xs text-on-surface-variant">
                Categoría: {currentButtonDetails.category?.name || "Sin categoría"} | Acceso directo: {currentButtonDetails.shortcutKey || "Ninguno"}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Audio: {currentButtonDetails.audioAsset?.originalName || currentButtonDetails.audioAssetId || "No disponible"}
              </p>
              {currentButtonDetails.description ? <p className="mt-2 text-sm text-on-surface-variant">{currentButtonDetails.description}</p> : null}
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
          {renderAudioControls("Reproducir botón")}
        </div>
      );
    }

    if (actionNode.type === "SCRIPT_TEXT") {
      return (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Texto para leer</p>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className={`inline-flex rounded-full border px-2.5 py-1 ${statusTone(isRequiredNode ? "current" : "available")}`}>
              {boolLabel(isRequiredNode, "Lectura requerida", "Lectura opcional")}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-base leading-7 text-on-surface">
            {String(actionNode.data?.body ?? "Sin contenido")}
          </p>
          {operatorNotes ? (
            <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-3 text-sm text-on-surface-variant">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Notas</p>
              <p className="mt-2 whitespace-pre-wrap">{operatorNotes}</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void copyScriptText()}
            className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
          >
            <Copy className="h-4 w-4" />
            Copiar texto
          </button>
          {!actionNodeIsCurrent ? (
            <p className="text-xs text-on-surface-variant">El texto puede consultarse aunque no sea el paso actual.</p>
          ) : null}
        </div>
      );
    }

    if (actionNode.type === "INSTRUCTION") {
      return (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Instrucción operativa</p>
          <div className="rounded-2xl border border-sky-300/30 bg-sky-500/10 px-4 py-4">
            <p className="whitespace-pre-wrap text-base leading-7 text-on-surface">
              {String(actionNode.data?.instruction ?? "Sin instrucción")}
            </p>
          </div>
          {operatorNotes ? (
            <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-3 text-sm text-on-surface-variant">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Notas</p>
              <p className="mt-2 whitespace-pre-wrap">{operatorNotes}</p>
            </div>
          ) : null}
          {!actionNodeIsCurrent ? (
            <p className="text-xs text-on-surface-variant">La instrucción puede consultarse aunque no sea el paso actual.</p>
          ) : null}
        </div>
      );
    }

    if (actionNode.type === "PAUSE") {
      return (
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
          {!actionNodeIsCurrent ? (
            <p className="text-xs text-on-surface-variant">La pausa puede consultarse aunque no sea el paso actual.</p>
          ) : null}
          {(actionNode.data?.manual === false || actionNode.data?.pauseType === "timer") &&
          pauseRemainingSeconds === null ? (
            <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-700 dark:text-amber-300">
              La duración no es válida. Se mantiene fallback manual para continuar de forma segura.
            </div>
          ) : null}
          {operatorNotes ? (
            <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-3 text-sm text-on-surface-variant">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Notas</p>
              <p className="mt-2 whitespace-pre-wrap">{operatorNotes}</p>
            </div>
          ) : null}
        </div>
      );
    }

    if (actionNode.type === "DECISION") {
      return (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Decisión</p>
          <p className="text-base leading-7 text-on-surface">
            {String(actionNode.data?.question ?? "¿Qué sigue?")}
          </p>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className={`inline-flex rounded-full border px-2.5 py-1 ${statusTone(actionNodeDecisionChoices.length >= 2 ? "available" : "error")}`}>
              {actionNodeDecisionChoices.length} ruta(s)
            </span>
            <span className={`inline-flex rounded-full border px-2.5 py-1 ${statusTone(actionNodeIsInteractive ? "current" : "locked")}`}>
              {actionNodeIsInteractive ? "Selecciona una opción" : "Solo consulta"}
            </span>
          </div>
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
          {selectedDecisionTargets.get(actionNode.id) ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-3 text-sm text-primary">
              Ruta elegida registrada.
            </div>
          ) : null}
        </div>
      );
    }

    if (actionNode.type === "END") {
      return (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Cierre</p>
          <p className="text-base leading-7 text-on-surface">
            La narrativa llegó al nodo final.
          </p>
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            Este nodo habilita el cierre exitoso.
          </div>
        </div>
      );
    }

    return (
      <p className="text-sm text-on-surface-variant">
        Sin contenido para mostrar.
      </p>
    );
  }

  function renderActionButtons() {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void completeCurrentNode(false)}
          disabled={working || run?.status !== "RUNNING" || !actionNodeIsInteractive || actionNode?.type === "DECISION"}
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
            run?.status !== "RUNNING" ||
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
          disabled={working || run?.status !== "RUNNING" || currentNode?.type !== "END"}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4" />
          Finalizar
        </button>
        <button
          type="button"
          onClick={() => void cancelRun()}
          disabled={working || run?.status !== "RUNNING"}
          className="inline-flex items-center gap-2 rounded-2xl border border-red-300 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300"
        >
          <StopCircle className="h-4 w-4" />
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <NarrativePlayerContext.Provider
      value={{
        playbackState,
        working,
        currentNodeId: uiCurrentNodeId,
        startAudioPlayback,
        pauseAudio,
        resumeAudio,
        stopAudio,
        completeCurrentNode,
        finishRun,
        copyNodeText,
        chooseDecision: handleDecision,
        setMessage,
        selectNode: (nodeId: string) => {
          setSelectedNodeId(nodeId);
          setContextMenu({ isOpen: false, x: 0, y: 0, nodeId: null });
        },
        openNodeMenu: (nodeId: string) => {
          setSelectedNodeId(nodeId);
          const x = typeof window !== "undefined" ? Math.max(24, window.innerWidth / 2 - 160) : 160;
          const y = typeof window !== "undefined" ? Math.max(100, window.innerHeight / 2 - 180) : 120;
          setContextMenu({ isOpen: true, x, y, nodeId });
        },
      }}
    >
      {headerSlot
        ? createPortal(
            <div className="flex min-w-0 items-center justify-center">
              <BoardViewModeToggle value={playerViewMode} onChange={setPlayerViewMode} />
            </div>,
            headerSlot,
          )
        : null}

    <ReactFlowProvider>
      {buttonBoardModalButton ? (
        <AudioButtonDetailsModal
          button={buttonBoardModalButton}
          onClose={() => setButtonBoardModalButton(null)}
        />
      ) : null}
      <audio
        ref={audioRef}
        onPlay={() => setPlaybackState("playing")}
        onPause={() => setPlaybackState("paused")}
        onEnded={() => {
          setPlaybackState("idle");
          setPlaybackProgress({ current: 0, duration: 0 });
          if (actionNodeIsCurrent && actionNode?.data?.required !== false && outgoing.length <= 1) {
            void completeCurrentNode(false);
          }
        }}
        onLoadedMetadata={(e) => {
          setMessage(null);
          const target = e.target as HTMLAudioElement | null;
          if (target) {
            setPlaybackProgress({ current: 0, duration: target.duration });
          }
        }}
        onTimeUpdate={(e) => {
          const target = e.target as HTMLAudioElement | null;
          if (target) {
            setPlaybackProgress(prev => ({ ...prev, current: target.currentTime }));
          }
        }}
        className="hidden"
      />
      <div
        className={
          isDualView
            ? "grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start"
            : "space-y-2"
        }
      >
        <div className="min-w-0 w-full space-y-2">
        {message ? (
          <div className="rounded-[24px] border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant shadow-elevation-1">
            {message}
          </div>
        ) : null}

        <section className="rounded-[22px] border border-outline-variant bg-surface-container px-3 py-2 shadow-elevation-1">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-3">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                Narrativas / {run.narrative.title}
              </p>
              <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-on-surface">
                {run.narrative.title}
              </h1>
            </div>
            <div className="flex w-full items-center justify-start gap-1.5 overflow-x-auto pb-0.5 lg:w-auto lg:justify-end lg:overflow-visible">
              <button
                type="button"
                onClick={() => centerCurrentNode()}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-2xl border border-outline-variant bg-surface px-3 text-xs font-semibold text-on-surface transition-colors hover:border-primary"
              >
                <Crosshair className="h-3.5 w-3.5" />
                Centrar
              </button>
              <button
                type="button"
                onClick={() => void cancelRun()}
                disabled={working || run.status !== "RUNNING"}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-2xl border border-red-300/30 bg-red-500/10 px-3 text-xs font-semibold text-red-300 transition-colors hover:border-red-400 disabled:opacity-50"
              >
                <StopCircle className="h-3.5 w-3.5" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void finishRun()}
                disabled={working || run.status !== "RUNNING" || currentNode.type !== "END"}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-300 transition-colors hover:border-emerald-400 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Finalizar
              </button>
              <button
                type="button"
                onClick={() => router.push("/narratives")}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-2xl border border-outline-variant bg-surface px-3 text-xs font-semibold text-on-surface transition-colors hover:border-primary"
              >
                Volver
              </button>
              <div className="flex w-full min-w-[200px] max-w-[280px] shrink-0 items-center gap-2 rounded-full border border-outline-variant bg-surface px-3 py-2 lg:ml-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  Cerca
                </span>
                <input
                  type="range"
                  min={0}
                  max={PLAYER_DISTANCE_PRESETS.length - 1}
                  step={1}
                  value={PLAYER_DISTANCE_PRESETS.findIndex((preset) => preset.id === distancePreset.id)}
                  onChange={(event) => {
                    const nextPreset = PLAYER_DISTANCE_PRESETS[Number(event.target.value)];
                    if (nextPreset) setDistancePresetId(nextPreset.id);
                  }}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-variant/30 accent-primary"
                />
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  Máximo
                </span>
              </div>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-outline-variant bg-surface px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
              {run.status}
            </span>
            <span className="rounded-full border border-outline-variant bg-surface px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
              v{run.narrativeVersion.versionNumber}
            </span>
          </div>
        </section>

        {/* Banner de fin de flujo / estado de corrida */}
        {currentNode?.type === "END" && run?.status === "RUNNING" && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-[24px] border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-elevation-2 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-emerald-200">Flujo Completado</h4>
                <p className="text-sm text-emerald-300/80">Has alcanzado el nodo final. La ejecución puede ser finalizada de forma segura.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void finishRun()}
              disabled={working}
              className="w-full sm:w-auto inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Finalizar Ejecución
            </button>
          </div>
        )}

        {run?.status === "COMPLETED" && (
          <div className="flex items-center gap-3 rounded-[24px] border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-elevation-2 animate-fade-in">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-emerald-200 font-bold">Ejecución Completada</h4>
              <p className="text-sm text-emerald-300/80">Esta corrida ha terminado y ha sido registrada como completada con éxito.</p>
            </div>
          </div>
        )}

        {run?.status === "CANCELLED" && (
          <div className="flex items-center gap-3 rounded-[24px] border border-red-500/30 bg-red-500/10 p-5 shadow-elevation-2 animate-fade-in">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/20 text-red-400">
              <StopCircle className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-red-200 font-bold">Ejecución Cancelada</h4>
              <p className="text-sm text-red-300/80">Esta corrida fue cancelada por el operador.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <section className="flex flex-col rounded-[28px] border border-outline-variant bg-surface-container p-3 shadow-elevation-1">
            <div className="relative h-[calc(100vh-400px)] min-h-[360px] w-full overflow-hidden rounded-[24px] border border-outline-variant bg-[#120f1c] xl:h-[calc(100vh-410px)]">
              <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/20 bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-primary backdrop-blur">
                  {nodeLabel(currentNode)}
                </span>
                <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-slate-300 backdrop-blur">
                  {Math.min(progressedNodes, actionableNodes)} / {actionableNodes || 0}
                </span>
                <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-slate-300 backdrop-blur">
                  Solo lectura
                </span>
              </div>
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={playerNodeTypes}
                onNodeClick={(_, node) => {
                  setSelectedNodeId(node.id);
                  setContextMenu({ isOpen: false, x: 0, y: 0, nodeId: null });
                  if (node.type === "AUDIO_BUTTON") {
                    void startAudioPlayback(node.id);
                  }
                }}
                onNodeContextMenu={(e, node) => {
                  e.preventDefault();
                  // Prevenir salirse de la pantalla aproximando el tamaño del popup.
                  const popupWidth = 430;
                  const popupHeight = 640;
                  const safeX = Math.min(
                    e.clientX,
                    typeof window !== "undefined" ? window.innerWidth - popupWidth - 16 : e.clientX,
                  );
                  const safeY = Math.min(
                    e.clientY,
                    typeof window !== "undefined" ? window.innerHeight - popupHeight - 16 : e.clientY,
                  );
                  setContextMenu({ isOpen: true, x: safeX, y: safeY, nodeId: node.id });
                  if (node.type === "AUDIO_BUTTON") {
                    const audioButtonId = String(node.data?.audioButtonId ?? "");
                    if (audioButtonId) {
                      void api<BoardAudioButton>(`/audio-buttons/${audioButtonId}`)
                        .then((res) => {
                          setButtonBoardModalButton(res);
                        })
                        .catch(() => {
                          setButtonBoardModalButton(null);
                          setButtonDetailsError("No se pudo cargar el detalle del botón o el recurso ya no está disponible.");
                        });
                    }
                  } else {
                    setButtonBoardModalButton(null);
                  }
                }}
                onPaneClick={() => {
                  setContextMenu({ isOpen: false, x: 0, y: 0, nodeId: null });
                }}
                onInit={(instance) => {
                  reactFlowRef.current = instance;
                }}
                onMoveEnd={(_, viewport) => {
                  setCanvasViewport({
                    x: viewport.x,
                    y: viewport.y,
                    zoom: viewport.zoom,
                  });
                }}
                fitView={false}
                fitViewOptions={{ padding: 0.2, minZoom: 0.2, maxZoom: 2 }}
                defaultViewport={canvasViewport}
                minZoom={0.2}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
                nodesDraggable={false}
                nodesConnectable={false}
                nodesFocusable={false}
                elementsSelectable={false}
                zoomOnDoubleClick
                zoomOnScroll
                zoomOnPinch
                panOnScroll={false}
                panOnDrag
                selectionOnDrag={false}
                elevateNodesOnSelect={false}
              >
                <Controls showInteractive={false} className="!left-auto !right-3 !top-3 !bottom-auto !rounded-2xl !border !border-white/10 !bg-black/45 !backdrop-blur" />
                <Background color="rgba(148,163,184,0.16)" gap={20} size={1.1} />
              </ReactFlow>

              {/* CONTEXTUAL POPOVER MENU */}
              {contextMenu.isOpen && contextMenu.nodeId && (
                <div
                  className="fixed z-50 w-[430px] max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] overflow-hidden rounded-[24px] border border-outline-variant bg-surface shadow-elevation-3 animate-fade-in"
                  style={{ top: contextMenu.y, left: contextMenu.x }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(() => {
                    const ctxNode = nodeMap.get(contextMenu.nodeId);
                    if (!ctxNode) return null;
                    const status = nodeStates.get(ctxNode.id) ?? "locked";
                    
                    return (
                      <div className="flex flex-col">
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-outline-variant bg-surface-container/95 px-4 py-3 backdrop-blur">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${status === "current" ? "bg-primary animate-pulse" : status === "completed" ? "bg-emerald-400" : "bg-slate-500"}`} />
                            <div>
                              <p className="text-sm font-semibold text-on-surface">{nodeLabel(ctxNode)}</p>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                                {status === "current" ? "Paso actual" : status === "completed" ? "Ya completado" : status === "locked" ? "Bloqueado" : ctxNode.type}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setContextMenu({ isOpen: false, x: 0, y: 0, nodeId: null })}
                            className="text-on-surface-variant hover:text-on-surface"
                          >
                            ×
                          </button>
                        </div>
                        <div className="max-h-[calc(100vh-104px)] space-y-3 overflow-y-auto px-4 py-3 pr-3">
                          {/* === AUDIO / AUDIO_BUTTON actions === */}
                          {(ctxNode.type === "AUDIO" || ctxNode.type === "AUDIO_BUTTON") && (() => {
                            const isCurrentNode = ctxNode.id === run?.currentNodeId;
                            const canAct = isCurrentNode;
                            return (
                              <div className="space-y-3">
                                <div className="rounded-2xl border border-primary/15 bg-primary/10 px-3 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                                    {ctxNode.type === "AUDIO_BUTTON" ? "Botón de botonera" : "Recurso de audio"}
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-on-surface">{nodeSummary(ctxNode)}</p>
                                </div>
                                {/* Barra de progreso si está reproduciendo */}
                                {isCurrentNode && playbackState !== "idle" && playbackProgress.duration > 0 && (
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-on-surface-variant">
                                      <span>{Math.floor(playbackProgress.current)}s</span>
                                      <span>{Math.floor(playbackProgress.duration)}s</span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-on-surface/10">
                                      <div
                                        className="h-1.5 rounded-full bg-primary transition-all"
                                        style={{ width: `${playbackProgress.duration > 0 ? (playbackProgress.current / playbackProgress.duration) * 100 : 0}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                                {/* Audio element oculto — solo para el nodo actual */}
                                {isCurrentNode && renderAudioControls(nodeLabel(ctxNode))}
                                <div className="flex flex-wrap gap-2">
                                  {canAct && playbackState === "idle" && (
                                    <button type="button" onClick={() => { void startAudioPlayback(); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90">
                                      <Play className="h-3.5 w-3.5 fill-current" /> Reproducir
                                    </button>
                                  )}
                                  {canAct && playbackState === "playing" && (
                                    <button type="button" onClick={() => { void pauseAudio(); }} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-semibold hover:border-primary">
                                      <Pause className="h-3.5 w-3.5 fill-current" /> Pausar
                                    </button>
                                  )}
                                  {canAct && playbackState === "paused" && (
                                    <button type="button" onClick={() => { void resumeAudio(); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90">
                                      <Play className="h-3.5 w-3.5 fill-current" /> Reanudar
                                    </button>
                                  )}
                                  {canAct && playbackState !== "idle" && (
                                    <button type="button" onClick={() => { void stopAudio(); }} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-semibold hover:border-red-400 hover:text-red-400">
                                      <Square className="h-3.5 w-3.5 fill-current" /> Detener
                                    </button>
                                  )}
                                  {canAct && (
                                    <button type="button" onClick={() => { void completeCurrentNode(true); setContextMenu({ isOpen: false, x: 0, y: 0, nodeId: null }); }} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Marcar completado
                                    </button>
                                  )}
                                  {!canAct && (
                                    <p className="text-xs text-on-surface-variant">Disponible como acción cuando sea el paso actual.</p>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* === DYNAMIC_AUDIO actions === */}
                          {ctxNode.type === "DYNAMIC_AUDIO" && (() => {
                            const dynamicAudioData = ctxNode.data as any;
                            const template = normalizeDynamicAudioTemplate(String(dynamicAudioData?.template ?? ""));
                            const variables: string[] = (() => {
                              const configured = Array.isArray(dynamicAudioData?.variables)
                                ? dynamicAudioData.variables.filter((variable: unknown): variable is string => typeof variable === "string" && Boolean(variable.trim()))
                                : [];
                              return configured.length > 0 ? Array.from(new Set(configured)) : extractDynamicAudioVariables(template);
                            })();
                            const draftValues = (dynamicAudioDrafts[ctxNode.id] ?? {}) as Record<string, string>;
                            const missingVariables = variables.filter((variable) => !String(draftValues[variable] ?? "").trim());
                            const resolvedText = resolveDynamicAudioTemplate(template, draftValues);
                            const generatedClip = dynamicAudioClips[ctxNode.id] ?? null;
                            const canGenerate =
                              run?.status === "RUNNING" &&
                              Boolean(template.trim()) &&
                              missingVariables.length === 0 &&
                              dynamicAudioGeneratingNodeId !== ctxNode.id;
                            return (
                              <div className="space-y-3">
                                <div className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Variables del run</p>
                                      <p className="mt-1 text-[11px] text-on-surface-variant">Completa cada valor antes de generar el audio.</p>
                                    </div>
                                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${missingVariables.length ? "border-amber-300/30 bg-amber-500/10 text-amber-200" : "border-emerald-300/30 bg-emerald-500/10 text-emerald-200"}`}>
                                      {missingVariables.length ? `${missingVariables.length} pendiente(s)` : "Listo"}
                                    </span>
                                  </div>

                                  {variables.length > 0 ? (
                                    <div className="grid gap-2">
                                      {variables.map((variable) => (
                                        <label key={variable} className="grid gap-1.5">
                                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">{`{{${variable}}}`}</span>
                                          <input
                                            type="text"
                                            value={dynamicAudioDrafts[ctxNode.id]?.[variable] ?? ""}
                                            onChange={(event) => {
                                              const value = event.target.value;
                                              setDynamicAudioDrafts((current) => ({
                                                ...current,
                                                [ctxNode.id]: {
                                                  ...(current[ctxNode.id] ?? {}),
                                                  [variable]: value,
                                                },
                                              }));
                                            }}
                                            placeholder={`Valor para ${variable}`}
                                            className="h-9 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                                          />
                                        </label>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-on-surface-variant">
                                      No hay variables detectadas en esta plantilla.
                                    </p>
                                  )}

                                  <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Texto resuelto</p>
                                    <p className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-on-surface">{resolvedText || "Sin texto resuelto"}</p>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => { void copyNodeText(ctxNode.id); }}
                                      className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-semibold hover:border-primary"
                                    >
                                      <Copy className="h-3.5 w-3.5" /> Copiar plantilla
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { void generateDynamicAudio(ctxNode.id); }}
                                      disabled={!canGenerate}
                                      className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-500 px-3 py-2 text-sm font-semibold text-white hover:bg-fuchsia-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <WandSparkles className="h-3.5 w-3.5" />
                                      {dynamicAudioGeneratingNodeId === ctxNode.id ? "Generando..." : "Generar audio"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { void playDynamicAudio(ctxNode.id); }}
                                      disabled={!generatedClip}
                                      className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-300/30 bg-fuchsia-500/10 px-3 py-2 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <Play className="h-3.5 w-3.5 fill-current" />
                                      Reproducir audio
                                    </button>
                                    {generatedClip ? (
                                      <button
                                        type="button"
                                        onClick={() => { void stopAudio(); }}
                                        className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-semibold hover:border-red-400 hover:text-red-400"
                                      >
                                        <Square className="h-3.5 w-3.5 fill-current" />
                                        Detener
                                      </button>
                                    ) : null}
                                  </div>

                                  {generatedClip ? (
                                    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-50">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Audio generado</p>
                                      <p className="mt-2 truncate font-semibold text-on-surface">{generatedClip.fileName}</p>
                                      <p className="mt-1 text-xs text-on-surface-variant">
                                        {generatedClip.sizeBytes.toLocaleString("es-CO")} bytes · {formatDateTime(generatedClip.generatedAt)}
                                      </p>
                                      <div className="mt-3">
                                        <a
                                          href={generatedClip.objectUrl}
                                          download={generatedClip.fileName}
                                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
                                        >
                                          <Copy className="h-3.5 w-3.5" />
                                          Descargar audio
                                        </a>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-on-surface-variant">
                                      Genera primero el audio para habilitar la reproducción manual.
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* === SCRIPT_TEXT actions === */}
                          {ctxNode.type === "SCRIPT_TEXT" && (() => {
                            const text = String((ctxNode.data as any)?.body ?? "");
                            const isCurrentNode = ctxNode.id === run?.currentNodeId;
                            return (
                              <div className="space-y-3">
                                <div className="max-h-56 overflow-y-auto rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 text-sm text-slate-100">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Guion completo</p>
                                  <p className="mt-3 whitespace-pre-wrap leading-7">"{text || "Sin contenido"}"</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button type="button" onClick={() => { void copyNodeText(ctxNode.id); }} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-semibold hover:border-primary">
                                    <Copy className="h-3.5 w-3.5" /> Copiar texto
                                  </button>
                                  {isCurrentNode && (
                                    <button type="button" onClick={() => { void completeCurrentNode(false); setContextMenu({ isOpen: false, x: 0, y: 0, nodeId: null }); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary">
                                      <ArrowRight className="h-3.5 w-3.5" /> Leído · Continuar
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* === INSTRUCTION actions === */}
                          {ctxNode.type === "INSTRUCTION" && (() => {
                            const isCurrentNode = ctxNode.id === run?.currentNodeId;
                            const instruction = String((ctxNode.data as any)?.instruction ?? "");
                            return (
                              <div className="space-y-3">
                                <div className="rounded-2xl border-l-4 border-l-amber-400 bg-amber-400/12 p-4 text-sm text-amber-50">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Instrucción operativa</p>
                                  <p className="mt-3 whitespace-pre-wrap leading-7">{instruction || "Sin instrucción"}</p>
                                </div>
                                {isCurrentNode && (
                                  <button type="button" onClick={() => { void completeCurrentNode(false); setContextMenu({ isOpen: false, x: 0, y: 0, nodeId: null }); }} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Entendido · Continuar
                                  </button>
                                )}
                              </div>
                            );
                          })()}

                          {/* === PAUSE actions === */}
                          {ctxNode.type === "PAUSE" && (() => {
                            const isCurrentNode = ctxNode.id === run?.currentNodeId;
                            const pauseData = ctxNode.data as any;
                            return (
                              <div className="space-y-3">
                                <div className="rounded-2xl border border-outline-variant bg-surface p-4 text-sm">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Pausa</p>
                                  <p className="mt-2 text-on-surface-variant">Tipo: <span className="font-semibold text-on-surface">{pauseData?.pauseType === "timer" || pauseData?.manual === false ? "Temporizador" : "Manual"}</span></p>
                                  {pauseData?.durationSeconds && <p className="text-on-surface-variant">Duración: <span className="font-semibold text-on-surface">{pauseData.durationSeconds}s</span></p>}
                                </div>
                                {isCurrentNode && (
                                  <button type="button" onClick={() => { void completeCurrentNode(false); setContextMenu({ isOpen: false, x: 0, y: 0, nodeId: null }); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary">
                                    <ArrowRight className="h-3.5 w-3.5" /> Continuar
                                  </button>
                                )}
                              </div>
                            );
                          })()}

                          {/* === DECISION actions === */}
                          {ctxNode.type === "DECISION" && (() => {
                            const isCurrentNode = ctxNode.id === run?.currentNodeId;
                            const choices: DecisionChoice[] = (() => {
                              const raw = (ctxNode.data as any)?.options;
                              return flowEdges
                                .filter((e) => e.source === ctxNode.id)
                                .map((e, index) => ({ label: (e.label as string) || readDecisionLabels(raw)[index] || "Continuar", targetNodeId: e.target }));
                            })();
                            return (
                              <div className="space-y-3">
                                <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">Pregunta</p>
                                  <p className="mt-2 text-sm font-semibold text-on-surface">{(ctxNode.data as any)?.question ?? nodeLabel(ctxNode)}</p>
                                </div>
                                {isCurrentNode ? (
                                  <div className="flex flex-col gap-2">
                                    {choices.length > 0 ? choices.map((c) => (
                                      <button
                                        key={c.targetNodeId}
                                        type="button"
                                        onClick={() => { void handleDecision(c.targetNodeId, c.label); setContextMenu({ isOpen: false, x: 0, y: 0, nodeId: null }); }}
                                        className="w-full rounded-xl border border-purple-500/40 bg-purple-500/10 px-3 py-2.5 text-left text-sm font-semibold text-purple-300 hover:bg-purple-500/20"
                                      >
                                        {c.label}
                                      </button>
                                    )) : <p className="text-xs text-on-surface-variant">No hay opciones configuradas.</p>}
                                  </div>
                                ) : <p className="text-xs text-on-surface-variant">Solo disponible en el paso actual.</p>}
                              </div>
                            );
                          })()}

                          {/* === END actions === */}
                          {ctxNode.type === "END" && (() => {
                            const isCurrentNode = ctxNode.id === run?.currentNodeId;
                            return (
                              <div className="space-y-3">
                                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Cierre</p>
                                  <p className="mt-2">{nodeLabel(ctxNode)} · Fin del flujo.</p>
                                </div>
                                {isCurrentNode && (
                                  <button type="button" onClick={() => { void finishRun(); setContextMenu({ isOpen: false, x: 0, y: 0, nodeId: null }); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar ejecución
                                  </button>
                                )}
                              </div>
                            );
                          })()}

                          {/* Estado bloqueado */}
                          {status === "locked" && (
                            <div className="flex items-start gap-2 rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
                              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              Este nodo no está disponible aún en la ruta actual.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-outline-variant bg-surface-container px-4 py-3 shadow-elevation-1">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-semibold text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    Actual
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Completado
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-400/20 bg-slate-500/10 px-3 py-1 font-semibold text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    Pendiente
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 font-semibold text-fuchsia-300">
                    <Route className="h-3.5 w-3.5" />
                    Ruta tomada
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-xs font-semibold text-on-surface-variant">
                    Seleccionado: {actionNode ? nodeLabel(actionNode) : "Ninguno"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowBottomDock((value) => !value)}
                    className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-xs font-semibold text-on-surface transition-colors hover:border-primary"
                  >
                    {showBottomDock ? "Ocultar panel" : "Abrir panel"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Estado operacional</p>
                    <p className="mt-1 text-sm font-semibold text-on-surface">
                      Actual: {nodeLabel(currentNode)} · Última acción: {eventLog[0]?.eventType ?? "Sin eventos"}
                    </p>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    Ruta: {orderedNodes.slice(0, 3).map((node) => nodeLabel(node)).join(" → ")}
                    {orderedNodes.length > 3 ? " ..." : ""}
                  </p>
                </div>
              </div>

              {showBottomDock ? (
                <div className="space-y-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
                    <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Estado operacional</p>
                      <p className="mt-2 text-sm font-semibold text-on-surface">
                        Actual: {nodeLabel(currentNode)} · Última acción: {eventLog[0]?.eventType ?? "Sin eventos"}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Ruta: {orderedNodes.slice(0, 3).map((node) => nodeLabel(node)).join(" → ")}
                        {orderedNodes.length > 3 ? " ..." : ""}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Resumen</p>
                      <div className="mt-2 grid gap-1 text-xs text-on-surface-variant">
                        <p>Versión: <span className="font-semibold text-on-surface">v{run.narrativeVersion.versionNumber}</span></p>
                        <p>Estado: <span className="font-semibold text-on-surface">{run.status}</span></p>
                        <p>Eventos: <span className="font-semibold text-on-surface">{run.events?.length ?? 0}</span></p>
                      </div>
                    </div>
                  </div>

                  {showActivityDock ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Actividad reciente</p>
                        <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-2">
                          {eventLog.length > 0 ? eventLog.map((event) => (
                            <div key={event.id} className="rounded-xl border border-outline-variant bg-surface-container px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-on-surface">{event.eventType}</p>
                                <span className="text-[11px] text-on-surface-variant">{formatDateTime(event.createdAt)}</span>
                              </div>
                              <p className="mt-1 text-xs text-on-surface-variant">Nodo {event.nodeId}</p>
                            </div>
                          )) : (
                            <p className="text-sm text-on-surface-variant">Todavía no hay eventos en esta ejecución.</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Ruta visible</p>
                        <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-2">
                          {orderedNodes.map((node) => {
                            const status = nodeStates.get(node.id) ?? "locked";
                            return (
                              <div key={node.id} className={`rounded-xl border px-3 py-2 text-xs ${statusTone(status)}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-on-surface">{nodeLabel(node)}</span>
                                  <span className="uppercase tracking-[0.18em]">{node.type}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
        </div>
        {isDualView ? (
          <aside className="min-w-0 w-full lg:sticky lg:top-4 lg:self-start">
            <NarrativeAudioLibraryPanel />
          </aside>
        ) : null}
      </div>
    </ReactFlowProvider>
    </NarrativePlayerContext.Provider>
  );
}
