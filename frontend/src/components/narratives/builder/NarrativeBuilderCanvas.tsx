"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
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
  Layers3,
  Plus,
  Save,
  Sparkles,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  NarrativeBuilderState,
  NarrativeGraphEdge,
  NarrativeGraphJson,
  NarrativeGraphNode,
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

function nodeTitle(node: Node<FlowNodeData>) {
  const nodeType = (node.data?.nodeType ?? node.type) as NarrativeNodeType;
  const data = node.data ?? { nodeType };
  return data.title || data.label || NODE_PALETTE.find((item) => item.type === nodeType)?.label || nodeType;
}

function nodeSummary(node: Node<FlowNodeData>) {
  const nodeType = (node.data?.nodeType ?? node.type) as NarrativeNodeType;
  const data = node.data ?? { nodeType };
  if (nodeType === "AUDIO") return data.audioAssetId ? `Audio: ${String(data.audioAssetId)}` : "Audio sin asignar";
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
  const [message, setMessage] = useState<string | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] }>({
    valid: true,
    errors: [],
  });

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const selectedVersion = builder?.draftVersion ?? builder?.publishedVersion ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const result = await api<NarrativeBuilderState>(`/narratives/${narrativeId}/builder`);
      setBuilder(result);
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

  const inspectorPanel = selectedNode ? (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-on-surface">Inspector</h3>
        <p className="text-sm text-on-surface-variant">{selectedNode.data?.nodeType}</p>
      </div>

      <label className="grid gap-1.5">
        <FieldLabel>Título / etiqueta</FieldLabel>
        <input
          value={String(selectedNode.data?.title ?? selectedNode.data?.label ?? "")}
          onChange={(event) =>
            saveNodePatch(selectedNode.id, {
              title: event.target.value,
              label: event.target.value,
            })
          }
          className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
        />
      </label>

      {selectedNode.data?.nodeType === "AUDIO" && (
        <>
          <label className="grid gap-1.5">
            <FieldLabel>Audio ID</FieldLabel>
            <input
              value={String(selectedNode.data.audioAssetId ?? "")}
              onChange={(event) => saveNodePatch(selectedNode.id, { audioAssetId: event.target.value })}
              placeholder="audio-uuid"
              className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1.5">
            <FieldLabel>Descripción</FieldLabel>
            <textarea
              value={String(selectedNode.data.description ?? "")}
              onChange={(event) => saveNodePatch(selectedNode.id, { description: event.target.value })}
              className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1.5">
            <FieldLabel>Notas para operador</FieldLabel>
            <textarea
              value={String(selectedNode.data.operatorNotes ?? "")}
              onChange={(event) => saveNodePatch(selectedNode.id, { operatorNotes: event.target.value })}
              className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <BooleanPill
              value={Boolean(selectedNode.data.required)}
              onChange={(value) => saveNodePatch(selectedNode.id, { required: value })}
              label="Obligatorio"
            />
            <BooleanPill
              value={Boolean(selectedNode.data.allowReplay)}
              onChange={(value) => saveNodePatch(selectedNode.id, { allowReplay: value })}
              label="Permitir repetir"
            />
          </div>
        </>
      )}

      {selectedNode.data?.nodeType === "SCRIPT_TEXT" && (
        <>
          <label className="grid gap-1.5">
            <FieldLabel>Texto del guion</FieldLabel>
            <textarea
              value={String(selectedNode.data.body ?? "")}
              onChange={(event) => saveNodePatch(selectedNode.id, { body: event.target.value })}
              className="min-h-28 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1.5">
            <FieldLabel>Notas internas</FieldLabel>
            <textarea
              value={String(selectedNode.data.notes ?? "")}
              onChange={(event) => saveNodePatch(selectedNode.id, { notes: event.target.value })}
              className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <BooleanPill
            value={Boolean(selectedNode.data.required)}
            onChange={(value) => saveNodePatch(selectedNode.id, { required: value })}
            label="Obligatorio"
          />
        </>
      )}

      {selectedNode.data?.nodeType === "INSTRUCTION" && (
        <>
          <label className="grid gap-1.5">
            <FieldLabel>Instrucción</FieldLabel>
            <textarea
              value={String(selectedNode.data.instruction ?? "")}
              onChange={(event) => saveNodePatch(selectedNode.id, { instruction: event.target.value })}
              className="min-h-28 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1.5">
            <FieldLabel>Notas internas</FieldLabel>
            <textarea
              value={String(selectedNode.data.notes ?? "")}
              onChange={(event) => saveNodePatch(selectedNode.id, { notes: event.target.value })}
              className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        </>
      )}

      {selectedNode.data?.nodeType === "PAUSE" && (
        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <FieldLabel>Tipo de pausa</FieldLabel>
            <select
              value={String(selectedNode.data.pauseType ?? "manual")}
              onChange={(event) => saveNodePatch(selectedNode.id, { pauseType: event.target.value })}
              className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option value="manual">Manual</option>
              <option value="timer">Temporizada</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <FieldLabel>Duración en segundos</FieldLabel>
            <input
              value={String(selectedNode.data.durationSeconds ?? "")}
              onChange={(event) => saveNodePatch(selectedNode.id, { durationSeconds: event.target.value })}
              type="number"
              min="0"
              className="h-10 rounded-2xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <BooleanPill
            value={Boolean(selectedNode.data.manual)}
            onChange={(value) => saveNodePatch(selectedNode.id, { manual: value })}
            label="Pausa manual"
          />
        </div>
      )}

      {selectedNode.data?.nodeType === "DECISION" && (
        <>
          <label className="grid gap-1.5">
            <FieldLabel>Pregunta</FieldLabel>
            <textarea
              value={String(selectedNode.data.question ?? "")}
              onChange={(event) => saveNodePatch(selectedNode.id, { question: event.target.value })}
              className="min-h-24 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1.5">
            <FieldLabel>Opciones separadas por |</FieldLabel>
            <textarea
              value={String(selectedNode.data.options ?? "")}
              onChange={(event) => saveNodePatch(selectedNode.id, { options: event.target.value })}
              className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1.5">
            <FieldLabel>Notas para operador</FieldLabel>
            <textarea
              value={String(selectedNode.data.operatorNotes ?? "")}
              onChange={(event) => saveNodePatch(selectedNode.id, { operatorNotes: event.target.value })}
              className="min-h-20 rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        </>
      )}

      {selectedNode.data?.nodeType === "START" && (
        <p className="text-sm text-on-surface-variant">
          El nodo de inicio no recibe entradas y debe conectar al primer paso del flujo.
        </p>
      )}

      {selectedNode.data?.nodeType === "END" && (
        <p className="text-sm text-on-surface-variant">
          El nodo final cierra la narrativa y no debe tener salidas.
        </p>
      )}
    </div>
  ) : (
    <div className="rounded-2xl border border-dashed border-outline-variant p-5 text-sm text-on-surface-variant">
      Selecciona un nodo para editar sus propiedades.
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-[28px] border border-outline-variant bg-surface-container text-sm text-on-surface-variant">
        Cargando builder de narrativa...
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
      {/* Palette */}
      <aside className="space-y-4 rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
            Biblioteca
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-on-surface">
            Nodos
          </h2>
        </div>

        <div className="space-y-2">
          {NODE_PALETTE.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => addNode(item.type)}
              className="group flex w-full items-start gap-3 rounded-2xl border border-outline-variant bg-surface px-3 py-3 text-left transition-colors hover:border-primary"
            >
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-elevation-1`}>
                <Plus className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-on-surface">{item.label}</span>
                <span className="block text-xs text-on-surface-variant">{item.description}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
            Estado
          </p>
          <div className="mt-2 grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Versión</span>
              <span className="font-semibold text-on-surface">
                {selectedVersion ? `v${selectedVersion.versionNumber}` : "Sin versión"}
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
      </aside>

      {/* Canvas */}
      <section className="overflow-hidden rounded-[28px] border border-outline-variant bg-surface-container shadow-elevation-1">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Canvas
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-on-surface">
              Builder visual
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void saveGraph()}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:opacity-70"
            >
              <Save className="h-4 w-4" />
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => void validateGraph()}
              disabled={working}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary disabled:opacity-70"
            >
              <WandSparkles className="h-4 w-4" />
              Validar
            </button>
            <button
              type="button"
              onClick={() => void publishGraph()}
              disabled={working}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-on-primary transition-transform hover:scale-[1.01] disabled:opacity-70"
            >
              <FileDown className="h-4 w-4" />
              Publicar
            </button>
            <button
              type="button"
              onClick={duplicateFromPublished}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
            >
              <CopyPlus className="h-4 w-4" />
              Copiar publicada
            </button>
          </div>
        </div>

        {message && (
          <div className="m-4 rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface-variant">
            {message}
          </div>
        )}

        <div className="h-[760px]">
          <ReactFlow
            nodes={flowNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
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

      {/* Inspector */}
      <aside className="space-y-4 rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
            Propiedades
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-on-surface">
            Inspector
          </h2>
        </div>

        {inspectorPanel}
      </aside>
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
