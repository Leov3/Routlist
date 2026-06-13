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
  ReactFlowProvider,
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
  NarrativeBuilderState,
  NarrativeGraphJson,
  NarrativeNodeType,
  NarrativeVersion,
} from "@/types/narratives";

type BuilderProps = {
  narrativeId: string;
};

type FlowNodeData = {
  title?: string;
  label?: string;
  body?: string;
  question?: string;
  instruction?: string;
  nodeType: NarrativeNodeType;
  audioAssetId?: string;
  audioButtonId?: string;
  description?: string;
  required?: boolean;
  allowReplay?: boolean;
  operatorNotes?: string;
  notes?: string;
  pauseType?: string;
  durationSeconds?: string | number;
  manual?: boolean;
  options?: string;
};

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
  { type: "SCRIPT_TEXT", label: "Texto / Guion", description: "Texto para leer al aire.", accent: "from-sky-500 to-cyan-500" },
  { type: "INSTRUCTION", label: "Instrucción", description: "Paso operativo interno.", accent: "from-amber-500 to-orange-500" },
  { type: "PAUSE", label: "Pausa", description: "Esperar o pausar manualmente.", accent: "from-slate-500 to-slate-700" },
  { type: "DECISION", label: "Decisión", description: "Ramificación con opciones.", accent: "from-pink-500 to-rose-500" },
  { type: "END", label: "Fin", description: "Cierre del flujo.", accent: "from-red-500 to-rose-500" },
];

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
    options: "Sí|No",
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

import dagre from "dagre";

function autoLayout(nodes: Node<FlowNodeData>[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 100, nodesep: 50 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 240, height: 100 });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - 120,
        y: pos.y - 50,
      },
    };
  });
}

function nodeSummary(node: Node<FlowNodeData>) {
  const nodeType = (node.data?.nodeType ?? node.type) as NarrativeNodeType;
  const data = node.data ?? { nodeType };
  if (nodeType === "AUDIO") return data.audioAssetId ? `Audio: ${String(data.audioAssetId)}` : "Audio sin asignar";
  if (nodeType === "AUDIO_BUTTON") return data.audioButtonId ? `Botón: ${String(data.audioButtonId)}` : "Botón sin asignar";
  if (nodeType === "SCRIPT_TEXT") return data.body ? String(data.body).slice(0, 80) : "Sin texto";
  if (nodeType === "INSTRUCTION") return data.instruction ? String(data.instruction).slice(0, 80) : "Sin instrucción";
  if (nodeType === "PAUSE") return data.manual === false ? `Temporizada${data.durationSeconds ? ` · ${data.durationSeconds}s` : ""}` : "Pausa manual";
  if (nodeType === "DECISION") return data.question ? String(data.question) : "Sin pregunta";
  return NODE_PALETTE.find((item) => item.type === nodeType)?.description || "";
}

function nodeClassName(nodeType: NarrativeNodeType) {
  switch (nodeType) {
    case "START":
      return "border-emerald-300 bg-emerald-500/15 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-500/15 dark:text-emerald-100";
    case "AUDIO":
      return "border-violet-300 bg-violet-500/15 text-violet-950 dark:border-violet-900/60 dark:bg-violet-500/15 dark:text-violet-100";
    case "AUDIO_BUTTON":
      return "border-indigo-300 bg-indigo-500/15 text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-500/15 dark:text-indigo-100";
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
  const summary = nodeSummary({ data: flowData, type: nodeType } as Node<FlowNodeData>);

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
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-75">{nodeType}</p>
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="mt-1 line-clamp-2 text-xs opacity-80">{summary}</p>
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

function updateNodeData(node: Node<FlowNodeData>, patch: Record<string, unknown>) {
  return {
    ...node,
    data: {
      ...(node.data ?? { nodeType: node.type as NarrativeNodeType }),
      ...patch,
    },
  };
}

export function NarrativeBuilderCanvas({ narrativeId }: BuilderProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [builder, setBuilder] = useState<NarrativeBuilderState | null>(null);
  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] }>({
    valid: true,
    errors: [],
  });
  const [audios, setAudios] = useState<{ id: string; name: string }[]>([]);
  const [buttons, setButtons] = useState<{ id: string; label: string; category?: { name: string } }[]>([]);

  const editingNode = useMemo(
    () => nodes.find((node) => node.id === editingNodeId) ?? null,
    [nodes, editingNodeId],
  );

  const selectedVersion = builder?.draftVersion ?? builder?.publishedVersion ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [result, audiosRes, buttonsRes] = await Promise.all([
        api<NarrativeBuilderState>(`/narratives/${narrativeId}/builder`),
        api<any>("/audio-assets").catch(() => []),
        api<any>("/audio-buttons").catch(() => []),
      ]);
      
      setBuilder(result);
      setAudios(Array.isArray(audiosRes) ? audiosRes : ((audiosRes as any).data || (audiosRes as any).items || []));
      setButtons(Array.isArray(buttonsRes) ? buttonsRes : ((buttonsRes as any).data || (buttonsRes as any).items || []));
      
      const graph = graphFromVersions(result.draftVersion ?? result.publishedVersion);

      setNodes(
        graph.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position ?? { x: 120, y: 120 },
          data: {
            nodeType: node.type,
            ...(node.data ?? {}),
          } as FlowNodeData,
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
      if (graph.nodes.length > 0) {
        setSelectedNodeId(graph.nodes[0].id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la narrativa.");
      setBuilder(null);
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  }, [narrativeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const nodeTypes = useMemo<NodeTypes>(() => ({ narrative: NarrativeFlowNode }), []);

  const flowNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        type: "narrative",
      })),
    [nodes],
  );

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
    setSelectedNodeId(id);
  }

  function saveNodePatch(nodeId: string, patch: Record<string, unknown>) {
    setNodes((current) =>
      current.map((node) => (node.id === nodeId ? updateNodeData(node, patch) : node)),
    );
  }

  const onNodesChange = useCallback((changes: Parameters<typeof applyNodeChanges>[0]) => {
    setNodes((current) => applyNodeChanges(changes as never, current as never) as Node<FlowNodeData>[]);
  }, []);

  const onEdgesChange = useCallback((changes: Parameters<typeof applyEdgeChanges>[0]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  function removeNode(nodeId: string) {
    if (window.confirm("¿Seguro que deseas eliminar este nodo?")) {
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    }
  }

  function autoLayoutNodes() {
    setNodes((current) => autoLayout(current, edges));
  }

  const onConnect = useCallback((connection: Connection) => {
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const defaultLabel = sourceNode?.data?.nodeType === "DECISION" ? "Opción" : "Siguiente";
    const label = window.prompt("Etiqueta de la conexión", defaultLabel)?.trim();

    setEdges((current) =>
      addEdge(
        {
          ...connection,
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label: label || defaultLabel,
          type: "smoothstep",
        },
        current,
      ),
    );
  }, [nodes]);

  async function saveGraph() {
    setSaving(true);
    setMessage(null);

    try {
      const graphJson: NarrativeGraphJson = {
        nodes: nodes.map((node) => ({
          id: node.id,
          type: (node.data?.nodeType ?? node.type) as NarrativeNodeType,
          position: node.position,
          data: { ...(node.data ?? {}) },
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
              data: { ...(node.data ?? {}) },
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
        data: { nodeType: node.type, ...(node.data ?? {}) } as FlowNodeData,
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
    setMessage("Se copió la versión publicada al borrador local.");
  }

  const modalPanel = editingNode ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-surface-container p-6 shadow-elevation-3 border border-outline-variant">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Configurar Nodo
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-on-surface">
              {editingNode.data?.nodeType}
            </h2>
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

          {editingNode.data?.nodeType === "AUDIO" && (
            <>
              <label className="grid gap-1.5">
                <FieldLabel>Audio a reproducir</FieldLabel>
                <select
                  value={String(editingNode.data.audioAssetId ?? "")}
                  onChange={(event) => saveNodePatch(editingNode.id, { audioAssetId: event.target.value })}
                  className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Selecciona un audio...</option>
                  {audios.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <FieldLabel>Descripción</FieldLabel>
                <textarea
                  value={String(editingNode.data.description ?? "")}
                  onChange={(event) => saveNodePatch(editingNode.id, { description: event.target.value })}
                  className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="grid gap-1.5">
                <FieldLabel>Notas para operador</FieldLabel>
                <textarea
                  value={String(editingNode.data.operatorNotes ?? "")}
                  onChange={(event) => saveNodePatch(editingNode.id, { operatorNotes: event.target.value })}
                  className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
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
            </>
          )}

          {editingNode.data?.nodeType === "AUDIO_BUTTON" && (
            <>
              <label className="grid gap-1.5">
                <FieldLabel>Botón a reproducir</FieldLabel>
                <select
                  value={String(editingNode.data.audioButtonId ?? "")}
                  onChange={(event) => saveNodePatch(editingNode.id, { audioButtonId: event.target.value })}
                  className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Selecciona un botón...</option>
                  {buttons.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.label} {b.category?.name ? `(${b.category.name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <FieldLabel>Notas para operador</FieldLabel>
                <textarea
                  value={String(editingNode.data.operatorNotes ?? "")}
                  onChange={(event) => saveNodePatch(editingNode.id, { operatorNotes: event.target.value })}
                  className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <BooleanPill
                value={Boolean(editingNode.data.required)}
                onChange={(value) => saveNodePatch(editingNode.id, { required: value })}
                label="Obligatorio"
              />
            </>
          )}

          {editingNode.data?.nodeType === "SCRIPT_TEXT" && (
            <>
              <label className="grid gap-1.5">
                <FieldLabel>Texto del guion</FieldLabel>
                <textarea
                  value={String(editingNode.data.body ?? "")}
                  onChange={(event) => saveNodePatch(editingNode.id, { body: event.target.value })}
                  className="min-h-28 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="grid gap-1.5">
                <FieldLabel>Notas internas</FieldLabel>
                <textarea
                  value={String(editingNode.data.notes ?? "")}
                  onChange={(event) => saveNodePatch(editingNode.id, { notes: event.target.value })}
                  className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <BooleanPill
                value={Boolean(editingNode.data.required)}
                onChange={(value) => saveNodePatch(editingNode.id, { required: value })}
                label="Obligatorio"
              />
            </>
          )}

          {editingNode.data?.nodeType === "INSTRUCTION" && (
            <>
              <label className="grid gap-1.5">
                <FieldLabel>Instrucción</FieldLabel>
                <textarea
                  value={String(editingNode.data.instruction ?? "")}
                  onChange={(event) => saveNodePatch(editingNode.id, { instruction: event.target.value })}
                  className="min-h-28 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="grid gap-1.5">
                <FieldLabel>Notas internas</FieldLabel>
                <textarea
                  value={String(editingNode.data.notes ?? "")}
                  onChange={(event) => saveNodePatch(editingNode.id, { notes: event.target.value })}
                  className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
            </>
          )}

          {editingNode.data?.nodeType === "PAUSE" && (
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
          )}

          {editingNode.data?.nodeType === "DECISION" && (
            <>
              <label className="grid gap-1.5">
                <FieldLabel>Pregunta</FieldLabel>
                <textarea
                  value={String(editingNode.data.question ?? "")}
                  onChange={(event) => saveNodePatch(editingNode.id, { question: event.target.value })}
                  className="min-h-24 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="grid gap-1.5">
                <FieldLabel>Opciones separadas por |</FieldLabel>
                <textarea
                  value={String(editingNode.data.options ?? "")}
                  onChange={(event) => saveNodePatch(editingNode.id, { options: event.target.value })}
                  className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="grid gap-1.5">
                <FieldLabel>Notas para operador</FieldLabel>
                <textarea
                  value={String(editingNode.data.operatorNotes ?? "")}
                  onChange={(event) => saveNodePatch(editingNode.id, { operatorNotes: event.target.value })}
                  className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
            </>
          )}

          {editingNode.data?.nodeType === "START" && (
            <p className="text-sm text-on-surface-variant">
              El nodo de inicio no recibe entradas y debe conectar al primer paso del flujo.
            </p>
          )}

          {editingNode.data?.nodeType === "END" && (
            <p className="text-sm text-on-surface-variant">
              El nodo final cierra la narrativa y no debe tener salidas.
            </p>
          )}
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

        <div className="space-y-1.5">
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

        <div className="rounded-xl border border-outline-variant bg-surface px-3 py-2 mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Estado
          </p>
          <div className="mt-1.5 grid gap-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Versión</span>
              <span className="font-semibold text-on-surface">
                {selectedVersion ? `v${selectedVersion.versionNumber}` : "Ninguna"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Nodos</span>
              <span className="font-semibold text-on-surface">{nodes.length}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Canvas */}
      <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container shadow-elevation-1 flex flex-col min-h-[400px] lg:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-3 py-2 bg-surface/50">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/narratives"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
              title="Volver al listado"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h2 className="text-sm font-semibold tracking-tight text-on-surface">
              Lienzo de Narrativa
            </h2>
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
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onNodeDoubleClick={(_, node) => setEditingNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
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

        <div className="border-t border-outline-variant px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Validación
              </p>
              <div className="mt-2 space-y-2 text-sm">
                {validation.valid ? (
                  <p className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    La narrativa está lista para publicar.
                  </p>
                ) : (
                  <p className="inline-flex items-center gap-2 text-amber-600 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4" />
                    Hay observaciones antes de publicar.
                  </p>
                )}
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
                      <span className="font-semibold text-on-surface">Estado narrativa:</span>{" "}
                      {builder?.narrative.status}
                    </p>
                  </div>
                ) : (
                  <p>Sin versión cargada.</p>
                )}
              </div>
            </div>
          </div>

          {!validation.valid && validation.errors.length > 0 && (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
              <p className="mb-1 font-semibold">Correcciones pendientes</p>
              <ul className="list-disc space-y-1 pl-5">
                {validation.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
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
