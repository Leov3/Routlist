"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import {
  AlertCircle,
  CheckCircle2,
  CopyPlus,
  FileDown,
  Plus,
  Save,
  TriangleAlert,
  WandSparkles,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type {
  BuilderNodeBadge,
  DecisionOption,
  NarrativeBuilderState,
  NarrativeGraphJson,
  NarrativeBuilderNodeData,
  NarrativeNodeType,
  NarrativeVersion,
} from "@/types/narratives";

type BuilderProps = {
  narrativeId: string;
};

type AudioAssetOption = {
  id: string;
  originalName: string;
};

type AudioButtonOption = {
  id: string;
  label: string;
  category?: {
    name: string;
  };
};

type ElevenLabsVoiceOption = {
  voiceId: string;
  name: string;
  category?: string | null;
  labels?: Record<string, string> | null;
  previewUrl?: string | null;
};

type ElevenLabsModelOption = {
  modelId: string;
  name: string;
  description?: string | null;
  languages?: string[] | null;
};

type ApiCollection<T> = T[] | { data?: T[]; items?: T[] };

type FlowNodeData = NarrativeBuilderNodeData;

type NodePaletteItem = {
  type: NarrativeNodeType;
  label: string;
  description: string;
  accent: string;
};

const NODE_PALETTE: NodePaletteItem[] = [
  { type: "START", label: "Inicio", description: "Punto de arranque único.", accent: "from-emerald-500 to-teal-500" },
  { type: "AUDIO", label: "Audio", description: "Reproduce un audio existente.", accent: "from-violet-500 to-fuchsia-500" },
  { type: "AUDIO_BUTTON", label: "Botón de Audio", description: "Reproduce audio asociado a un botón.", accent: "from-indigo-500 to-blue-500" },
  { type: "DYNAMIC_AUDIO", label: "Audio dinámico IA", description: "Texto con variables para TTS.", accent: "from-fuchsia-500 to-purple-500" },
  { type: "SCRIPT_TEXT", label: "Texto / Guion", description: "Texto para leer al aire.", accent: "from-sky-500 to-cyan-500" },
  { type: "PAUSE", label: "Pausa", description: "Esperar o pausar manualmente.", accent: "from-slate-500 to-slate-700" },
  { type: "DECISION", label: "Decisión", description: "Ramificación con opciones.", accent: "from-pink-500 to-rose-500" },
  { type: "END", label: "Fin", description: "Cierre del flujo.", accent: "from-red-500 to-rose-500" },
];

const ANNOTATION_PALETTE: NodePaletteItem[] = [
  { type: "INSTRUCTION", label: "Nota operativa", description: "Anotación: no cuenta como paso ni bloquea el flujo.", accent: "from-amber-400 to-yellow-600" },
];

const ELEVENLABS_OUTPUT_FORMAT_OPTIONS = [
  "mp3_44100_128",
  "mp3_44100_64",
  "mp3_22050_32",
  "wav_44100",
  "wav_22050",
  "pcm_44100",
  "pcm_16000",
  "ulaw_8000",
];

function isAnnotationNodeType(type: NarrativeNodeType) {
  return type === "INSTRUCTION";
}

function isFlowNodeType(type: NarrativeNodeType) {
  return !isAnnotationNodeType(type);
}

function normalizeDynamicAudioTemplate(template: string) {
  return template
    .replace(/<\s*([A-Za-z][A-Za-z0-9_-]*)\s*>/g, "{{$1}}")
    .replace(/{{\s*([A-Za-z][A-Za-z0-9_-]*)\s*}}/g, "{{$1}}");
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

function buildDynamicAudioPreview(template: string, variables: string[]) {
  const sampleValues = [
    "Carlos",
    "María",
    "Bogotá",
    "ciento veinticuatro",
    "tu nombre",
    "tu ciudad",
  ];
  const replacements = new Map(
    variables.map((variable, index) => [variable, sampleValues[index % sampleValues.length]]),
  );

  return normalizeDynamicAudioTemplate(template).replace(
    /{{\s*([A-Za-z][A-Za-z0-9_-]*)\s*}}/g,
    (_match, variable: string) => replacements.get(variable) ?? variable,
  );
}

function isInvalidDynamicAudioTemplate(template: string) {
  const stripped = template.replace(/{{\s*[A-Za-z][A-Za-z0-9_-]*\s*}}/g, "");
  return stripped.includes("{") || stripped.includes("}") || /<\s*[^<>]+\s*>/.test(template);
}

function getNodeType(node?: Pick<Node<FlowNodeData>, "type" | "data"> | null) {
  return (node?.data?.nodeType ?? node?.type) as NarrativeNodeType | undefined;
}

function isAnnotationNode(node?: Pick<Node<FlowNodeData>, "type" | "data"> | null) {
  const type = getNodeType(node);
  return type ? isAnnotationNodeType(type) : false;
}

function isAnnotationEdge(edge: Pick<Edge, "source" | "target">, nodeById: Map<string, Node<FlowNodeData>>) {
  return isAnnotationNode(nodeById.get(edge.source)) || isAnnotationNode(nodeById.get(edge.target));
}

function getExecutionEdges(nodes: Node<FlowNodeData>[], edges: Edge[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const directFlowEdges = edges.filter((edge) => !isAnnotationEdge(edge, nodeById));
  const virtualBypassEdges = nodes
    .filter((node) => isAnnotationNode(node))
    .flatMap((node) => {
      const incoming = edges.filter((edge) => {
        const sourceType = getNodeType(nodeById.get(edge.source));
        return edge.target === node.id && Boolean(sourceType && isFlowNodeType(sourceType));
      });
      const outgoing = edges.filter((edge) => {
        const targetType = getNodeType(nodeById.get(edge.target));
        return edge.source === node.id && Boolean(targetType && isFlowNodeType(targetType));
      });
      return incoming.flatMap((input) =>
        outgoing.map((output) => ({
          id: `annotation-bypass:${input.id}:${output.id}`,
          source: input.source,
          target: output.target,
          label: input.label,
        } as Edge)),
      );
    });
  return [...directFlowEdges, ...virtualBypassEdges];
}

const DEFAULT_NODE_DATA: Record<NarrativeNodeType, Record<string, unknown>> = {
  START: { label: "Inicio" },
  AUDIO: {
    title: "Cortina de audio",
    label: "Audio",
    audioAssetId: "",
    description: "",
    required: true,
    allowReplay: true,
    operatorNotes: "",
  },
  AUDIO_BUTTON: {
    title: "Botón de audio",
    label: "Botón",
    audioButtonId: "",
    operatorNotes: "",
    required: true,
  },
  DYNAMIC_AUDIO: {
    title: "Audio dinámico IA",
    label: "Audio dinámico IA",
    template: "Bienvenido, {{nombre}}. Respira profundo y permite que este momento te reciba con calma.",
    variables: ["nombre"],
    voiceId: "",
    modelId: "eleven_flash_v2_5",
    outputFormat: "mp3_44100_128",
    stability: 0.6,
    similarityBoost: 0.75,
    style: 0.2,
    speed: 1,
    speakerBoost: true,
    description: "",
    required: true,
    allowReplay: true,
    operatorNotes: "",
  },
  SCRIPT_TEXT: {
    title: "Guion",
    body: "Escribe aquí el texto para leer.",
    notes: "",
    required: true,
  },
  INSTRUCTION: {
    title: "Instrucción operativa",
    instruction: "Indicación para el operador.",
    notes: "",
  },
  PAUSE: {
    title: "Pausa",
    pauseType: "manual",
    durationSeconds: "",
    manual: true,
  },
  DECISION: {
    title: "Decisión",
    question: "¿Qué sigue?",
    options: [
      { id: "decision-option-yes", label: "Sí", description: "" },
      { id: "decision-option-no", label: "No", description: "" },
    ],
    operatorNotes: "",
  },
  END: { label: "Fin" },
};

function graphFromVersions(version?: NarrativeVersion | null): NarrativeGraphJson {
  const graph = version?.graphJson;
  if (graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges)) {
    return graph;
  }

  return { nodes: [], edges: [] };
}

function makeNodeId(type: NarrativeNodeType) {
  return `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeDecisionOptionId() {
  return `decision-option-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

import dagre from "dagre";

type BuilderBadge = BuilderNodeBadge;

type BuilderIssueLevel = "error" | "warning" | "suggestion";

type BuilderValidationIssue = {
  id: string;
  level: BuilderIssueLevel;
  message: string;
  nodeId?: string;
  nodeLabel?: string;
  issueType: string;
  source: "local" | "backend";
};

function autoLayout(nodes: Node<FlowNodeData>[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 100, nodesep: 50 });
  g.setDefaultEdgeLabel(() => ({}));

  const flowNodes = nodes.filter((node) => !isAnnotationNode(node));
  const annotationNodes = nodes.filter((node) => isAnnotationNode(node));
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const flowEdges = getExecutionEdges(nodes, edges);

  flowNodes.forEach((node) => {
    g.setNode(node.id, { width: 240, height: 100 });
  });
  flowEdges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const positionedFlowNodes = flowNodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - 120,
        y: pos.y - 50,
      },
    };
  });
  const positionedById = new Map(positionedFlowNodes.map((node) => [node.id, node] as const));
  const positionedAnnotations = annotationNodes.map((node, index) => {
    const connectedFlowEdge = edges.find((edge) => {
      if (edge.source === node.id) return !isAnnotationNode(nodeById.get(edge.target));
      if (edge.target === node.id) return !isAnnotationNode(nodeById.get(edge.source));
      return false;
    });
    const anchorId = connectedFlowEdge?.source === node.id ? connectedFlowEdge.target : connectedFlowEdge?.source;
    const anchor = anchorId ? positionedById.get(anchorId) : null;
    return {
      ...node,
      position: anchor
        ? { x: anchor.position.x + 320, y: anchor.position.y + 24 }
        : { x: 420, y: 120 + index * 190 },
    };
  });

  return [...positionedFlowNodes, ...positionedAnnotations];
}

function nodeSummary(node: Node<FlowNodeData>) {
  const nodeType = (node.data?.nodeType ?? node.type) as NarrativeNodeType;
  const data = node.data ?? { nodeType };
  if (nodeType === "AUDIO") return data.audioAssetId ? `Audio: ${String(data.audioAssetId)}` : "Audio sin asignar";
  if (nodeType === "AUDIO_BUTTON") return data.audioButtonId ? `Botón: ${String(data.audioButtonId)}` : "Botón sin asignar";
  if (nodeType === "DYNAMIC_AUDIO") {
    const template = String(data.template ?? "").trim();
    const variables = extractDynamicAudioVariables(template);
    return template
      ? `${template.slice(0, 80)}${template.length > 80 ? "…" : ""}${variables.length ? ` · ${variables.length} variable(s)` : ""}`
      : "Audio dinámico sin plantilla";
  }
  if (nodeType === "SCRIPT_TEXT") return data.body ? String(data.body).slice(0, 80) : "Sin texto";
  if (nodeType === "INSTRUCTION") return data.instruction ? String(data.instruction).slice(0, 80) : "Sin instrucción";
  if (nodeType === "PAUSE") return getPauseMode(data) === "timer" ? `Temporizada${data.durationSeconds ? ` · ${data.durationSeconds}s` : ""}` : "Pausa manual";
  if (nodeType === "DECISION") return data.question ? String(data.question) : "Sin pregunta";
  return NODE_PALETTE.find((item) => item.type === nodeType)?.description || "";
}

function badgeClassName(tone: BuilderBadge["tone"]) {
  switch (tone) {
    case "valid":
      return "border-emerald-300 bg-emerald-500/12 text-emerald-700 dark:border-emerald-900/40 dark:text-emerald-300";
    case "warning":
      return "border-amber-300 bg-amber-500/12 text-amber-700 dark:border-amber-900/40 dark:text-amber-300";
    case "error":
      return "border-red-300 bg-red-500/12 text-red-700 dark:border-red-900/40 dark:text-red-300";
    default:
      return "border-slate-300 bg-slate-500/12 text-slate-700 dark:border-slate-700/40 dark:text-slate-300";
  }
}

function statusDotClassName(status: FlowNodeData["builderStatus"]) {
  switch (status) {
    case "valid":
      return "bg-emerald-500";
    case "warning":
      return "bg-amber-500";
    case "error":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
}

function normalizeDecisionOptions(value: unknown): DecisionOption[] {
  if (Array.isArray(value)) {
    const normalized: Array<DecisionOption | null> = value
      .map((item, index) => {
        if (typeof item === "string") {
          const label = item.trim();
          return {
            id: `legacy-option-${index}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "item"}`,
            label,
            description: "",
          };
        }
        if (item && typeof item === "object" && "label" in item) {
          const option = item as { id?: unknown; label?: unknown; description?: unknown };
          const label = typeof option.label === "string" ? option.label.trim() : "";
          return {
            id:
              typeof option.id === "string" && option.id.trim()
                ? option.id
                : `legacy-option-${index}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "item"}`,
            label,
            description: typeof option.description === "string" ? option.description : "",
          };
        }
        return null;
      });

    return normalized.filter((option): option is DecisionOption => option !== null);
  }

  if (typeof value !== "string") return [];

  return value
    .split("|")
    .map((option) => option.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id: `legacy-option-${index}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "item"}`,
      label,
      description: "",
    }));
}

function normalizeBuilderNodeData(
  nodeType: NarrativeNodeType,
  data: Record<string, unknown> | undefined,
): FlowNodeData {
  const baseData = {
    nodeType,
    ...(data ?? {}),
  } as FlowNodeData;

  if (nodeType === "DYNAMIC_AUDIO") {
    const template = normalizeDynamicAudioTemplate(String(baseData.template ?? ""));
    const variables = extractDynamicAudioVariables(template);
    return {
      ...baseData,
      template,
      variables,
    };
  }

  if (nodeType === "DECISION") {
    return {
      ...baseData,
      options: normalizeDecisionOptions(baseData.options),
    };
  }

  return baseData;
}

function serializeNodeData(nodeType: NarrativeNodeType, data: FlowNodeData) {
  const persistedData = { ...data };
  delete persistedData.builderSummary;
  delete persistedData.builderStatus;
  delete persistedData.builderStatusLabel;
  delete persistedData.builderBadges;

  if (nodeType === "DYNAMIC_AUDIO") {
    const template = normalizeDynamicAudioTemplate(String(persistedData.template ?? ""));
    const variables = extractDynamicAudioVariables(template);
    return {
      ...persistedData,
      template,
      variables,
    };
  }

  if (nodeType === "DECISION") {
    return {
      ...persistedData,
      options: normalizeDecisionOptions(persistedData.options),
    };
  }

  return { ...persistedData };
}

function findDecisionOutgoingEdges(nodeId: string, edges: Edge[]) {
  return edges.filter((edge) => edge.source === nodeId);
}

function normalizeDecisionEdgeLabel(label: string | null | undefined) {
  return String(label ?? "").trim().toLowerCase();
}

function decisionRouteCoverage(options: DecisionOption[], edges: Edge[]) {
  const optionLabels = new Map(
    options
      .filter((option) => option.label.trim())
      .map((option) => [normalizeDecisionEdgeLabel(option.label), option]),
  );
  const matchedOptionIds = new Set<string>();
  const unmatchedEdges: Edge[] = [];

  for (const edge of edges) {
    const key = normalizeDecisionEdgeLabel(edge.label as string | undefined);
    const option = optionLabels.get(key);
    if (option) {
      matchedOptionIds.add(option.id);
    } else {
      unmatchedEdges.push(edge);
    }
  }

  return {
    matchedOptionIds,
    unmatchedEdges,
    missingOptions: options.filter((option) => !matchedOptionIds.has(option.id)),
  };
}

function normalizeGraph(graph: NarrativeGraphJson) {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position ?? { x: 0, y: 0 },
      data: serializeNodeData(
        node.type,
        normalizeBuilderNodeData(node.type, node.data as Record<string, unknown> | undefined),
      ),
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label ?? null,
    })),
  };
}

function graphSignature(graph: NarrativeGraphJson) {
  return JSON.stringify(normalizeGraph(graph));
}

function toCollectionItems<T>(value: ApiCollection<T>) {
  if (Array.isArray(value)) return value;
  return value.data ?? value.items ?? [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toVoiceItems(value: unknown) {
  if (Array.isArray(value)) return value as ElevenLabsVoiceOption[];
  if (isRecord(value) && Array.isArray(value.voices)) {
    return value.voices as ElevenLabsVoiceOption[];
  }
  if (isRecord(value) && Array.isArray(value.data)) {
    return value.data as ElevenLabsVoiceOption[];
  }
  if (isRecord(value) && Array.isArray(value.items)) {
    return value.items as ElevenLabsVoiceOption[];
  }
  return [];
}

function toModelItems(value: unknown) {
  if (Array.isArray(value)) return value as ElevenLabsModelOption[];
  if (isRecord(value) && Array.isArray(value.models)) {
    return value.models as ElevenLabsModelOption[];
  }
  if (isRecord(value) && Array.isArray(value.data)) {
    return value.data as ElevenLabsModelOption[];
  }
  if (isRecord(value) && Array.isArray(value.items)) {
    return value.items as ElevenLabsModelOption[];
  }
  return [];
}

function nodeClassName(nodeType: NarrativeNodeType) {
  switch (nodeType) {
    case "START":
      return "border-emerald-300 bg-emerald-500/15 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-500/15 dark:text-emerald-100";
    case "AUDIO":
      return "border-violet-300 bg-violet-500/15 text-violet-950 dark:border-violet-900/60 dark:bg-violet-500/15 dark:text-violet-100";
    case "AUDIO_BUTTON":
      return "border-indigo-300 bg-indigo-500/15 text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-500/15 dark:text-indigo-100";
    case "DYNAMIC_AUDIO":
      return "border-fuchsia-300 bg-fuchsia-500/15 text-fuchsia-950 dark:border-fuchsia-900/60 dark:bg-fuchsia-500/15 dark:text-fuchsia-100";
    case "SCRIPT_TEXT":
      return "border-sky-300 bg-sky-500/15 text-sky-950 dark:border-sky-900/60 dark:bg-sky-500/15 dark:text-sky-100";
    case "INSTRUCTION":
      return "border-amber-300 bg-amber-500/15 text-amber-950 dark:border-amber-900/60 dark:bg-amber-500/15 dark:text-amber-100";
    case "PAUSE":
      return "border-slate-300 bg-slate-500/15 text-slate-950 dark:border-slate-700/60 dark:bg-slate-500/15 dark:text-slate-100";
    case "DECISION":
      return "border-pink-300 bg-pink-500/15 text-pink-950 dark:border-pink-900/60 dark:bg-pink-500/15 dark:text-pink-100";
    case "END":
      return "border-red-300 bg-red-500/15 text-red-950 dark:border-red-900/60 dark:bg-red-500/15 dark:text-red-100";
    default:
      return "border-outline-variant bg-surface text-on-surface";
  }
}

function NarrativeFlowNode({ data, selected, type }: NodeProps) {
  const flowData = (data ?? {}) as FlowNodeData;
  const nodeType = (flowData.nodeType ?? (type as NarrativeNodeType)) as NarrativeNodeType;
  const title =
    flowData.title ||
    flowData.label ||
    NODE_PALETTE.find((item) => item.type === nodeType)?.label ||
    nodeType;
  const summary =
    flowData.builderSummary ?? nodeSummary({ data: flowData, type: nodeType } as Node<FlowNodeData>);
  const badges = flowData.builderBadges ?? [];

  if (nodeType === "INSTRUCTION") {
    return (
      <div
        className={`relative min-w-[260px] max-w-[320px] rotate-[-0.6deg] rounded-bl-[34px] rounded-br-xl rounded-tl-xl rounded-tr-[34px] border-2 border-amber-300/35 bg-gradient-to-br from-amber-300/25 via-[#2a1d0d] to-[#15100a] px-4 py-4 text-amber-50 shadow-elevation-2 ${
          selected ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-surface" : ""
        }`}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !border-surface !bg-amber-300"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-3 !w-3 !border-2 !border-surface !bg-amber-300"
        />
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-amber-300/20 text-xs font-black uppercase tracking-[0.2em] text-amber-200">
            NT
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-200">Instrucción</p>
              <span className="rounded-full border border-amber-200/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-100">
                Nota
              </span>
              <span className={`h-2 w-2 rounded-full ${statusDotClassName(flowData.builderStatus)}`} />
            </div>
            <p className="mt-2 line-clamp-4 text-sm font-semibold leading-relaxed text-amber-50">{summary}</p>
            <p className="mt-3 text-[11px] font-semibold text-amber-100/70">No cuenta como paso ni bloquea publicación.</p>
          </div>
        </div>
        <span className="absolute bottom-3 right-3 h-7 w-7 rounded-br-lg border-b-2 border-r-2 border-amber-200/35" />
      </div>
    );
  }

  return (
    <div
      className={`min-w-[240px] rounded-3xl border px-4 py-3 shadow-elevation-1 ${nodeClassName(nodeType)} ${
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : ""
      }`}
    >
      {nodeType !== "START" && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !border-surface !bg-primary"
        />
      )}

      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-black/10 text-xs font-black uppercase tracking-[0.2em]">
          {nodeType.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-75">{nodeType}</p>
            <span className={`h-2 w-2 rounded-full ${statusDotClassName(flowData.builderStatus)}`} />
          </div>
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="mt-1 line-clamp-2 text-xs opacity-80">{summary}</p>
          {badges.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {badges.slice(0, 3).map((badge) => (
                <span
                  key={`${badge.tone}-${badge.label}`}
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClassName(badge.tone)}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {nodeType !== "END" && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-3 !w-3 !border-2 !border-surface !bg-primary"
        />
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">{children}</span>;
}

function BooleanPill({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        value
          ? "border-emerald-300 bg-emerald-500/15 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-300"
          : "border-outline-variant bg-surface text-on-surface-variant"
      }`}
    >
      {value ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function ModalSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-outline-variant bg-surface px-4 py-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function updateNodeData(node: Node<FlowNodeData>, patch: Record<string, unknown>) {
  return {
    ...node,
    data: {
      ...(node.data ?? { nodeType: node.type as NarrativeNodeType }),
      ...patch,
    },
  };
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
}

function arrayMove<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function getNodeDisplayName(node: Node<FlowNodeData>) {
  return String(
    node.data?.title ??
      node.data?.label ??
      NODE_PALETTE.find((item) => item.type === (node.data?.nodeType ?? node.type))?.label ??
      node.id,
  );
}

function issueTone(level: BuilderIssueLevel) {
  if (level === "error") return "error";
  if (level === "warning") return "warning";
  return "info";
}

function getPauseMode(data: Pick<FlowNodeData, "pauseType" | "manual">) {
  return data.pauseType === "manual" || data.manual !== false ? "manual" : "timer";
}

function issueIcon(level: BuilderIssueLevel) {
  if (level === "error") return AlertCircle;
  if (level === "warning") return TriangleAlert;
  return CheckCircle2;
}

function inferBackendIssue(
  error: string,
  nodeLookup: Map<string, Node<FlowNodeData>>,
): BuilderValidationIssue {
  const unreachableMatch = error.match(/Narrative contains unreachable nodes:\s*(.+)$/);
  if (unreachableMatch) {
    const firstNodeId = unreachableMatch[1].split(",")[0]?.trim();
    const node = firstNodeId ? nodeLookup.get(firstNodeId) : undefined;
    return {
      id: `backend-unreachable-${firstNodeId ?? error}`,
      level: "error",
      message: node
        ? `El nodo "${getNodeDisplayName(node)}" quedó fuera del recorrido desde START.`
        : error,
      nodeId: node?.id,
      nodeLabel: node ? getNodeDisplayName(node) : undefined,
      issueType: "reachability",
      source: "backend",
    };
  }

  const decisionMatch = error.match(/DECISION node ([\w-]+) requires labeled outgoing edges/);
  if (decisionMatch) {
    const node = nodeLookup.get(decisionMatch[1]);
    return {
      id: `backend-decision-label-${decisionMatch[1]}`,
      level: "error",
      message: node
        ? `La decisión "${getNodeDisplayName(node)}" tiene salidas sin etiqueta.`
        : error,
      nodeId: node?.id,
      nodeLabel: node ? getNodeDisplayName(node) : undefined,
      issueType: "decision-label",
      source: "backend",
    };
  }

  const nodeIdMatch =
    error.match(/node ([\w-]+)/i) ??
    error.match(/source node ([\w-]+)/i) ??
    error.match(/target node ([\w-]+)/i);
  const node = nodeIdMatch ? nodeLookup.get(nodeIdMatch[1]) : undefined;

  return {
    id: `backend-${error}`,
    level: "error",
    message: node ? `${error} (${getNodeDisplayName(node)})` : error,
    nodeId: node?.id,
    nodeLabel: node ? getNodeDisplayName(node) : undefined,
    issueType: "backend-validation",
    source: "backend",
  };
}

export function NarrativeBuilderCanvas({ narrativeId }: BuilderProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [builder, setBuilder] = useState<NarrativeBuilderState | null>(null);
  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isValidationPanelOpen, setIsValidationPanelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] }>({
    valid: true,
    errors: [],
  });
  const [audios, setAudios] = useState<{ id: string; name: string }[]>([]);
  const [buttons, setButtons] = useState<{ id: string; label: string; category?: { name: string } }[]>([]);
  const [voices, setVoices] = useState<ElevenLabsVoiceOption[]>([]);
  const [models, setModels] = useState<ElevenLabsModelOption[]>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const audioMap = useMemo(
    () => new Map(audios.map((audio) => [audio.id, audio])),
    [audios],
  );

  const buttonMap = useMemo(
    () => new Map(buttons.map((button) => [button.id, button])),
    [buttons],
  );

  const editingNode = useMemo(
    () => nodes.find((node) => node.id === editingNodeId) ?? null,
    [nodes, editingNodeId],
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const selectedNodes = useMemo(
    () => nodes.filter((node) => selectedNodeIds.includes(node.id)),
    [nodes, selectedNodeIds],
  );
  const selectedEdges = useMemo(
    () => edges.filter((edge) => selectedEdgeIds.includes(edge.id)),
    [edges, selectedEdgeIds],
  );
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );
  const nodeLookup = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const selectedEdgeDetails = useMemo(() => {
    if (!selectedEdge) return null;

    const sourceNode = nodeLookup.get(selectedEdge.source);
    const targetNode = nodeLookup.get(selectedEdge.target);

    return {
      label: String(selectedEdge.label ?? "").trim() || "Conexión sin etiqueta",
      sourceLabel: sourceNode ? getNodeDisplayName(sourceNode) : selectedEdge.source,
      targetLabel: targetNode ? getNodeDisplayName(targetNode) : selectedEdge.target,
    };
  }, [nodeLookup, selectedEdge]);
  const filteredNodes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];
    return nodes.filter((node) => {
      const text = [
        getNodeDisplayName(node),
        String(node.data?.nodeType ?? node.type),
        String(node.data?.body ?? ""),
        String(node.data?.instruction ?? ""),
        String(node.data?.question ?? ""),
        String(node.data?.audioAssetId ?? ""),
        String(node.data?.audioButtonId ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(query);
    });
  }, [nodes, searchTerm]);

  const selectedVersion = builder?.draftVersion ?? builder?.publishedVersion ?? null;
  const currentGraph = useMemo<NarrativeGraphJson>(
    () => ({
      nodes: nodes.map((node) => ({
        id: node.id,
        type: (node.data?.nodeType ?? node.type) as NarrativeNodeType,
        position: node.position,
        data: serializeNodeData(
          (node.data?.nodeType ?? node.type) as NarrativeNodeType,
          (node.data ?? {}) as FlowNodeData,
        ),
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: typeof edge.label === "string" ? edge.label : null,
      })),
    }),
    [edges, nodes],
  );
  const loadedDraftGraph = useMemo(
    () => graphFromVersions(builder?.draftVersion ?? builder?.publishedVersion),
    [builder?.draftVersion, builder?.publishedVersion],
  );
  const publishedGraph = useMemo(
    () => graphFromVersions(builder?.publishedVersion),
    [builder?.publishedVersion],
  );
  const hasUnsavedChanges = useMemo(
    () => graphSignature(currentGraph) !== graphSignature(loadedDraftGraph),
    [currentGraph, loadedDraftGraph],
  );
  const hasUnpublishedChanges = useMemo(() => {
    if (!builder?.publishedVersion) {
      return currentGraph.nodes.length > 0 || currentGraph.edges.length > 0;
    }

    return graphSignature(currentGraph) !== graphSignature(publishedGraph);
  }, [builder?.publishedVersion, currentGraph, publishedGraph]);
  const versionLabel = selectedVersion ? `v${selectedVersion.versionNumber}` : "Sin versión";

  const graphMetrics = useMemo(() => {
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();

    for (const node of nodes) {
      incoming.set(node.id, 0);
      outgoing.set(node.id, 0);
    }

    for (const edge of edges) {
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
      outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    }

    return { incoming, outgoing };
  }, [edges, nodes]);

  const executionEdges = useMemo(() => getExecutionEdges(nodes, edges), [edges, nodes]);

  const executionGraphMetrics = useMemo(() => {
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();

    for (const node of nodes) {
      incoming.set(node.id, 0);
      outgoing.set(node.id, 0);
    }

    for (const edge of executionEdges) {
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
      outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    }

    return { incoming, outgoing };
  }, [executionEdges, nodes]);

  const localValidationIssues = useMemo<BuilderValidationIssue[]>(() => {
    const issues: BuilderValidationIssue[] = [];
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const startNodes = nodes.filter((node) => (node.data?.nodeType ?? node.type) === "START");
    const endNodes = nodes.filter((node) => (node.data?.nodeType ?? node.type) === "END");

    if (startNodes.length !== 1) {
      issues.push({
        id: "graph-start-count",
        level: "error",
        message: "La narrativa debe tener exactamente un nodo START.",
        issueType: "start-count",
        source: "local",
      });
    }

    if (endNodes.length < 1) {
      issues.push({
        id: "graph-end-count",
        level: "error",
        message: "La narrativa debe tener al menos un nodo END.",
        issueType: "end-count",
        source: "local",
      });
    }

    for (const node of nodes) {
      const nodeType = (node.data?.nodeType ?? node.type) as NarrativeNodeType;
      const nodeLabel = getNodeDisplayName(node);
      const incomingCount = isAnnotationNodeType(nodeType)
        ? graphMetrics.incoming.get(node.id) ?? 0
        : executionGraphMetrics.incoming.get(node.id) ?? 0;
      const outgoingCount = isAnnotationNodeType(nodeType)
        ? graphMetrics.outgoing.get(node.id) ?? 0
        : executionGraphMetrics.outgoing.get(node.id) ?? 0;

      if (nodeType === "START") {
        if (incomingCount > 0) {
          issues.push({
            id: `start-incoming-${node.id}`,
            level: "error",
            message: `El nodo "${nodeLabel}" no puede recibir entradas.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "start-incoming",
            source: "local",
          });
        }

        if (outgoingCount < 1) {
          issues.push({
            id: `start-outgoing-${node.id}`,
            level: "error",
            message: `El nodo "${nodeLabel}" debe tener al menos una salida.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "start-outgoing",
            source: "local",
          });
        }
      }

      if (nodeType === "END") {
        if (outgoingCount > 0) {
          issues.push({
            id: `end-outgoing-${node.id}`,
            level: "error",
            message: `El nodo "${nodeLabel}" no puede tener salidas.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "end-outgoing",
            source: "local",
          });
        }

        if (nodeLabel.length < 4) {
          issues.push({
            id: `end-label-${node.id}`,
            level: "suggestion",
            message: `Conviene dar un nombre más descriptivo al cierre "${nodeLabel}".`,
            nodeId: node.id,
            nodeLabel,
            issueType: "end-label",
            source: "local",
          });
        }
      }

      if (nodeType === "AUDIO") {
        const assetId = String(node.data?.audioAssetId ?? "").trim();
        if (!assetId) {
          issues.push({
            id: `audio-missing-${node.id}`,
            level: "error",
            message: `El nodo "${nodeLabel}" no tiene audio seleccionado.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "audio-required",
            source: "local",
          });
        } else if (!audioMap.has(assetId)) {
          issues.push({
            id: `audio-resource-${node.id}`,
            level: "warning",
            message: `El audio del nodo "${nodeLabel}" no está cargado en el builder.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "audio-resource",
            source: "local",
          });
        }
      }

      if (nodeType === "AUDIO_BUTTON") {
        const buttonId = String(node.data?.audioButtonId ?? "").trim();
        if (!buttonId) {
          issues.push({
            id: `audio-button-missing-${node.id}`,
            level: "error",
            message: `El nodo "${nodeLabel}" no tiene botón seleccionado.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "audio-button-required",
            source: "local",
          });
        } else if (!buttonMap.has(buttonId)) {
          issues.push({
            id: `audio-button-resource-${node.id}`,
            level: "warning",
            message: `El botón del nodo "${nodeLabel}" no está cargado en el builder.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "audio-button-resource",
            source: "local",
          });
        }
      }

      if (nodeType === "DYNAMIC_AUDIO") {
        const template = normalizeDynamicAudioTemplate(String(node.data?.template ?? "")).trim();
        const variables = extractDynamicAudioVariables(template);
        const voiceId = String(node.data?.voiceId ?? "").trim();
        const modelId = String(node.data?.modelId ?? "").trim();

        if (!template) {
          issues.push({
            id: `dynamic-audio-empty-${node.id}`,
            level: "error",
            message: `El nodo "${nodeLabel}" no tiene plantilla de texto.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "dynamic-audio-template",
            source: "local",
          });
        }

        if (isInvalidDynamicAudioTemplate(String(node.data?.template ?? ""))) {
          issues.push({
            id: `dynamic-audio-invalid-${node.id}`,
            level: "error",
            message: `El nodo "${nodeLabel}" usa variables mal formadas. Usa {{variable}}.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "dynamic-audio-placeholder",
            source: "local",
          });
        }

        if (variables.length === 0 && template) {
          issues.push({
            id: `dynamic-audio-variables-${node.id}`,
            level: "error",
            message: `El nodo "${nodeLabel}" necesita al menos una variable con el formato {{variable}}.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "dynamic-audio-variables",
            source: "local",
          });
        }

        if (!voiceId) {
          issues.push({
            id: `dynamic-audio-voice-${node.id}`,
            level: "warning",
            message: `El nodo "${nodeLabel}" no tiene voz de ElevenLabs seleccionada.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "dynamic-audio-voice",
            source: "local",
          });
        }

        if (!modelId) {
          issues.push({
            id: `dynamic-audio-model-${node.id}`,
            level: "warning",
            message: `El nodo "${nodeLabel}" no tiene modelo de ElevenLabs seleccionado.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "dynamic-audio-model",
            source: "local",
          });
        }
      }

      if (nodeType === "SCRIPT_TEXT") {
        const body = String(node.data?.body ?? "").trim();
        if (!body) {
          issues.push({
            id: `script-empty-${node.id}`,
            level: "error",
            message: `El guion "${nodeLabel}" está vacío.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "script-body",
            source: "local",
          });
        } else if (body.length > 1000) {
          issues.push({
            id: `script-long-${node.id}`,
            level: "warning",
            message: `El guion "${nodeLabel}" supera los 1.000 caracteres.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "script-length",
            source: "local",
          });
        }
      }

      if (nodeType === "INSTRUCTION") {
        const instruction = String(node.data?.instruction ?? "").trim();
        if (!instruction) {
          issues.push({
            id: `instruction-empty-${node.id}`,
            level: "warning",
            message: `La instrucción "${nodeLabel}" está vacía.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "instruction-body",
            source: "local",
          });
        }
        if ((graphMetrics.incoming.get(node.id) ?? 0) > 0 && (graphMetrics.outgoing.get(node.id) ?? 0) > 0) {
          issues.push({
            id: `instruction-bypass-${node.id}`,
            level: "warning",
            message: `La instrucción "${nodeLabel}" se tratará como nota; la ejecución hará bypass de esta anotación.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "instruction-bypass",
            source: "local",
          });
        }
      }

      if (nodeType === "PAUSE") {
        const isManual = getPauseMode(node.data ?? { nodeType }) === "manual";
        const duration = Number(node.data?.durationSeconds ?? 0);
        if (!isManual && (!Number.isFinite(duration) || duration <= 0)) {
          issues.push({
            id: `pause-duration-${node.id}`,
            level: "error",
            message: `La pausa "${nodeLabel}" necesita una duración válida.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "pause-duration",
            source: "local",
          });
        } else if (!isManual && duration > 300) {
          issues.push({
            id: `pause-long-${node.id}`,
            level: "warning",
            message: `La pausa "${nodeLabel}" dura más de 5 minutos.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "pause-long",
            source: "local",
          });
        }
      }

      if (nodeType === "DECISION") {
        const question = String(node.data?.question ?? "").trim();
        const options = normalizeDecisionOptions(node.data?.options);
        const outgoingEdges = findDecisionOutgoingEdges(node.id, executionEdges);
        const labels = options.map((option) => option.label.toLowerCase());
        const emptyLabels = options.filter((option) => !option.label.trim());
        const routeCoverage = decisionRouteCoverage(options, outgoingEdges);

        if (!question) {
          issues.push({
            id: `decision-question-${node.id}`,
            level: "error",
            message: `La decisión "${nodeLabel}" no tiene pregunta.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "decision-question",
            source: "local",
          });
        }

        if (options.length < 2) {
          issues.push({
            id: `decision-options-${node.id}`,
            level: "error",
            message: `La decisión "${nodeLabel}" necesita al menos dos opciones.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "decision-options",
            source: "local",
          });
        }

        if (new Set(labels).size !== labels.length) {
          issues.push({
            id: `decision-duplicates-${node.id}`,
            level: "error",
            message: `La decisión "${nodeLabel}" tiene etiquetas de opción duplicadas.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "decision-duplicates",
            source: "local",
          });
        }

        if (emptyLabels.length > 0) {
          issues.push({
            id: `decision-empty-label-${node.id}`,
            level: "error",
            message: `La decisión "${nodeLabel}" tiene opciones sin etiqueta.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "decision-empty-label",
            source: "local",
          });
        }

        if (outgoingEdges.length < 2) {
          issues.push({
            id: `decision-routes-${node.id}`,
            level: "error",
            message: `La decisión "${nodeLabel}" necesita al menos dos rutas conectadas.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "decision-routes",
            source: "local",
          });
        }

        const unlabeledEdge = outgoingEdges.find((edge) => !String(edge.label ?? "").trim());
        if (unlabeledEdge) {
          issues.push({
            id: `decision-edge-label-${node.id}`,
            level: "error",
            message: `La decisión "${nodeLabel}" tiene una salida sin etiqueta.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "decision-edge-label",
            source: "local",
          });
        }

        if (routeCoverage.missingOptions.length > 0) {
          issues.push({
            id: `decision-missing-route-${node.id}`,
            level: "warning",
            message: `La decisión "${nodeLabel}" tiene opciones sin ruta asignada.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "decision-route-gap",
            source: "local",
          });
        }

        if (routeCoverage.unmatchedEdges.length > 0) {
          issues.push({
            id: `decision-unmatched-route-${node.id}`,
            level: "warning",
            message: `La decisión "${nodeLabel}" tiene rutas cuyas etiquetas no coinciden con ninguna opción.`,
            nodeId: node.id,
            nodeLabel,
            issueType: "decision-edge-mismatch",
            source: "local",
          });
        }
      }
    }

    if (startNodes.length === 1) {
      const startId = startNodes[0].id;
      const visited = new Set<string>();
      const visiting = new Set<string>();
      let cycleNodeId: string | null = null;

      const walk = (nodeId: string) => {
        if (visiting.has(nodeId)) {
          cycleNodeId = nodeId;
          return;
        }

        if (visited.has(nodeId)) return;

        visited.add(nodeId);
        visiting.add(nodeId);

        for (const edge of executionEdges.filter((item) => item.source === nodeId)) {
          walk(edge.target);
        }

        visiting.delete(nodeId);
      };

      walk(startId);

      if (cycleNodeId) {
        const node = nodeById.get(cycleNodeId);
        issues.push({
          id: `graph-cycle-${cycleNodeId}`,
          level: "error",
          message: node
            ? `El flujo entra en ciclo alrededor de "${getNodeDisplayName(node)}".`
            : "El grafo contiene un ciclo no permitido en este MVP.",
          nodeId: node?.id,
          nodeLabel: node ? getNodeDisplayName(node) : undefined,
          issueType: "cycle",
          source: "local",
        });
      }

      for (const node of nodes.filter((item) => isFlowNodeType((item.data?.nodeType ?? item.type) as NarrativeNodeType))) {
        if (!visited.has(node.id)) {
          issues.push({
            id: `graph-unreachable-${node.id}`,
            level: "error",
            message: `El nodo "${getNodeDisplayName(node)}" no es alcanzable desde START.`,
            nodeId: node.id,
            nodeLabel: getNodeDisplayName(node),
            issueType: "unreachable",
            source: "local",
          });
        }
      }
    }

    return issues;
  }, [audioMap, buttonMap, edges, executionEdges, executionGraphMetrics.incoming, executionGraphMetrics.outgoing, graphMetrics.incoming, graphMetrics.outgoing, nodes]);

  const backendValidationIssues = useMemo(() => {
    const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
    return validation.errors.map((error) => inferBackendIssue(error, nodeLookup));
  }, [nodes, validation.errors]);

  const validationIssues = useMemo(() => {
    const deduped = new Map<string, BuilderValidationIssue>();
    for (const issue of [...localValidationIssues, ...backendValidationIssues]) {
      const key = `${issue.level}:${issue.nodeId ?? "graph"}:${issue.message}`;
      if (!deduped.has(key)) deduped.set(key, issue);
    }
    return Array.from(deduped.values());
  }, [backendValidationIssues, localValidationIssues]);

  const groupedValidation = useMemo(
    () => ({
      errors: validationIssues.filter((issue) => issue.level === "error"),
      warnings: validationIssues.filter((issue) => issue.level === "warning"),
      suggestions: validationIssues.filter((issue) => issue.level === "suggestion"),
    }),
    [validationIssues],
  );

  const effectiveValidation = useMemo(
    () => ({
      valid: groupedValidation.errors.length === 0,
      errors: groupedValidation.errors,
      warnings: groupedValidation.warnings,
      suggestions: groupedValidation.suggestions,
    }),
    [groupedValidation.errors, groupedValidation.suggestions, groupedValidation.warnings],
  );
  const publishDiff = useMemo(() => {
    const currentNodeIds = new Set(currentGraph.nodes.map((node) => node.id));
    const publishedNodeIds = new Set(publishedGraph.nodes.map((node) => node.id));
    const currentEdgeIds = new Set(currentGraph.edges.map((edge) => edge.id));
    const publishedEdgeIds = new Set(publishedGraph.edges.map((edge) => edge.id));

    const addedNodes = currentGraph.nodes.filter((node) => !publishedNodeIds.has(node.id));
    const removedNodes = publishedGraph.nodes.filter((node) => !currentNodeIds.has(node.id));
    const modifiedNodes = currentGraph.nodes.filter((node) => {
      const previous = publishedGraph.nodes.find((item) => item.id === node.id);
      return previous && JSON.stringify(node) !== JSON.stringify(previous);
    });
    const addedEdges = currentGraph.edges.filter((edge) => !publishedEdgeIds.has(edge.id));
    const removedEdges = publishedGraph.edges.filter((edge) => !currentEdgeIds.has(edge.id));

    return {
      addedNodes: addedNodes.length,
      removedNodes: removedNodes.length,
      modifiedNodes: modifiedNodes.length,
      addedEdges: addedEdges.length,
      removedEdges: removedEdges.length,
    };
  }, [currentGraph.edges, currentGraph.nodes, publishedGraph.edges, publishedGraph.nodes]);
  const nodeIssues = useMemo(() => {
    const map = new Map<string, BuilderValidationIssue[]>();
    for (const issue of validationIssues) {
      if (!issue.nodeId) continue;
      const current = map.get(issue.nodeId) ?? [];
      current.push(issue);
      map.set(issue.nodeId, current);
    }
    return map;
  }, [validationIssues]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

try {
        const [result, audiosRes, buttonsRes, voicesRes, modelsRes] = await Promise.all([
          api<NarrativeBuilderState>(`/narratives/${narrativeId}/builder`),
          api<ApiCollection<AudioAssetOption>>("/audio-assets").catch(
            () => [] as AudioAssetOption[],
          ),
          api<ApiCollection<AudioButtonOption>>("/audio-buttons").catch(
            () => [] as AudioButtonOption[],
          ),
          api<unknown>("/integrations/elevenlabs/voices").catch(() => []),
          api<unknown>("/integrations/elevenlabs/models").catch(() => []),
        ]);

        setBuilder(result);
        setAudios(
          toCollectionItems(audiosRes).map((audio) => ({
            id: audio.id,
            name: audio.originalName,
          })),
        );
        setButtons(toCollectionItems(buttonsRes));
        setVoices(toVoiceItems(voicesRes));
        setModels(toModelItems(modelsRes));

        const graph = graphFromVersions(result.draftVersion ?? result.publishedVersion);

      setNodes(
        graph.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position ?? { x: 120, y: 120 },
          data: normalizeBuilderNodeData(node.type, node.data as Record<string, unknown> | undefined),
        })),
      );
      setEdges(
        graph.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label ?? undefined,
          type: "smoothstep",
        })),
      );
      setValidation(result.validation);
      setSelectedNodeIds(graph.nodes[0]?.id ? [graph.nodes[0].id] : []);
      setSelectedNodeId(graph.nodes[0]?.id ?? null);
      setSelectedEdgeIds([]);
      setSelectedEdgeId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la narrativa.");
      setBuilder(null);
      setNodes([]);
      setEdges([]);
      setVoices([]);
      setModels([]);
      setSelectedNodeIds([]);
      setSelectedNodeId(null);
      setSelectedEdgeIds([]);
      setSelectedEdgeId(null);
      setEditingNodeId(null);
    } finally {
      setLoading(false);
    }
  }, [narrativeId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const nodeTypes = useMemo<NodeTypes>(() => ({ narrative: NarrativeFlowNode }), []);

  const flowNodes = useMemo(
    () =>
      nodes.map((node) => {
        const nodeType = (node.data?.nodeType ?? node.type) as NarrativeNodeType;
        const outgoingCount = isAnnotationNodeType(nodeType)
          ? graphMetrics.outgoing.get(node.id) ?? 0
          : executionGraphMetrics.outgoing.get(node.id) ?? 0;
        const incomingCount = isAnnotationNodeType(nodeType)
          ? graphMetrics.incoming.get(node.id) ?? 0
          : executionGraphMetrics.incoming.get(node.id) ?? 0;
        const badges: BuilderBadge[] = [];
        let summary = nodeSummary(node);
        let status: FlowNodeData["builderStatus"] = "valid";
        let statusLabel = "Válido";

        const markWarning = (label: string) => {
          badges.push({ label, tone: "warning" });
          if (status !== "error") {
            status = "warning";
            statusLabel = "Advertencia";
          }
        };

        const markError = (label: string) => {
          badges.push({ label, tone: "error" });
          status = "error";
          statusLabel = "Error";
        };

        switch (nodeType) {
          case "START":
            summary = `Punto de arranque · ${outgoingCount} salida${outgoingCount === 1 ? "" : "s"}`;
            badges.push({ label: "Inicio", tone: "info" });
            if (incomingCount > 0) markError("Recibe entradas");
            if (outgoingCount === 0) markError("Sin salida");
            break;
          case "AUDIO": {
            const asset = node.data?.audioAssetId ? audioMap.get(String(node.data.audioAssetId)) : null;
            summary = asset
              ? `Audio: ${asset.name}`
              : "Selecciona un audio para este paso";
            badges.push({
              label: node.data?.required ? "Obligatorio" : "Opcional",
              tone: "info",
            });
            badges.push({
              label: node.data?.allowReplay ? "Repetible" : "Una sola vez",
              tone: "info",
            });
            if (!node.data?.audioAssetId) {
              markError("Sin audio");
            } else if (!asset) {
              markWarning("Recurso no cargado");
            } else {
              badges.push({ label: "Recurso activo", tone: "valid" });
            }
            break;
          }
          case "AUDIO_BUTTON": {
            const button = node.data?.audioButtonId ? buttonMap.get(String(node.data.audioButtonId)) : null;
            summary = button
              ? `Botón: ${button.label}${button.category?.name ? ` · ${button.category.name}` : ""}`
              : "Selecciona un botón de audio";
            badges.push({
              label: node.data?.required ? "Obligatorio" : "Opcional",
              tone: "info",
            });
            if (!node.data?.audioButtonId) {
              markError("Sin botón");
            } else if (!button) {
              markWarning("Botón no cargado");
            } else {
              badges.push({ label: "Botón listo", tone: "valid" });
            }
            break;
          }
          case "DYNAMIC_AUDIO": {
            const template = normalizeDynamicAudioTemplate(String(node.data?.template ?? "")).trim();
            const variables = extractDynamicAudioVariables(template);
            const voice = String(node.data?.voiceId ?? "").trim();
            const model = String(node.data?.modelId ?? "").trim();
            summary = template
              ? `${template.slice(0, 90)}${template.length > 90 ? "…" : ""}`
              : "Define la plantilla del audio dinámico";
            badges.push({
              label: `${variables.length} variable${variables.length === 1 ? "" : "s"}`,
              tone: "info",
            });
            if (!template) {
              markError("Sin plantilla");
            } else if (variables.length === 0) {
              markError("Sin variables");
            } else {
              badges.push({ label: "Variables detectadas", tone: "valid" });
            }
            if (!voice) {
              markWarning("Sin voz");
            }
            if (!model) {
              markWarning("Sin modelo");
            }
            break;
          }
          case "SCRIPT_TEXT": {
            const body = String(node.data?.body ?? "").trim();
            summary = body ? body.slice(0, 90) : "Escribe el texto que debe seguir el operador";
            badges.push({
              label: node.data?.required ? "Obligatorio" : "Opcional",
              tone: "info",
            });
            if (!body) {
              markWarning("Sin contenido");
            } else {
              badges.push({ label: `${body.length} caracteres`, tone: "valid" });
            }
            break;
          }
          case "INSTRUCTION": {
            const instruction = String(node.data?.instruction ?? "").trim();
            summary = instruction ? instruction.slice(0, 90) : "Instrucción operativa pendiente";
            if (!instruction) {
              markWarning("Sin instrucción");
            } else {
              badges.push({ label: "Checklist listo", tone: "valid" });
            }
            break;
          }
          case "PAUSE": {
            const manual = getPauseMode(node.data ?? { nodeType }) === "manual";
            const duration = String(node.data?.durationSeconds ?? "").trim();
            summary = manual
              ? "Pausa manual hasta intervención del operador"
              : `Pausa temporizada${duration ? ` · ${duration}s` : ""}`;
            badges.push({
              label: manual ? "Manual" : "Timer",
              tone: "info",
            });
            if (!manual && !duration) {
              markWarning("Sin duración");
            }
            break;
          }
          case "DECISION": {
            const question = String(node.data?.question ?? "").trim();
            const options = normalizeDecisionOptions(node.data?.options);
            const routeCoverage = decisionRouteCoverage(options, findDecisionOutgoingEdges(node.id, executionEdges));
            summary = question
              ? `${question} · ${options.length} opción${options.length === 1 ? "" : "es"} · ${routeCoverage.matchedOptionIds.size}/${options.length} rutas`
              : "Define la pregunta y sus rutas";
            badges.push({ label: `${outgoingCount} ruta${outgoingCount === 1 ? "" : "s"}`, tone: "info" });
            if (!question) markError("Sin pregunta");
            if (options.length < 2) markError("Opciones insuficientes");
            if (new Set(options.map((option) => option.label.trim().toLowerCase())).size !== options.length) {
              markError("Etiquetas duplicadas");
            }
            if (outgoingCount < 2) markError("Sin ramas mínimas");
            if (routeCoverage.missingOptions.length > 0) markWarning("Faltan rutas");
            if (routeCoverage.unmatchedEdges.length > 0) markWarning("Rutas sin opción");
            break;
          }
          case "END":
            summary = "Final de flujo";
            badges.push({ label: "Cierre", tone: "info" });
            if (outgoingCount > 0) markError("Tiene salidas");
            break;
          default:
            break;
        }

        if (status === "valid" && !badges.some((badge) => badge.tone === "valid")) {
          badges.unshift({ label: "Listo", tone: "valid" });
        }

        return {
          ...node,
          type: "narrative",
          data: {
            ...(node.data ?? {}),
            builderSummary: summary,
            builderStatus: status,
            builderStatusLabel: statusLabel,
            builderBadges: badges,
          } as FlowNodeData,
        };
      }),
    [audioMap, buttonMap, edges, executionEdges, executionGraphMetrics.incoming, executionGraphMetrics.outgoing, graphMetrics.incoming, graphMetrics.outgoing, nodes],
  );

  const displayEdges = useMemo(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
    return edges.map((edge) => {
      if (!isAnnotationEdge(edge, nodeById)) return edge;
      return {
        ...edge,
        type: "straight",
        animated: false,
        label: edge.label ?? "Nota",
        style: {
          ...(edge.style ?? {}),
          stroke: "rgba(245, 158, 11, 0.75)",
          strokeWidth: 1.8,
          strokeDasharray: "6 6",
        },
        labelStyle: {
          ...(edge.labelStyle ?? {}),
          fill: "rgb(251, 191, 36)",
          fontWeight: 700,
        },
        labelBgStyle: {
          fill: "rgba(42, 29, 13, 0.92)",
          stroke: "rgba(245, 158, 11, 0.28)",
          strokeWidth: 1,
        },
      };
    });
  }, [edges, nodes]);

  function addNode(type: NarrativeNodeType) {
    const id = makeNodeId(type);
    const count = nodes.length;

    const node: Node<FlowNodeData> = {
      id,
      type: "narrative",
      position: {
        x: 120 + (count % 3) * 280,
        y: 120 + Math.floor(count / 3) * 180,
      },
        data: {
          nodeType: type,
          ...(DEFAULT_NODE_DATA[type] ?? {}),
        } as FlowNodeData,
    };

    setNodes((current) => [...current, node]);
    setSelectedNodeIds([id]);
    setSelectedNodeId(id);
    setSelectedEdgeIds([]);
    setSelectedEdgeId(null);
  }

  function saveNodePatch(nodeId: string, patch: Record<string, unknown>) {
    setNodes((current) =>
      current.map((node) => (node.id === nodeId ? updateNodeData(node, patch) : node)),
    );
  }

  function updateDecisionNodeOptions(
    nodeId: string,
    updater: (options: DecisionOption[]) => DecisionOption[],
  ) {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== nodeId) return node;
        const nextOptions = updater(normalizeDecisionOptions(node.data?.options));
        return updateNodeData(node, { options: nextOptions });
      }),
    );
  }

  function renameDecisionOption(nodeId: string, optionId: string, patch: Partial<DecisionOption>) {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return;

    const currentOptions = normalizeDecisionOptions(node.data?.options);
    const previous = currentOptions.find((option) => option.id === optionId);
    if (!previous) return;

    const nextOptions = currentOptions.map((option) =>
      option.id === optionId ? { ...option, ...patch } : option,
    );
    const nextLabel = (patch.label ?? previous.label).trim();
    const previousLabel = previous.label.trim();

    setNodes((current) =>
      current.map((item) => {
        if (item.id !== nodeId) return item;
        return updateNodeData(item, { options: nextOptions });
      }),
    );

    if (patch.label !== undefined && previousLabel && nextLabel && previousLabel !== nextLabel) {
      setEdges((current) =>
        current.map((edge) =>
          edge.source === nodeId && normalizeDecisionEdgeLabel(edge.label as string | undefined) === normalizeDecisionEdgeLabel(previousLabel)
            ? { ...edge, label: nextLabel }
            : edge,
        ),
      );
    }
  }

  const onNodesChange = useCallback((changes: Parameters<typeof applyNodeChanges>[0]) => {
    setNodes((current) => applyNodeChanges(changes as never, current as never) as Node<FlowNodeData>[]);
  }, []);

  const onEdgesChange = useCallback((changes: Parameters<typeof applyEdgeChanges>[0]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  function removeNodes(nodeIds: string[]) {
    if (nodeIds.length === 0) return;

    const label = nodeIds.length === 1 ? "este nodo" : `estos ${nodeIds.length} nodos`;
    const affectedEdges = edges.filter(
      (edge) => nodeIds.includes(edge.source) || nodeIds.includes(edge.target),
    );
    const affectedEdgeIds = new Set(affectedEdges.map((edge) => edge.id));
    const affectedEdgeCount = affectedEdges.length;
    const warning = affectedEdgeCount > 0 ? ` Esto también eliminará ${affectedEdgeCount} conexión(es).` : "";
    if (window.confirm(`¿Seguro que deseas eliminar ${label}?${warning}`)) {
      setNodes((current) => current.filter((node) => !nodeIds.includes(node.id)));
      setEdges((current) =>
        current.filter((edge) => !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)),
      );
      const nextSelectedEdgeIds = selectedEdgeIds.filter((id) => !affectedEdgeIds.has(id));
      setSelectedEdgeIds(nextSelectedEdgeIds);
      setSelectedEdgeId(nextSelectedEdgeIds[0] ?? null);
      if (selectedNodeId && nodeIds.includes(selectedNodeId)) {
        setSelectedNodeId(null);
      }
      if (editingNodeId && nodeIds.includes(editingNodeId)) {
        setEditingNodeId(null);
      }
      setSelectedNodeIds((current) => current.filter((id) => !nodeIds.includes(id)));
    }
  }

  function removeNode(nodeId: string) {
    removeNodes([nodeId]);
  }

  function removeEdges(edgeIds: string[]) {
    if (edgeIds.length === 0) return;

    const edgeSet = new Set(edgeIds);
    const affectedEdges = edges.filter((edge) => edgeSet.has(edge.id));
    if (affectedEdges.length === 0) return;

    const label = affectedEdges.length === 1 ? "esta conexión" : `estas ${affectedEdges.length} conexiones`;
    const preview = affectedEdges
      .slice(0, 3)
      .map((edge) => {
        const sourceNode = nodeLookup.get(edge.source);
        const targetNode = nodeLookup.get(edge.target);
        const sourceLabel = sourceNode ? getNodeDisplayName(sourceNode) : edge.source;
        const targetLabel = targetNode ? getNodeDisplayName(targetNode) : edge.target;
        const edgeLabel = String(edge.label ?? "").trim() || "Sin etiqueta";
        return `${edgeLabel} (${sourceLabel} → ${targetLabel})`;
      })
      .join(", ");
    const overflow = affectedEdges.length > 3 ? ` y ${affectedEdges.length - 3} más` : "";
    const warning = preview ? `\n\nSe borrarán: ${preview}${overflow}.` : "";

    if (window.confirm(`¿Seguro que deseas eliminar ${label}?${warning}`)) {
      setEdges((current) => current.filter((edge) => !edgeSet.has(edge.id)));
      const nextSelectedEdgeIds = selectedEdgeIds.filter((id) => !edgeSet.has(id));
      setSelectedEdgeIds(nextSelectedEdgeIds);
      setSelectedEdgeId(nextSelectedEdgeIds[0] ?? null);
    }
  }

  function duplicateNode(nodeId: string) {
    const sourceNode = nodes.find((node) => node.id === nodeId);
    if (!sourceNode) return;

    const nextId = makeNodeId((sourceNode.data?.nodeType ?? sourceNode.type) as NarrativeNodeType);
    const duplicatedNode: Node<FlowNodeData> = {
      ...sourceNode,
      id: nextId,
      position: {
        x: sourceNode.position.x + 56,
        y: sourceNode.position.y + 56,
      },
      data: normalizeBuilderNodeData(
        (sourceNode.data?.nodeType ?? sourceNode.type) as NarrativeNodeType,
        serializeNodeData(
          (sourceNode.data?.nodeType ?? sourceNode.type) as NarrativeNodeType,
          (sourceNode.data ?? {}) as FlowNodeData,
        ) as Record<string, unknown>,
      ),
    };

    setNodes((current) => [...current, duplicatedNode]);
    setSelectedNodeIds([nextId]);
    setSelectedNodeId(nextId);
    setSelectedEdgeIds([]);
    setSelectedEdgeId(null);
    setMessage("Nodo duplicado.");
  }

  function autoLayoutNodes() {
    setNodes((current) => autoLayout(current, edges));
  }

  const onConnect = useCallback((connection: Connection) => {
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    const annotationConnection = isAnnotationNode(sourceNode) || isAnnotationNode(targetNode);
    let defaultLabel = annotationConnection ? "Nota" : "Siguiente";

    if (!annotationConnection && sourceNode?.data?.nodeType === "DECISION") {
      const decisionOptions = normalizeDecisionOptions(sourceNode.data?.options);
      const outgoingEdges = findDecisionOutgoingEdges(sourceNode.id, executionEdges);
      const routeCoverage = decisionRouteCoverage(decisionOptions, outgoingEdges);
      defaultLabel =
        routeCoverage.missingOptions[0]?.label ??
        decisionOptions[0]?.label ??
        "Opción";
    }

    const label = window.prompt("Etiqueta de la conexión", defaultLabel)?.trim();

    setEdges((current) =>
      addEdge(
        {
          ...connection,
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label: label || defaultLabel,
          type: annotationConnection ? "straight" : "smoothstep",
        },
        current,
      ),
    );
  }, [executionEdges, nodes]);

  async function saveGraph() {
    setSaving(true);
    setMessage(null);

    try {
      const graphJson: NarrativeGraphJson = {
        nodes: nodes.map((node) => ({
          id: node.id,
          type: (node.data?.nodeType ?? node.type) as NarrativeNodeType,
          position: node.position,
          data: serializeNodeData(
            (node.data?.nodeType ?? node.type) as NarrativeNodeType,
            (node.data ?? {}) as FlowNodeData,
          ),
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: typeof edge.label === "string" ? edge.label : null,
        })),
      };

      const result = await api<{ draftVersion: NarrativeVersion; narrative: unknown }>(
        `/narratives/${narrativeId}/graph`,
        {
          method: "PATCH",
          body: JSON.stringify({ graphJson }),
        },
      );

      if (result.draftVersion) {
        setBuilder((current) =>
          current
            ? {
                ...current,
                draftVersion: result.draftVersion,
              }
            : current,
        );
      }

      setMessage("Borrador guardado.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el borrador.");
    } finally {
      setSaving(false);
    }
  }

  async function validateGraph() {
    setWorking(true);
    setMessage(null);

    try {
      const result = await api<{ valid: boolean; errors: string[] }>(`/narratives/${narrativeId}/validate`, {
        method: "POST",
        body: JSON.stringify({
          graphJson: {
            nodes: nodes.map((node) => ({
              id: node.id,
              type: (node.data?.nodeType ?? node.type) as NarrativeNodeType,
              position: node.position,
              data: serializeNodeData(
                (node.data?.nodeType ?? node.type) as NarrativeNodeType,
                (node.data ?? {}) as FlowNodeData,
              ),
            })),
            edges: edges.map((edge) => ({
              id: edge.id,
              source: edge.source,
              target: edge.target,
              label: typeof edge.label === "string" ? edge.label : null,
            })),
          },
        }),
      });

      setValidation(result);
      setMessage(result.valid ? "Narrativa válida." : "La narrativa necesita ajustes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo validar la narrativa.");
    } finally {
      setWorking(false);
    }
  }

  async function publishGraph() {
    if (effectiveValidation.errors.length > 0) {
      setIsValidationPanelOpen(true);
      setMessage("La publicación fue bloqueada por errores críticos.");
      return;
    }

    if (effectiveValidation.warnings.length > 0 || effectiveValidation.suggestions.length > 0) {
      const confirmPublish = window.confirm(
        `Hay ${effectiveValidation.warnings.length} advertencia(s) y ${effectiveValidation.suggestions.length} sugerencia(s). ¿Publicar de todos modos?`,
      );
      if (!confirmPublish) {
        setIsValidationPanelOpen(true);
        return;
      }
    }

    setWorking(true);
    setMessage(null);

    try {
      await saveGraph();
      const result = await api(`/narratives/${narrativeId}/publish`, {
        method: "POST",
        body: JSON.stringify({ force: false }),
      });

      if (result) {
        await load();
      }
      setMessage("Narrativa publicada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo publicar la narrativa.");
    } finally {
      setWorking(false);
    }
  }

  function duplicateFromPublished() {
    if (!builder?.publishedVersion?.graphJson) return;

    const graph = builder.publishedVersion.graphJson;
    setNodes(
      graph.nodes.map((node) => ({
        id: node.id,
        type: "narrative",
        position: node.position ?? { x: 120, y: 120 },
        data: normalizeBuilderNodeData(node.type, node.data as Record<string, unknown> | undefined),
      })),
    );
    setEdges(
      graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label ?? undefined,
        type: "smoothstep",
      })),
    );
    setSelectedNodeId(graph.nodes[0]?.id ?? null);
    setSelectedNodeIds(graph.nodes[0]?.id ? [graph.nodes[0].id] : []);
    setSelectedEdgeIds([]);
    setSelectedEdgeId(null);
    setMessage("Se copió la versión publicada al borrador local.");
  }

  function focusNode(nodeId: string, options?: { openEditor?: boolean }) {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return;

    setSelectedNodeIds([nodeId]);
    setSelectedNodeId(nodeId);
    setSelectedEdgeIds([]);
    setSelectedEdgeId(null);

    if (options?.openEditor) {
      setEditingNodeId(nodeId);
    }

    if (reactFlowInstance) {
      const zoom = Math.max(reactFlowInstance.getZoom(), 0.95);
      reactFlowInstance.setCenter(node.position.x + 120, node.position.y + 50, {
        zoom,
        duration: 350,
      });
    }
  }

  const editingNodeIssues = editingNode ? nodeIssues.get(editingNode.id) ?? [] : [];
  const editingNodeAsset =
    editingNode?.data?.nodeType === "AUDIO" && editingNode.data.audioAssetId
      ? audioMap.get(String(editingNode.data.audioAssetId))
      : null;
  const editingNodeButton =
    editingNode?.data?.nodeType === "AUDIO_BUTTON" && editingNode.data.audioButtonId
      ? buttonMap.get(String(editingNode.data.audioButtonId))
      : null;
  const editingDecisionOptions =
    editingNode?.data?.nodeType === "DECISION"
      ? normalizeDecisionOptions(editingNode.data.options)
      : [];
  const editingDecisionRoutes =
    editingNode?.data?.nodeType === "DECISION"
      ? findDecisionOutgoingEdges(editingNode.id, edges)
      : [];
  const editingDecisionCoverage =
    editingNode?.data?.nodeType === "DECISION"
      ? decisionRouteCoverage(editingDecisionOptions, editingDecisionRoutes)
      : null;
  const editingDynamicAudioTemplate =
    editingNode?.data?.nodeType === "DYNAMIC_AUDIO"
      ? normalizeDynamicAudioTemplate(String(editingNode.data.template ?? ""))
      : "";
  const editingDynamicAudioVariables = editingDynamicAudioTemplate
    ? extractDynamicAudioVariables(editingDynamicAudioTemplate)
    : [];
  const editingDynamicAudioPreview = editingDynamicAudioTemplate
    ? buildDynamicAudioPreview(editingDynamicAudioTemplate, editingDynamicAudioVariables)
    : "";
  const selectedDynamicVoice = useMemo(
    () => voices.find((voice) => voice.voiceId === String(editingNode?.data?.voiceId ?? "")) ?? null,
    [editingNode?.data?.voiceId, voices],
  );
  const selectedDynamicModel = useMemo(
    () => models.find((model) => model.modelId === String(editingNode?.data?.modelId ?? "")) ?? null,
    [editingNode?.data?.modelId, models],
  );

  const modalPanel = editingNode ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-surface-container p-6 shadow-elevation-3 border border-outline-variant">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Configurar Nodo
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-on-surface">
              {getNodeDisplayName(editingNode)}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badgeClassName("info")}`}>
                {editingNode.data?.nodeType}
              </span>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badgeClassName((editingNode.data?.builderStatus as BuilderBadge["tone"]) ?? "info")}`}>
                {editingNode.data?.builderStatusLabel ?? "Configuración"}
              </span>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badgeClassName(nodeIssues.has(editingNode.id) ? "warning" : "valid")}`}>
                {nodeIssues.has(editingNode.id) ? `${editingNodeIssues.length} issue(s)` : "Sin issues del nodo"}
              </span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setEditingNodeId(null)}
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface hover:text-on-surface transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <ModalSection
            title="Configuración principal"
            description="Define el nombre visible del paso y su identidad dentro del flujo."
          >
            <label className="grid gap-1.5">
              <FieldLabel>Título / etiqueta</FieldLabel>
              <input
                value={String(editingNode.data?.title ?? editingNode.data?.label ?? "")}
                onChange={(event) =>
                  saveNodePatch(editingNode.id, {
                    title: event.target.value,
                    label: event.target.value,
                  })
                }
                className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
              />
            </label>
          </ModalSection>

          {editingNode.data?.nodeType === "AUDIO" && (
            <>
              <ModalSection
                title="Recurso asociado"
                description="Selecciona el audio que este paso debe reproducir."
              >
                <label className="grid gap-1.5">
                  <FieldLabel>Audio a reproducir</FieldLabel>
                  <select
                    value={String(editingNode.data.audioAssetId ?? "")}
                    onChange={(event) => saveNodePatch(editingNode.id, { audioAssetId: event.target.value })}
                    className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Selecciona un audio...</option>
                    {audios.map((audio) => (
                      <option key={audio.id} value={audio.id}>{audio.name}</option>
                    ))}
                  </select>
                </label>
                <div className="rounded-2xl border border-outline-variant bg-surface-container px-3 py-3 text-sm text-on-surface-variant">
                  {editingNodeAsset ? (
                    <div className="space-y-1">
                      <p><span className="font-semibold text-on-surface">Audio activo:</span> {editingNodeAsset.name}</p>
                      <p>El recurso está disponible en el builder actual.</p>
                    </div>
                  ) : (
                    <p>Selecciona un audio válido para completar este nodo.</p>
                  )}
                </div>
              </ModalSection>

              <ModalSection
                title="Contenido"
                description="Texto de contexto y detalle operativo del paso."
              >
                <label className="grid gap-1.5">
                  <FieldLabel>Descripción</FieldLabel>
                  <textarea
                    value={String(editingNode.data.description ?? "")}
                    onChange={(event) => saveNodePatch(editingNode.id, { description: event.target.value })}
                    className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              </ModalSection>

              <ModalSection
                title="Comportamiento"
                description="Controla si el paso es obligatorio y si el audio puede repetirse."
              >
                <div className="flex flex-wrap gap-2">
                  <BooleanPill
                    value={Boolean(editingNode.data.required)}
                    onChange={(value) => saveNodePatch(editingNode.id, { required: value })}
                    label="Obligatorio"
                  />
                  <BooleanPill
                    value={Boolean(editingNode.data.allowReplay)}
                    onChange={(value) => saveNodePatch(editingNode.id, { allowReplay: value })}
                    label="Permitir repetir"
                  />
                </div>
              </ModalSection>

              <ModalSection
                title="Notas para operador"
                description="Información interna que ayuda a ejecutar el paso correctamente."
              >
                <label className="grid gap-1.5">
                  <FieldLabel>Notas para operador</FieldLabel>
                  <textarea
                    value={String(editingNode.data.operatorNotes ?? "")}
                    onChange={(event) => saveNodePatch(editingNode.id, { operatorNotes: event.target.value })}
                    className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              </ModalSection>
            </>
          )}

          {editingNode.data?.nodeType === "AUDIO_BUTTON" && (
            <>
              <ModalSection
                title="Recurso asociado"
                description="Selecciona el botón de audio que se utilizará en este paso."
              >
                <label className="grid gap-1.5">
                  <FieldLabel>Botón a reproducir</FieldLabel>
                  <select
                    value={String(editingNode.data.audioButtonId ?? "")}
                    onChange={(event) => saveNodePatch(editingNode.id, { audioButtonId: event.target.value })}
                    className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Selecciona un botón...</option>
                    {buttons.map((button) => (
                      <option key={button.id} value={button.id}>
                        {button.label} {button.category?.name ? `(${button.category.name})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-2xl border border-outline-variant bg-surface-container px-3 py-3 text-sm text-on-surface-variant">
                  {editingNodeButton ? (
                    <div className="space-y-1">
                      <p><span className="font-semibold text-on-surface">Botón activo:</span> {editingNodeButton.label}</p>
                      <p>
                        Categoría: {editingNodeButton.category?.name ?? "Sin categoría"}
                      </p>
                    </div>
                  ) : (
                    <p>Selecciona un botón válido para completar este nodo.</p>
                  )}
                </div>
              </ModalSection>

              <ModalSection
                title="Comportamiento"
                description="Define si el paso debe completarse obligatoriamente."
              >
                <BooleanPill
                  value={Boolean(editingNode.data.required)}
                  onChange={(value) => saveNodePatch(editingNode.id, { required: value })}
                  label="Obligatorio"
                />
              </ModalSection>

              <ModalSection
                title="Notas para operador"
                description="Contexto interno para ejecutar este botón dentro de la narrativa."
              >
                <label className="grid gap-1.5">
                  <FieldLabel>Notas para operador</FieldLabel>
                  <textarea
                    value={String(editingNode.data.operatorNotes ?? "")}
                    onChange={(event) => saveNodePatch(editingNode.id, { operatorNotes: event.target.value })}
                    className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              </ModalSection>
            </>
          )}

          {editingNode.data?.nodeType === "DYNAMIC_AUDIO" && (
            <>
              <ModalSection
                title="Plantilla y variables"
                description="Escribe el texto con placeholders usando el formato {{variable}}."
              >
                <label className="grid gap-1.5">
                  <FieldLabel>Título / etiqueta</FieldLabel>
                  <input
                    value={String(editingNode.data.title ?? editingNode.data.label ?? "")}
                    onChange={(event) =>
                      saveNodePatch(editingNode.id, {
                        title: event.target.value,
                        label: event.target.value,
                      })
                    }
                    className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="grid gap-1.5">
                  <FieldLabel>Texto plantilla</FieldLabel>
                  <textarea
                    value={String(editingNode.data.template ?? "")}
                    onChange={(event) => {
                      const template = normalizeDynamicAudioTemplate(event.target.value);
                      saveNodePatch(editingNode.id, {
                        template,
                        variables: extractDynamicAudioVariables(template),
                      });
                    }}
                    placeholder="Bienvenido, {{nombre}}. Respira profundo..."
                    className="min-h-32 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <div className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
                        Variables detectadas
                      </p>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        El builder normaliza los placeholders a{" "}
                        <span className="font-semibold text-on-surface">{"{{variable}}"}</span>.
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badgeClassName(editingDynamicAudioVariables.length > 0 ? "valid" : "warning")}`}>
                      {editingDynamicAudioVariables.length > 0 ? `${editingDynamicAudioVariables.length} variable(s)` : "Sin variables"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {editingDynamicAudioVariables.length > 0 ? (
                      editingDynamicAudioVariables.map((variable) => (
                        <span
                          key={variable}
                          className="inline-flex rounded-full border border-fuchsia-300/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-200"
                        >
                          {variable}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-on-surface-variant">
                        Agrega al menos una variable con el formato{" "}
                        <span className="font-semibold text-on-surface">{"{{nombre}}"}</span>.
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
                    Vista previa
                  </p>
                  <p className="mt-3 whitespace-pre-wrap rounded-2xl border border-outline-variant bg-surface px-4 py-4 text-sm leading-7 text-on-surface">
                    {editingDynamicAudioPreview || "La vista previa aparecerá cuando el texto contenga variables válidas."}
                  </p>
                </div>
              </ModalSection>

              <ModalSection
                title="Configuración ElevenLabs"
                description="Define la voz y el modelo que generarán el audio dinámico."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <FieldLabel>Voice ID</FieldLabel>
                    {voices.length > 0 ? (
                      <select
                        value={String(editingNode.data.voiceId ?? "")}
                        onChange={(event) => saveNodePatch(editingNode.id, { voiceId: event.target.value })}
                        className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                      >
                        <option value="">Selecciona una voz...</option>
                        {voices.map((voice) => (
                          <option key={voice.voiceId} value={voice.voiceId}>
                            {voice.name}
                            {voice.category ? ` · ${voice.category}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={String(editingNode.data.voiceId ?? "")}
                        onChange={(event) => saveNodePatch(editingNode.id, { voiceId: event.target.value })}
                        placeholder="voice_id"
                        className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                      />
                    )}
                    <p className="text-xs text-on-surface-variant">
                      {voices.length > 0
                        ? "La lista se sincroniza desde ElevenLabs."
                        : "No hay voces sincronizadas. Puedes escribir el Voice ID manualmente."}
                    </p>
                  </label>
                  <label className="grid gap-1.5">
                    <FieldLabel>Model ID</FieldLabel>
                    {models.length > 0 ? (
                      <select
                        value={String(editingNode.data.modelId ?? "")}
                        onChange={(event) => saveNodePatch(editingNode.id, { modelId: event.target.value })}
                        className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                      >
                        <option value="">Selecciona un modelo...</option>
                        {models.map((model) => (
                          <option key={model.modelId} value={model.modelId}>
                            {model.name}
                            {model.languages?.length ? ` · ${model.languages.join(", ")}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={String(editingNode.data.modelId ?? "")}
                        onChange={(event) => saveNodePatch(editingNode.id, { modelId: event.target.value })}
                        placeholder="model_id"
                        className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                      />
                    )}
                    <p className="text-xs text-on-surface-variant">
                      {models.length > 0
                        ? "La lista se sincroniza desde ElevenLabs."
                        : "No hay modelos sincronizados. Puedes escribir el Model ID manualmente."}
                    </p>
                  </label>
                  <label className="grid gap-1.5">
                    <FieldLabel>Output format</FieldLabel>
                    <select
                      value={String(editingNode.data.outputFormat ?? "")}
                      onChange={(event) => saveNodePatch(editingNode.id, { outputFormat: event.target.value })}
                      className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Selecciona un formato...</option>
                      {ELEVENLABS_OUTPUT_FORMAT_OPTIONS.map((format) => (
                        <option key={format} value={format}>
                          {format}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {ELEVENLABS_OUTPUT_FORMAT_OPTIONS.map((format) => {
                        const isSelected = String(editingNode.data.outputFormat ?? "") === format;
                        return (
                          <span
                            key={format}
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                              isSelected
                                ? "border-fuchsia-300/50 bg-fuchsia-500/15 text-fuchsia-200"
                                : "border-outline-variant bg-surface-container text-on-surface-variant"
                            }`}
                          >
                            {format}
                          </span>
                        );
                      })}
                    </div>
                  </label>
                  <label className="grid gap-1.5">
                    <FieldLabel>Stability</FieldLabel>
                    <input
                      value={String(editingNode.data.stability ?? "")}
                      onChange={(event) => saveNodePatch(editingNode.id, { stability: event.target.value })}
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <FieldLabel>Similarity boost</FieldLabel>
                    <input
                      value={String(editingNode.data.similarityBoost ?? "")}
                      onChange={(event) => saveNodePatch(editingNode.id, { similarityBoost: event.target.value })}
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <FieldLabel>Style</FieldLabel>
                    <input
                      value={String(editingNode.data.style ?? "")}
                      onChange={(event) => saveNodePatch(editingNode.id, { style: event.target.value })}
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <FieldLabel>Speed</FieldLabel>
                    <input
                      value={String(editingNode.data.speed ?? "")}
                      onChange={(event) => saveNodePatch(editingNode.id, { speed: event.target.value })}
                      type="number"
                      min="0.5"
                      max="2"
                      step="0.01"
                      className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                    />
                  </label>
                </div>
                {selectedDynamicVoice ? (
                  <div className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
                    <p className="font-semibold text-on-surface">{selectedDynamicVoice.name}</p>
                    <p className="mt-1">Voice ID: {selectedDynamicVoice.voiceId}</p>
                    <p className="mt-1">Categoría: {selectedDynamicVoice.category ?? "Sin categoría"}</p>
                  </div>
                ) : null}
                {selectedDynamicModel ? (
                  <div className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
                    <p className="font-semibold text-on-surface">{selectedDynamicModel.name}</p>
                    <p className="mt-1">Model ID: {selectedDynamicModel.modelId}</p>
                    <p className="mt-1">{selectedDynamicModel.languages?.length ? `Idiomas: ${selectedDynamicModel.languages.join(", ")}` : "Sin idiomas declarados"}</p>
                  </div>
                ) : null}
                <BooleanPill
                  value={Boolean(editingNode.data.speakerBoost)}
                  onChange={(value) => saveNodePatch(editingNode.id, { speakerBoost: value })}
                  label="Speaker boost"
                />
              </ModalSection>

              <ModalSection
                title="Notas internas"
                description="Observaciones del nodo y guía para la ejecución futura."
              >
                <label className="grid gap-1.5">
                  <FieldLabel>Notas para operador</FieldLabel>
                  <textarea
                    value={String(editingNode.data.operatorNotes ?? "")}
                    onChange={(event) => saveNodePatch(editingNode.id, { operatorNotes: event.target.value })}
                    className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              </ModalSection>
            </>
          )}

          {editingNode.data?.nodeType === "SCRIPT_TEXT" && (
            <>
              <ModalSection
                title="Contenido"
                description="Guion que debe leerse o mostrarse durante la ejecución."
              >
                <label className="grid gap-1.5">
                  <FieldLabel>Texto del guion</FieldLabel>
                  <textarea
                    value={String(editingNode.data.body ?? "")}
                    onChange={(event) => saveNodePatch(editingNode.id, { body: event.target.value })}
                    className="min-h-28 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              </ModalSection>

              <ModalSection
                title="Comportamiento"
                description="Define si el operador debe completar obligatoriamente este paso."
              >
                <BooleanPill
                  value={Boolean(editingNode.data.required)}
                  onChange={(value) => saveNodePatch(editingNode.id, { required: value })}
                  label="Obligatorio"
                />
              </ModalSection>

              <ModalSection
                title="Notas para admin"
                description="Contexto interno del guion que no se muestra en ejecución."
              >
                <label className="grid gap-1.5">
                  <FieldLabel>Notas internas</FieldLabel>
                  <textarea
                    value={String(editingNode.data.notes ?? "")}
                    onChange={(event) => saveNodePatch(editingNode.id, { notes: event.target.value })}
                    className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              </ModalSection>
            </>
          )}

          {editingNode.data?.nodeType === "INSTRUCTION" && (
            <>
              <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
                Las instrucciones funcionan como notas operativas. No cuentan como pasos del flujo, pueden estar desconectadas y no bloquean la ejecución.
              </div>

              <ModalSection
                title="Nota operativa"
                description="Recordatorio o ayuda contextual para el operador. Se muestra como anotación en el player."
              >
                <label className="grid gap-1.5">
                  <FieldLabel>Instrucción</FieldLabel>
                  <textarea
                    value={String(editingNode.data.instruction ?? "")}
                    onChange={(event) => saveNodePatch(editingNode.id, { instruction: event.target.value })}
                    className="min-h-28 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              </ModalSection>

              <ModalSection
                title="Notas para admin"
                description="Observaciones internas para revisar o mantener esta anotación."
              >
                <label className="grid gap-1.5">
                  <FieldLabel>Notas internas</FieldLabel>
                  <textarea
                    value={String(editingNode.data.notes ?? "")}
                    onChange={(event) => saveNodePatch(editingNode.id, { notes: event.target.value })}
                    className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              </ModalSection>
            </>
          )}

          {editingNode.data?.nodeType === "PAUSE" && (
            <ModalSection
              title="Comportamiento"
              description="Configura si la pausa es manual o temporizada."
            >
              <div className="grid gap-3">
                <label className="grid gap-1.5">
                  <FieldLabel>Tipo de pausa</FieldLabel>
                  <select
                    value={String(editingNode.data.pauseType ?? "manual")}
                    onChange={(event) => saveNodePatch(editingNode.id, { pauseType: event.target.value })}
                    className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="manual">Manual</option>
                    <option value="timer">Temporizada</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <FieldLabel>Duración en segundos</FieldLabel>
                  <input
                    value={String(editingNode.data.durationSeconds ?? "")}
                    onChange={(event) => saveNodePatch(editingNode.id, { durationSeconds: event.target.value })}
                    type="number"
                    min="0"
                    className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <BooleanPill
                  value={Boolean(editingNode.data.manual)}
                  onChange={(value) => saveNodePatch(editingNode.id, { manual: value })}
                  label="Pausa manual"
                />
              </div>
            </ModalSection>
          )}

          {editingNode.data?.nodeType === "DECISION" && (
            <>
              <ModalSection
                title="Contenido"
                description="Pregunta principal y opciones disponibles para ramificar el flujo."
              >
                <label className="grid gap-1.5">
                  <FieldLabel>Pregunta</FieldLabel>
                  <textarea
                    value={String(editingNode.data.question ?? "")}
                    onChange={(event) => saveNodePatch(editingNode.id, { question: event.target.value })}
                    className="min-h-24 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="grid gap-1.5">
                  <FieldLabel>Opciones</FieldLabel>
                  <div className="space-y-3">
                    {editingDecisionOptions.map((option, index) => {
                      const hasRoute = Boolean(
                        editingDecisionCoverage?.matchedOptionIds.has(option.id),
                      );

                      return (
                        <div
                          key={option.id}
                          className="rounded-2xl border border-outline-variant bg-surface-container px-3 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-3">
                              <label className="grid gap-1.5">
                                <FieldLabel>Etiqueta</FieldLabel>
                                <input
                                  value={option.label}
                                  onChange={(event) =>
                                    renameDecisionOption(editingNode.id, option.id, {
                                      label: event.target.value,
                                    })
                                  }
                                  className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                                />
                              </label>
                              <label className="grid gap-1.5">
                                <FieldLabel>Descripción opcional</FieldLabel>
                                <textarea
                                  value={option.description ?? ""}
                                  onChange={(event) =>
                                    renameDecisionOption(editingNode.id, option.id, {
                                      description: event.target.value,
                                    })
                                  }
                                  className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                                />
                              </label>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badgeClassName(hasRoute ? "valid" : "warning")}`}>
                                {hasRoute ? "Con ruta" : "Sin ruta"}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDecisionNodeOptions(editingNode.id, (options) =>
                                      index > 0 ? arrayMove(options, index, index - 1) : options,
                                    )
                                  }
                                  disabled={index === 0}
                                  className="rounded-xl border border-outline-variant bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:border-primary disabled:opacity-50"
                                >
                                  Subir
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDecisionNodeOptions(editingNode.id, (options) =>
                                      index < options.length - 1 ? arrayMove(options, index, index + 1) : options,
                                    )
                                  }
                                  disabled={index === editingDecisionOptions.length - 1}
                                  className="rounded-xl border border-outline-variant bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:border-primary disabled:opacity-50"
                                >
                                  Bajar
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDecisionNodeOptions(editingNode.id, (options) =>
                                      options.filter((item) => item.id !== option.id),
                                    )
                                  }
                                  className="rounded-xl border border-red-300 bg-red-50/50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:border-red-400 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() =>
                        updateDecisionNodeOptions(editingNode.id, (options) => [
                          ...options,
                          { id: makeDecisionOptionId(), label: "", description: "" },
                        ])
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar opción
                    </button>
                  </div>
                </label>
              </ModalSection>

              <ModalSection
                title="Cobertura de rutas"
                description="Las etiquetas de las conexiones deben coincidir con las opciones para mantener compatibilidad con el player actual."
              >
                <div className="space-y-2 text-sm text-on-surface-variant">
                  <p>
                    <span className="font-semibold text-on-surface">Opciones con ruta:</span>{" "}
                    {editingDecisionCoverage?.matchedOptionIds.size ?? 0} / {editingDecisionOptions.length}
                  </p>
                  <p>
                    <span className="font-semibold text-on-surface">Rutas sin opción:</span>{" "}
                    {editingDecisionCoverage?.unmatchedEdges.length ?? 0}
                  </p>
                </div>
              </ModalSection>

              <ModalSection
                title="Notas para operador"
                description="Aclaraciones para ejecutar correctamente la decisión."
              >
                <label className="grid gap-1.5">
                  <FieldLabel>Notas para operador</FieldLabel>
                  <textarea
                    value={String(editingNode.data.operatorNotes ?? "")}
                    onChange={(event) => saveNodePatch(editingNode.id, { operatorNotes: event.target.value })}
                    className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              </ModalSection>
            </>
          )}

          {editingNode.data?.nodeType === "START" && (
            <ModalSection
              title="Información del nodo"
              description="El nodo START define el punto único de arranque del flujo."
            >
              <p className="text-sm text-on-surface-variant">
                El nodo de inicio no recibe entradas y debe conectar al primer paso del flujo.
              </p>
            </ModalSection>
          )}

          {editingNode.data?.nodeType === "END" && (
            <ModalSection
              title="Información del nodo"
              description="El nodo END representa el cierre del flujo."
            >
              <p className="text-sm text-on-surface-variant">
                El nodo final cierra la narrativa y no debe tener salidas.
              </p>
            </ModalSection>
          )}

          <ModalSection
            title="Validación del nodo"
            description="Resumen de issues detectados para este nodo dentro del builder."
          >
            {editingNodeIssues.length === 0 ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Este nodo no tiene observaciones activas.
              </p>
            ) : (
              <div className="space-y-2">
                {editingNodeIssues.map((issue) => {
                  const Icon = issueIcon(issue.level);
                  return (
                    <div
                      key={issue.id}
                      className={`rounded-2xl border px-3 py-3 ${badgeClassName(issueTone(issue.level))}`}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm">{issue.message}</p>
                          <p className="mt-1 text-[11px] opacity-80">
                            {issue.source === "backend" ? "Validación backend" : "Validación builder"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ModalSection>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-outline-variant pt-5">
          <button
            type="button"
            onClick={() => {
              removeNode(editingNode.id);
              setEditingNodeId(null);
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-300 bg-red-50/50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:border-red-400 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300"
          >
            Eliminar nodo
          </button>
          
          <button
            type="button"
            onClick={() => setEditingNodeId(null)}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary transition-transform hover:scale-[1.02]"
          >
            Guardar y cerrar
          </button>
        </div>
      </div>
    </div>
  ) : null;

if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-[28px] border border-outline-variant bg-surface-container text-sm text-on-surface-variant">
        Cargando builder de narrativa...
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col lg:grid lg:gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Palette */}
      <aside className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container p-3 shadow-elevation-1 max-h-[300px] lg:max-h-none overflow-y-auto">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-on-surface uppercase tracking-[0.1em]">
            Nodos
          </h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">Pasos del flujo</p>
            {NODE_PALETTE.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => addNode(item.type)}
                className="group flex w-full items-center gap-2.5 rounded-xl border border-outline-variant bg-surface px-2.5 py-2 text-left transition-colors hover:border-primary"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${item.accent} text-white shadow-sm`}>
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-on-surface">{item.label}</span>
                  <span className="block text-[10px] leading-tight text-on-surface-variant truncate">{item.description}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">Anotaciones</p>
            {ANNOTATION_PALETTE.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => addNode(item.type)}
                className="group flex w-full items-center gap-2.5 rounded-xl border border-amber-300/25 bg-amber-500/10 px-2.5 py-2 text-left transition-colors hover:border-amber-300/60"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${item.accent} text-white shadow-sm`}>
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-on-surface">{item.label}</span>
                  <span className="block text-[10px] leading-tight text-on-surface-variant">{item.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface px-3 py-2 mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Estado
          </p>
          <div className="mt-1.5 grid gap-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Narrativa</span>
              <span className="max-w-[150px] truncate font-semibold text-on-surface">
                {builder?.narrative.title ?? "Sin título"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Versión</span>
              <span className="font-semibold text-on-surface">
                {versionLabel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Publicado</span>
              <span className="font-semibold text-on-surface">
                {builder?.publishedVersion ? `v${builder.publishedVersion.versionNumber}` : "Sin publicar"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Nodos</span>
              <span className="font-semibold text-on-surface">{nodes.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Conexiones</span>
              <span className="font-semibold text-on-surface">{edges.length}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Buscar
          </p>
          <div className="mt-2 space-y-2">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Nombre, texto, tipo, audio..."
              className="h-10 w-full rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
            />
            {searchTerm.trim() ? (
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {filteredNodes.length > 0 ? (
                  filteredNodes.slice(0, 8).map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => focusNode(node.id)}
                      className="block w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-left transition-colors hover:border-primary"
                    >
                      <p className="text-xs font-semibold text-on-surface">{getNodeDisplayName(node)}</p>
                      <p className="text-[11px] text-on-surface-variant">
                        {String(node.data?.nodeType ?? node.type)}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-on-surface-variant">Sin resultados.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Selección
          </p>
          {selectedNodes.length > 0 || selectedEdges.length > 0 ? (
            <div className="mt-2 space-y-4">
              {selectedNodes.length > 0 ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {selectedNodes.length === 1
                        ? String(selectedNode?.data?.title ?? selectedNode?.data?.label ?? selectedNode?.id)
                        : `${selectedNodes.length} nodos seleccionados`}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {selectedNodes.length === 1
                        ? String(selectedNode?.data?.nodeType ?? selectedNode?.type)
                        : "Selección múltiple"}
                    </p>
                  </div>
                  {selectedNodes.length === 1 ? (
                    <p className="text-xs leading-relaxed text-on-surface-variant">
                      {selectedNode ? nodeSummary(selectedNode) : ""}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs leading-relaxed text-on-surface-variant">
                        Puedes mover los nodos seleccionados juntos o eliminarlos en bloque.
                      </p>
                      <ul className="max-h-24 overflow-y-auto text-xs text-on-surface-variant">
                        {selectedNodes.slice(0, 8).map((node) => (
                          <li key={node.id}>
                            • {String(node.data?.title ?? node.data?.label ?? node.id)}
                          </li>
                        ))}
                        {selectedNodes.length > 8 ? <li>• ...</li> : null}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedNodes.length === 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => focusNode(selectedNode?.id ?? "")}
                          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:border-primary"
                        >
                          Centrar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNodeId(selectedNode?.id ?? null)}
                          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:border-primary"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => selectedNode && duplicateNode(selectedNode.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:border-primary"
                        >
                          Duplicar
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeNodes(selectedNodeIds)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50/50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:border-red-400 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300"
                    >
                      Eliminar selección
                    </button>
                  </div>
                </div>
              ) : null}

              {selectedEdges.length > 0 ? (
                <div className={`space-y-2 ${selectedNodes.length > 0 ? "border-t border-outline-variant pt-4" : ""}`}>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {selectedEdges.length === 1
                        ? selectedEdgeDetails?.label ?? "Conexión sin etiqueta"
                        : `${selectedEdges.length} conexiones seleccionadas`}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {selectedEdges.length === 1 && selectedEdgeDetails
                        ? `${selectedEdgeDetails.sourceLabel} → ${selectedEdgeDetails.targetLabel}`
                        : "Selección de líneas"}
                    </p>
                  </div>
                  {selectedEdges.length === 1 ? (
                    <p className="text-xs leading-relaxed text-on-surface-variant">
                      Selecciona la línea y pulsa <code>Backspace</code> o <code>Delete</code>, o elimínala
                      con el botón inferior.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs leading-relaxed text-on-surface-variant">
                        Puedes eliminar varias líneas a la vez.
                      </p>
                      <ul className="max-h-24 overflow-y-auto text-xs text-on-surface-variant">
                        {selectedEdges.slice(0, 8).map((edge) => {
                          const sourceNode = nodeLookup.get(edge.source);
                          const targetNode = nodeLookup.get(edge.target);
                          const sourceLabel = sourceNode ? getNodeDisplayName(sourceNode) : edge.source;
                          const targetLabel = targetNode ? getNodeDisplayName(targetNode) : edge.target;
                          const edgeLabel = String(edge.label ?? "").trim() || "Sin etiqueta";
                          return (
                            <li key={edge.id}>
                              • {edgeLabel} ({sourceLabel} → {targetLabel})
                            </li>
                          );
                        })}
                        {selectedEdges.length > 8 ? <li>• ...</li> : null}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => removeEdges(selectedEdgeIds)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50/50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:border-red-400 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300"
                    >
                      {selectedEdges.length === 1 ? "Eliminar conexión" : "Eliminar conexiones"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
              Haz clic sobre un nodo o una línea del lienzo para seleccionarlos y ver sus detalles.
              Las líneas también se pueden borrar con <code>Backspace</code> o <code>Delete</code>.
            </p>
          )}
        </div>
      </aside>

      {/* Canvas */}
      <section className="relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container shadow-elevation-1 flex flex-col min-h-[400px] lg:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-3 py-2 bg-surface/50">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/narratives"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
              title="Volver al listado"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                Narrative Builder
              </p>
              <h2 className="truncate text-sm font-semibold tracking-tight text-on-surface">
                {builder?.narrative.title ?? "Lienzo de Narrativa"}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badgeClassName("info")}`}>
                {builder?.narrative.status ?? "DRAFT"}
              </span>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badgeClassName("info")}`}>
                Borrador {versionLabel}
              </span>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badgeClassName(hasUnsavedChanges ? "warning" : "valid")}`}>
                {hasUnsavedChanges ? "Cambios sin guardar" : "Guardado local al día"}
              </span>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badgeClassName(hasUnpublishedChanges ? "warning" : "valid")}`}>
                {hasUnpublishedChanges ? "Cambios sin publicar" : "Draft alineado con publicada"}
              </span>
              <button
                type="button"
                onClick={() => setIsValidationPanelOpen((current) => !current)}
                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors hover:border-primary ${badgeClassName(effectiveValidation.valid ? "valid" : "warning")}`}
                title="Abrir panel de validación"
              >
                {effectiveValidation.valid ? "Validación OK" : `${validationIssues.length} observación(es)`}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void saveGraph()}
              disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-outline-variant bg-surface px-3 text-xs font-semibold text-on-surface transition-colors hover:border-primary disabled:opacity-70"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => void validateGraph()}
              disabled={working}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-outline-variant bg-surface px-3 text-xs font-semibold text-on-surface transition-colors hover:border-primary disabled:opacity-70"
            >
              <WandSparkles className="h-3.5 w-3.5" />
              Validar
            </button>
            <button
              type="button"
              onClick={() => autoLayoutNodes()}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-outline-variant bg-surface px-3 text-xs font-semibold text-on-surface transition-colors hover:border-primary"
              title="Auto organizar nodos"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Auto
            </button>
            <button
              type="button"
              onClick={duplicateFromPublished}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-outline-variant bg-surface px-3 text-xs font-semibold text-on-surface transition-colors hover:border-primary"
            >
              <CopyPlus className="h-3.5 w-3.5" />
              Copiar pub.
            </button>
            <button
              type="button"
              onClick={() => void publishGraph()}
              disabled={working}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-on-primary transition-transform hover:scale-[1.02] disabled:opacity-70"
            >
              <FileDown className="h-3.5 w-3.5" />
              Publicar
            </button>
          </div>
        </div>

        {message && (
          <div className="m-3 rounded-xl border border-outline-variant bg-surface px-4 py-2 text-sm text-on-surface-variant">
            {message}
          </div>
        )}

        <div className="flex-1 min-h-0 w-full">
          <ReactFlow
            nodes={flowNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onNodeDoubleClick={(_, node) => {
              setSelectedNodeId(node.id);
              setEditingNodeId(node.id);
            }}
            onSelectionChange={({ nodes: selectedFlowNodes, edges: selectedFlowEdges }) => {
              const ids = selectedFlowNodes.map((node) => node.id);
              const edgeIds = selectedFlowEdges.map((edge) => edge.id);
              setSelectedNodeIds((current) => (sameStringSet(current, ids) ? current : ids));
              setSelectedNodeId((current) => (current === ids[0] ? current : ids[0] ?? null));
              setSelectedEdgeIds((current) => (sameStringSet(current, edgeIds) ? current : edgeIds));
              setSelectedEdgeId((current) => (current === edgeIds[0] ? current : edgeIds[0] ?? null));
            }}
            onPaneClick={() => {
              setSelectedNodeIds((current) => (current.length === 0 ? current : []));
              setSelectedNodeId((current) => (current === null ? current : null));
              setSelectedEdgeIds((current) => (current.length === 0 ? current : []));
              setSelectedEdgeId((current) => (current === null ? current : null));
              setEditingNodeId(null);
            }}
            onDelete={({ nodes: deletedNodes, edges: deletedEdges }) => {
              if (deletedNodes.length === 0 && deletedEdges.length === 0) return;
              setSelectedNodeIds([]);
              setSelectedNodeId(null);
              setSelectedEdgeIds([]);
              setSelectedEdgeId(null);
            }}
            fitView
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            panOnDrag={false}
            edgesFocusable
            deleteKeyCode={["Backspace", "Delete"]}
            defaultEdgeOptions={{
              type: "smoothstep",
              style: { strokeWidth: 2 },
            }}
          >
            <MiniMap
              pannable
              zoomable
              className="!bg-surface-container"
              nodeColor={(node) => {
                const type = (node.data as FlowNodeData | undefined)?.nodeType;
                if (type === "AUDIO") return "#8b5cf6";
                if (type === "DECISION") return "#ec4899";
                if (type === "SCRIPT_TEXT") return "#0ea5e9";
                if (type === "INSTRUCTION") return "#f59e0b";
                if (type === "PAUSE") return "#64748b";
                if (type === "END") return "#ef4444";
                return "#10b981";
              }}
            />
            <Controls />
            <Background gap={20} size={1} />
          </ReactFlow>
        </div>

        {isValidationPanelOpen ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex justify-end">
            <div className="pointer-events-auto w-full max-w-5xl rounded-[28px] border border-outline-variant bg-surface/95 p-4 shadow-elevation-3 backdrop-blur-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                    Panel de validación
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Revisa issues, estado de publicación y detalle de versión sin salir del canvas.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void validateGraph()}
                    disabled={working}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 text-xs font-semibold text-on-surface transition-colors hover:border-primary disabled:opacity-70"
                  >
                    <WandSparkles className="h-3.5 w-3.5" />
                    Revalidar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsValidationPanelOpen(false)}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 text-xs font-semibold text-on-surface transition-colors hover:border-primary"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="mt-4 max-h-[65vh] overflow-y-auto pr-1">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                  <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                      Validación
                    </p>
                    <div className="mt-2 space-y-2 text-sm">
                      {effectiveValidation.valid ? (
                        <p className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />
                          La narrativa está lista para publicar.
                        </p>
                      ) : (
                        <p className="inline-flex items-center gap-2 text-amber-600 dark:text-amber-300">
                          <AlertCircle className="h-4 w-4" />
                          Hay observaciones que conviene resolver antes de publicar.
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${badgeClassName(effectiveValidation.valid ? "valid" : "warning")}`}>
                        {effectiveValidation.valid ? "Publicable" : "Requiere revisión"}
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${badgeClassName(hasUnsavedChanges ? "warning" : "valid")}`}>
                        {hasUnsavedChanges ? "Pendiente de guardar" : "Sin cambios locales pendientes"}
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${badgeClassName(groupedValidation.errors.length > 0 ? "error" : "valid")}`}>
                        {groupedValidation.errors.length} error(es)
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${badgeClassName(groupedValidation.warnings.length > 0 ? "warning" : "valid")}`}>
                        {groupedValidation.warnings.length} advertencia(s)
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${badgeClassName("info")}`}>
                        {groupedValidation.suggestions.length} sugerencia(s)
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                      Detalle de versión
                    </p>
                    <div className="mt-2 text-sm text-on-surface-variant">
                      {selectedVersion ? (
                        <div className="space-y-1">
                          <p>
                            <span className="font-semibold text-on-surface">Versión:</span>{" "}
                            v{selectedVersion.versionNumber} · {selectedVersion.status}
                          </p>
                          <p>
                            <span className="font-semibold text-on-surface">Versión publicada:</span>{" "}
                            {builder?.publishedVersion
                              ? `v${builder.publishedVersion.versionNumber}`
                              : "Aún no existe"}
                          </p>
                          <p>
                            <span className="font-semibold text-on-surface">Estado narrativa:</span>{" "}
                            {builder?.narrative.status}
                          </p>
                          <p>
                            <span className="font-semibold text-on-surface">Última actualización:</span>{" "}
                            {builder?.narrative.updatedAt
                              ? new Date(builder.narrative.updatedAt).toLocaleString("es-CO")
                              : "Sin registro"}
                          </p>
                          <p>
                            <span className="font-semibold text-on-surface">Publicación pendiente:</span>{" "}
                            {hasUnpublishedChanges ? "Sí" : "No"}
                          </p>
                        </div>
                      ) : (
                        <p>Sin versión cargada.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                    Diff contra publicada
                  </p>
                  <div className="mt-3 grid gap-2 text-sm text-on-surface-variant md:grid-cols-5">
                    <p><span className="font-semibold text-on-surface">Nodos +:</span> {publishDiff.addedNodes}</p>
                    <p><span className="font-semibold text-on-surface">Nodos ~:</span> {publishDiff.modifiedNodes}</p>
                    <p><span className="font-semibold text-on-surface">Nodos -:</span> {publishDiff.removedNodes}</p>
                    <p><span className="font-semibold text-on-surface">Rutas +:</span> {publishDiff.addedEdges}</p>
                    <p><span className="font-semibold text-on-surface">Rutas -:</span> {publishDiff.removedEdges}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-3">
                  {([
                    ["Errores críticos", groupedValidation.errors, "error"],
                    ["Advertencias", groupedValidation.warnings, "warning"],
                    ["Sugerencias", groupedValidation.suggestions, "suggestion"],
                  ] as const).map(([title, issues, level]) => (
                    <div key={title} className="rounded-2xl border border-outline-variant bg-surface-container px-3 py-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-on-surface">{title}</p>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClassName(issueTone(level))}`}>
                          {issues.length}
                        </span>
                      </div>

                      {issues.length === 0 ? (
                        <p className="text-xs text-on-surface-variant">
                          {level === "error"
                            ? "Sin bloqueos de publicación."
                            : level === "warning"
                              ? "Sin advertencias activas."
                              : "Sin sugerencias por ahora."}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {issues.map((issue) => {
                            const Icon = issueIcon(issue.level);

                            return (
                              <div
                                key={issue.id}
                                className="rounded-xl border border-outline-variant bg-surface px-3 py-3"
                              >
                                <div className="flex items-start gap-2">
                                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm text-on-surface">{issue.message}</p>
                                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
                                      <span>{issue.issueType}</span>
                                      {issue.nodeLabel ? <span>{issue.nodeLabel}</span> : null}
                                      <span>{issue.source === "backend" ? "backend" : "builder"}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {issue.nodeId ? (
                                    <button
                                      type="button"
                                      onClick={() => focusNode(issue.nodeId!)}
                                      className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:border-primary"
                                    >
                                      Ir al nodo
                                    </button>
                                  ) : null}
                                  {issue.nodeId ? (
                                    <button
                                      type="button"
                                      onClick={() => focusNode(issue.nodeId!, { openEditor: true })}
                                      className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:border-primary"
                                    >
                                      Editar nodo
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {modalPanel}
    </div>
  );
}

export function NarrativeBuilderCanvasShell({ narrativeId }: BuilderProps) {
  return (
    <ReactFlowProvider>
      <NarrativeBuilderCanvas narrativeId={narrativeId} />
    </ReactFlowProvider>
  );
}
