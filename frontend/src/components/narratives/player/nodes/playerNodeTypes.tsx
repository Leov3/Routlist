"use client";

import { createContext, useContext, type MouseEvent, type ReactNode } from "react";
import { Handle, Position, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  Ellipsis,
  FileText,
  Flag,
  Pause,
  Play,
  Split,
  Square,
  Volume2,
  WandSparkles,
} from "lucide-react";
import type { NarrativeNodeType } from "@/types/narratives";

export type PlayerNodeState =
  | "current"
  | "completed"
  | "available"
  | "locked"
  | "skipped"
  | "error"
  | "decision-selected";

export type DecisionChoice = {
  label: string;
  targetNodeId: string;
};

export type AudioPlaybackState = "idle" | "playing" | "paused" | "stopped";

export type PlayerFlowNodeData = {
  id: string;
  label: string;
  summary: string;
  status: PlayerNodeState;
  type: NarrativeNodeType;
  nodeData?: any;
  audioButtonId?: string;
  audioAssetId?: string;
  template?: string;
  variables?: string[];
  voiceId?: string;
  modelId?: string;
  outputFormat?: string;
  stability?: number | string;
  similarityBoost?: number | string;
  style?: number | string;
  speed?: number | string;
  speakerBoost?: boolean;
  isRequired?: boolean;
  decisionChoices?: DecisionChoice[];
  audioButtonDetail?: AudioButtonDetail | null;
};

export type AudioButtonDetail = {
  id?: string;
  label?: string;
  category?: { name?: string } | null;
  shortcutKey?: string | null;
  description?: string | null;
  color?: string | null;
  audioAsset?: { originalName?: string | null } | null;
  audioAssetId?: string | null;
  imageUrl?: string | null;
  imagePublicUrl?: string | null;
};

export type NarrativePlayerContextType = {
  playbackState: AudioPlaybackState;
  working: boolean;
  currentNodeId: string | null;
  selectedNodeId: string | null;
  zoom: number;
  startAudioPlayback: (overrideNodeId?: string) => Promise<void>;
  pauseAudio: () => void;
  resumeAudio: () => void;
  stopAudio: () => void;
  completeCurrentNode: (skip?: boolean) => Promise<void>;
  finishRun: () => Promise<void>;
  copyNodeText: (nodeId: string) => Promise<void>;
  chooseDecision: (targetNodeId: string, label: string) => Promise<void>;
  setMessage: (msg: string | null) => void;
  selectNode: (nodeId: string) => void;
  openNodeMenu: (nodeId: string) => void;
  openNodeDetails: (nodeId: string) => void;
};

export const NarrativePlayerContext = createContext<NarrativePlayerContextType | null>(null);

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

function nodeTextPreview(value: unknown, fallback = "Sin contenido", limit = 160) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function nodeTypeLabel(type: NarrativeNodeType) {
  return {
    START: "Inicio",
    AUDIO: "Audio",
    AUDIO_BUTTON: "Botonera",
    DYNAMIC_AUDIO: "Audio IA",
    SCRIPT_TEXT: "Guion",
    INSTRUCTION: "Instrucción",
    PAUSE: "Pausa",
    DECISION: "Decisión",
    END: "Fin",
  }[type];
}

function zoomMode(zoom: number) {
  if (zoom < 0.65) return "far";
  if (zoom < 1) return "medium";
  return "close";
}

function nodeDetailTitle(data: PlayerFlowNodeData) {
  return String(data.label ?? data.nodeData?.title ?? data.nodeData?.label ?? "").trim() || nodeTypeLabel(data.type);
}

function nodeDetailPreview(data: PlayerFlowNodeData) {
  const candidates = [
    data.summary,
    data.nodeData?.description,
    data.template,
    data.nodeData?.body,
    data.nodeData?.instruction,
    data.nodeData?.question,
    data.nodeData?.text,
  ];
  const found = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return nodeTextPreview(found, "Sin vista previa", 180);
}

function nodeMetaLine(data: PlayerFlowNodeData) {
  if (data.type === "AUDIO_BUTTON") {
    const category = data.audioButtonDetail?.category?.name ?? data.nodeData?.categoryName ?? "Botonera";
    return String(category);
  }
  if (data.type === "AUDIO") {
    return data.audioAssetId ? "Audio asociado" : "Sin audio";
  }
  if (data.type === "DYNAMIC_AUDIO") {
    const parts = [data.voiceId ? "Voz definida" : "", data.modelId ? "Modelo definido" : ""].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Audio dinámico";
  }
  if (data.type === "PAUSE") {
    return data.nodeData?.manual === false && data.nodeData?.durationSeconds
      ? `${String(data.nodeData.durationSeconds)} s`
      : "Pausa manual";
  }
  if (data.type === "DECISION") {
    const choices = data.decisionChoices?.length ?? readDecisionLabels(data.nodeData?.options).length;
    return choices ? `${choices} opción${choices === 1 ? "" : "es"}` : "Sin opciones";
  }
  return data.summary ? nodeTextPreview(data.summary, "", 80) : "";
}

function statusLabel(status: PlayerNodeState) {
  if (status === "current") return "Actual";
  if (status === "completed") return "Completado";
  if (status === "available") return "Disponible";
  if (status === "error") return "Error";
  if (status === "decision-selected") return "Elegido";
  if (status === "skipped") return "Omitido";
  return "Bloqueado";
}

function statusTone(status: PlayerNodeState) {
  if (status === "current") return "border-primary/30 bg-primary-container text-on-primary-container";
  if (status === "completed") return "success-surface";
  if (status === "error") return "danger-surface";
  if (status === "decision-selected") return "border-secondary/30 bg-secondary-container text-on-secondary-container";
  if (status === "available") return "border-outline-variant bg-surface-container-high text-on-surface";
  if (status === "locked") return "border-outline-variant bg-surface-container text-on-surface-variant";
  return "border-outline-variant bg-surface-container text-on-surface-variant";
}

function nodeFrame(status: PlayerNodeState, selected?: boolean, extra = "") {
  const selectedRing = selected ? "ring-2 ring-primary/80 ring-offset-2 ring-offset-surface " : "";
  const statusFrame =
    status === "current"
      ? "border-primary/50 shadow-[0_0_32px_rgba(124,58,237,0.18)] ring-4 ring-primary/25 scale-[1.02]"
      : status === "completed"
        ? "border-[color:var(--success-border)] shadow-[0_18px_34px_rgba(16,185,129,0.08)]"
        : status === "error"
          ? "border-[color:var(--danger-border)] shadow-[0_18px_34px_rgba(239,68,68,0.12)]"
          : status === "locked"
            ? "border-outline-variant opacity-75"
            : "border-outline-variant";
  return `group relative transition-all duration-300 hover:scale-[1.018] ${selectedRing}${statusFrame} ${extra}`;
}

function StateBadge({ status }: { status: PlayerNodeState }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusTone(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function NodeActionButton({ id }: { id: string }) {
  const ctx = useContext(NarrativePlayerContext);
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        ctx?.openNodeMenu(id);
      }}
      className="nodrag absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant opacity-90 backdrop-blur transition hover:border-primary hover:text-on-surface group-hover:opacity-100 dark:border-white/10 dark:bg-black/35 dark:text-slate-300"
      aria-label="Abrir acciones"
    >
      <Ellipsis className="h-4 w-4" />
    </button>
  );
}

function NodeTypeBadge({ type }: { type: NarrativeNodeType }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[color:inherit]">
      {nodeTypeLabel(type)}
    </span>
  );
}

function PrimaryButton({
  children,
  disabled,
  tone = "primary",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  tone?: "primary" | "emerald" | "amber" | "purple" | "slate";
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const className =
    tone === "emerald"
      ? "success-surface-strong text-on-surface"
      : tone === "amber"
        ? "warning-surface-strong text-on-surface"
        : tone === "purple"
          ? "border border-primary/25 bg-primary-container text-on-primary-container hover:bg-primary-container/90"
          : tone === "slate"
            ? "border border-outline-variant bg-surface-container-high text-on-surface hover:border-primary/40"
            : "bg-primary text-on-primary hover:bg-primary/90";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick(event);
      }}
      className={`nodrag inline-flex items-center justify-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-black shadow-elevation-2 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function HiddenHandles({ source = true, target = true }: { source?: boolean; target?: boolean }) {
  return (
    <>
      {target ? <Handle type="target" position={Position.Top} className="!opacity-0" /> : null}
      {source ? <Handle type="source" position={Position.Bottom} className="!opacity-0" /> : null}
    </>
  );
}

export function PlayerStartNode({ data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const mode = zoomMode(ctx?.zoom ?? 1);
  return (
    <div className={nodeFrame(data.status, selected, "w-[240px] min-h-[96px] rounded-[28px] border-2 success-surface p-4 text-on-surface")}>
      <HiddenHandles target={false} />
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--success-border)] bg-[color:var(--success-bg-strong)] text-[color:var(--success-icon)]">
          <Flag className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <NodeTypeBadge type={data.type} />
            <StateBadge status={data.status} />
          </div>
          <p className="mt-2 line-clamp-2 text-[15px] font-black leading-tight text-on-surface">Comenzar narrativa</p>
          {mode !== "far" ? <p className="mt-1 text-xs font-semibold text-on-surface-variant">Arranque del flujo guiado</p> : null}
        </div>
      </div>
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerEndNode({ data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const mode = zoomMode(ctx?.zoom ?? 1);
  return (
    <div className={nodeFrame(data.status, selected, "w-[240px] min-h-[96px] rounded-[28px] border-2 success-surface p-4 text-on-surface")}>
      <HiddenHandles source={false} />
      <div className="flex items-start gap-3 pr-8">
        <div className="success-surface flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <NodeTypeBadge type={data.type} />
            <StateBadge status={data.status} />
          </div>
          <p className="mt-2 line-clamp-2 text-[15px] font-black leading-tight text-on-surface">{data.label || "Cierre de narrativa"}</p>
          {mode !== "far" ? <p className="mt-1 text-xs font-semibold text-on-surface-variant">Cierre de la ejecución</p> : null}
          <div className="mt-3">
            <PrimaryButton tone="emerald" onClick={() => void ctx?.finishRun()}>
              <CheckCircle2 className="h-4 w-4" />
              Finalizar
            </PrimaryButton>
          </div>
        </div>
      </div>
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerAudioButtonNode({ id, data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const mode = zoomMode(ctx?.zoom ?? 1);
  const isPlaying = ctx?.playbackState === "playing" && ctx?.currentNodeId === id;
  const isPaused = ctx?.playbackState === "paused" && ctx?.currentNodeId === id;
  const btnDetails = data.audioButtonDetail ?? null;
  const label = nodeDetailTitle(data);
  const category = btnDetails?.category?.name || "Narrativa";

  const play = () => {
    if (!ctx) return;
    ctx.selectNode(id);
    if (isPlaying) ctx.pauseAudio();
    else if (isPaused) ctx.resumeAudio();
    else void ctx.startAudioPlayback(id);
  };

  return (
    <div className={nodeFrame(data.status, selected, "w-[320px] min-h-[170px] overflow-hidden rounded-[30px] border-2 bg-primary-container p-4 text-on-primary-container")}>
      <HiddenHandles />
      <div className="flex items-start gap-4 pr-8">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            play();
          }}
          className={`nodrag flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] border border-primary/25 shadow-elevation-2 transition active:scale-95 ${
            isPlaying ? "bg-primary text-on-primary animate-pulse" : "bg-primary-container text-on-primary-container hover:bg-primary-container/90"
          }`}
        >
          {isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <NodeTypeBadge type={data.type} />
            <StateBadge status={data.status} />
          </div>
          <p className="mt-3 line-clamp-2 text-[15px] font-black leading-tight text-on-primary-container">{label}</p>
          {mode !== "far" ? <p className="mt-2 text-xs font-semibold text-on-surface-variant">Categoría: {category}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <PrimaryButton onClick={() => play()}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          {isPlaying ? "Pausar" : isPaused ? "Reanudar" : "Reproducir"}
        </PrimaryButton>
        {mode === "close" ? <p className="text-[11px] font-semibold text-on-primary-container/80">{btnDetails?.audioAsset?.originalName || "Audio asociado"}</p> : null}
      </div>
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerDynamicAudioNode({ data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const mode = zoomMode(ctx?.zoom ?? 1);
  const template = String(data.template ?? data.summary ?? data.label ?? "");
  const variables = data.variables ?? [];
  const voice = String(data.voiceId ?? "").trim();
  const model = String(data.modelId ?? "").trim();
  const preview = template.trim() || "Audio dinámico preparado para ElevenLabs";

  return (
    <div className={nodeFrame(data.status, selected, "w-[340px] min-h-[190px] overflow-hidden rounded-[30px] border-2 bg-tertiary-container p-5 text-on-tertiary-container")}>
      <HiddenHandles />
      <div className="flex items-start justify-between gap-4 pr-8">
        <div className="flex items-center gap-3">
          <div className="flex h-13 w-13 items-center justify-center rounded-2xl border border-tertiary/25 bg-tertiary-container text-on-tertiary-container">
            <WandSparkles className="h-6 w-6" />
          </div>
          <div>
            <NodeTypeBadge type={data.type} />
            {mode !== "far" ? <p className="mt-1 text-xs font-semibold text-on-surface-variant">Plantilla con variables para ElevenLabs</p> : null}
          </div>
        </div>
        <StateBadge status={data.status} />
      </div>
      <p className="mt-4 line-clamp-2 text-[15px] font-black leading-tight text-on-tertiary-container">{preview}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-tertiary/25 bg-tertiary-container px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-on-tertiary-container">
          {variables.length > 0 ? `${variables.length} variable(s)` : "Sin variables"}
        </span>
        {voice ? (
          <span className="rounded-full border border-outline-variant bg-surface-container-high px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
            Voz definida
          </span>
        ) : null}
        {model ? (
          <span className="rounded-full border border-outline-variant bg-surface-container-high px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
            Modelo definido
          </span>
        ) : null}
      </div>
      {mode === "close" && variables.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {variables.slice(0, 5).map((variable) => (
            <span
              key={variable}
              className="rounded-full border border-tertiary/25 bg-tertiary-container px-3 py-1 text-xs font-semibold text-on-tertiary-container"
            >
              {`{{${variable}}}`}
            </span>
          ))}
        </div>
      ) : null}
      {mode !== "far" ? <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
        <span>Voice ID: {voice || "pendiente"}</span>
        <span className="opacity-50">·</span>
        <span>Model ID: {model || "pendiente"}</span>
      </div> : null}
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerScriptTextNode({ id, data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const mode = zoomMode(ctx?.zoom ?? 1);
  const isCurrent = ctx?.currentNodeId === id;
  const title = nodeDetailTitle(data);
  const text = nodeTextPreview(data.summary || data.nodeData?.body || data.label, "Sin guion disponible", 180);
  return (
    <div className={nodeFrame(data.status, selected, "w-[340px] min-h-[200px] rotate-[0.8deg] overflow-hidden rounded-[16px] border-2 border-outline-variant bg-surface-container-high p-5 text-on-surface shadow-[0_18px_42px_rgba(0,0,0,0.12)]")}>
      <HiddenHandles />
      <div className="flex items-start justify-between gap-4 pr-8">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <FileText className="h-5 w-5" />
          <NodeTypeBadge type={data.type} />
        </div>
        <StateBadge status={data.status} />
      </div>
      <div className="relative mt-4 min-h-[112px] overflow-hidden rounded-[10px] border border-outline-variant bg-surface px-4 py-4">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-8 border-r border-outline-variant bg-[linear-gradient(to_right,rgba(124,58,237,0.08),transparent)]" />
        <p className="relative whitespace-pre-wrap pl-3 text-[15px] font-semibold leading-6 text-on-surface">
          {mode === "far" ? title : text}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <PrimaryButton tone="slate" onClick={() => void ctx?.copyNodeText(id)}>
          <Copy className="h-4 w-4" />
          Copiar texto
        </PrimaryButton>
        <PrimaryButton disabled={!isCurrent} onClick={() => void ctx?.completeCurrentNode(false)}>
          <CheckCircle2 className="h-4 w-4" />
          Leído
        </PrimaryButton>
      </div>
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerInstructionNode({ id, data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const mode = zoomMode(ctx?.zoom ?? 1);
  const isCurrent = ctx?.currentNodeId === id;
  return (
    <div className={nodeFrame(data.status, selected, "w-[320px] min-h-[190px] rotate-[-1.5deg] rounded-[16px] border-2 warning-surface-strong p-5 shadow-[0_18px_42px_rgba(251,191,36,0.16)]")}>
      <HiddenHandles />
      <div className="flex items-start justify-between gap-4 pr-8">
        <div className="flex items-center gap-2 text-[color:var(--warning-text)]">
          <AlertCircle className="h-5 w-5" />
          <NodeTypeBadge type={data.type} />
        </div>
        <StateBadge status={data.status} />
      </div>
      <div className="mt-4 rounded-[12px] border border-[color:var(--warning-border)] bg-[color:var(--warning-bg-strong)] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[color:var(--warning-text-muted)]">Instrucción operativa</p>
        <p className="mt-3 whitespace-pre-wrap text-[15px] font-semibold leading-6 text-[color:var(--warning-text)]">
          {nodeTextPreview(data.label, "Sin instrucción", 220)}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <PrimaryButton tone="amber" disabled={!isCurrent} onClick={() => void ctx?.completeCurrentNode(false)}>
          <CheckCircle2 className="h-4 w-4" />
          Entendido
        </PrimaryButton>
        {mode === "close" ? <span className="h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-[color:var(--warning-border)]" /> : null}
      </div>
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerAudioNode({ id, data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const mode = zoomMode(ctx?.zoom ?? 1);
  const isCurrent = ctx?.currentNodeId === id;
  const isPlaying = isCurrent && ctx?.playbackState === "playing";
  const isPaused = isCurrent && ctx?.playbackState === "paused";

  const play = () => {
    if (!ctx) return;
    if (!isCurrent) {
      ctx.setMessage("Este audio se habilita cuando sea el paso actual.");
      return;
    }
    ctx.selectNode(id);
    if (isPlaying) ctx.pauseAudio();
    else if (isPaused) ctx.resumeAudio();
    else void ctx.startAudioPlayback(id);
  };

  return (
    <div className={nodeFrame(data.status, selected, "w-[320px] min-h-[170px] rounded-[30px] border-2 bg-secondary-container p-5 text-on-secondary-container")}>
      <HiddenHandles />
      <div className="flex items-start justify-between gap-4 pr-8">
        <div className="flex items-center gap-3">
          <div className={`flex h-13 w-13 items-center justify-center rounded-2xl border border-secondary/25 ${isPlaying ? "bg-primary text-on-primary animate-pulse" : "bg-secondary-container text-on-secondary-container"}`}>
            {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Volume2 className="h-6 w-6" />}
          </div>
          <div>
            <NodeTypeBadge type={data.type} />
            {mode !== "far" ? <p className="mt-1 text-xs font-semibold text-on-surface-variant">{data.isRequired ? "Obligatorio" : "Opcional"}</p> : null}
          </div>
        </div>
        <StateBadge status={data.status} />
      </div>
      <p className="mt-4 line-clamp-2 text-[15px] font-black leading-tight text-on-surface">{data.label}</p>
      {mode !== "far" ? <p className="mt-2 text-xs font-semibold text-on-surface-variant">{isPlaying ? "Reproduciendo" : isPaused ? "Pausado" : "No reproducido"}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <PrimaryButton onClick={() => play()}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          {isPlaying ? "Pausar" : isPaused ? "Reanudar" : "Reproducir"}
        </PrimaryButton>
        {isCurrent && (isPlaying || isPaused) ? (
          <PrimaryButton tone="slate" onClick={() => ctx?.stopAudio()}>
            <Square className="h-4 w-4" />
            Detener
          </PrimaryButton>
        ) : null}
      </div>
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerPauseNode({ id, data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const mode = zoomMode(ctx?.zoom ?? 1);
  const isCurrent = ctx?.currentNodeId === id;
  const isTimer = data.nodeData?.manual === false || data.nodeData?.pauseType === "timer";
  const duration = data.nodeData?.durationSeconds;
  return (
    <div className={nodeFrame(data.status, selected, "w-[260px] min-h-[130px] rounded-[28px] border-2 bg-surface-container p-4 text-on-surface")}>
      <HiddenHandles />
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-high text-on-surface-variant">
          <Clock3 className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <NodeTypeBadge type={data.type} />
            <StateBadge status={data.status} />
          </div>
          <p className="mt-2 text-[15px] font-black text-on-surface">{isTimer ? "Temporizada" : "Manual"}</p>
          {mode !== "far" ? <p className="mt-1 text-xs font-semibold text-on-surface-variant">{isTimer && duration ? `${duration}s de espera` : "Esperar señal"}</p> : null}
        </div>
      </div>
      <div className="mt-4">
        <PrimaryButton disabled={!isCurrent} onClick={() => void ctx?.completeCurrentNode(false)}>
          <ArrowRight className="h-4 w-4" />
          Continuar
        </PrimaryButton>
      </div>
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerDecisionNode({ id, data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const mode = zoomMode(ctx?.zoom ?? 1);
  const isCurrent = ctx?.currentNodeId === id;
  const choices = data.decisionChoices?.length
    ? data.decisionChoices
    : readDecisionLabels(data.nodeData?.options).map((label) => ({ label, targetNodeId: label }));
  return (
    <div className={nodeFrame(data.status, selected, "w-[340px] min-h-[190px] rounded-[32px] border-2 bg-secondary-container p-5 text-on-secondary-container")}>
      <HiddenHandles />
      <div className="flex items-start justify-between gap-4 pr-8">
        <div className="flex items-center gap-2 text-on-secondary-container">
          <Split className="h-5 w-5" />
          <NodeTypeBadge type={data.type} />
        </div>
        <StateBadge status={data.status} />
      </div>
      <p className="mt-4 line-clamp-2 text-[15px] font-black leading-6 text-on-secondary-container">{nodeTextPreview(data.label, "¿Qué sigue?", 170)}</p>
      {mode !== "far" ? <div className="mt-4 flex flex-wrap gap-2">
        {choices.slice(0, 5).map((choice) => (
          <button
            key={`${choice.targetNodeId}-${choice.label}`}
            type="button"
            disabled={!isCurrent}
            onClick={(event) => {
              event.stopPropagation();
              if (isCurrent) void ctx?.chooseDecision(choice.targetNodeId, choice.label);
            }}
            className="nodrag rounded-2xl border border-outline-variant bg-surface-container-high px-3 py-2 text-xs font-black text-on-surface transition hover:border-secondary hover:bg-surface-container disabled:cursor-default disabled:opacity-80"
          >
            {choice.label}
          </button>
        ))}
      </div> : null}
      {isCurrent ? <p className="mt-3 text-xs font-bold text-on-secondary-container">Selecciona una ruta para continuar</p> : null}
      <NodeActionButton id={data.id} />
    </div>
  );
}

export const playerNodeTypes: NodeTypes = {
  START: PlayerStartNode,
  END: PlayerEndNode,
  AUDIO: PlayerAudioNode,
  AUDIO_BUTTON: PlayerAudioButtonNode,
  DYNAMIC_AUDIO: PlayerDynamicAudioNode,
  SCRIPT_TEXT: PlayerScriptTextNode,
  INSTRUCTION: PlayerInstructionNode,
  PAUSE: PlayerPauseNode,
  DECISION: PlayerDecisionNode,
  narrativeNode: PlayerInstructionNode,
};
