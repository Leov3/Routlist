"use client";

import { createContext, useContext, useEffect, useState, type MouseEvent, type ReactNode } from "react";
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
  Lock,
  Pause,
  Play,
  Split,
  Square,
  Volume2,
} from "lucide-react";
import { api } from "@/lib/api";
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
  isRequired?: boolean;
  decisionChoices?: DecisionChoice[];
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
  if (status === "current") return "border-primary/50 bg-primary/18 text-primary";
  if (status === "completed") return "border-emerald-400/35 bg-emerald-500/12 text-emerald-300";
  if (status === "error") return "border-red-400/35 bg-red-500/12 text-red-300";
  if (status === "decision-selected") return "border-fuchsia-400/35 bg-fuchsia-500/12 text-fuchsia-300";
  if (status === "locked") return "border-slate-500/25 bg-slate-900/55 text-slate-400";
  return "border-white/10 bg-black/25 text-slate-300";
}

function nodeFrame(status: PlayerNodeState, selected?: boolean, extra = "") {
  const selectedRing = selected ? "ring-2 ring-primary/80 ring-offset-2 ring-offset-[#120f1c] " : "";
  const statusFrame =
    status === "current"
      ? "border-primary shadow-[0_0_42px_rgba(168,139,250,0.48)] ring-4 ring-primary/30 scale-[1.035]"
      : status === "completed"
        ? "border-emerald-400/55 shadow-[0_18px_34px_rgba(16,185,129,0.08)]"
        : status === "error"
          ? "border-red-400/70 shadow-[0_18px_34px_rgba(239,68,68,0.12)]"
          : status === "locked"
            ? "border-slate-600/35 opacity-65"
            : "border-white/12";
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
      className="nodrag absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/35 text-slate-300 opacity-80 backdrop-blur transition hover:border-primary/50 hover:text-white group-hover:opacity-100"
      aria-label="Abrir acciones"
    >
      <Ellipsis className="h-4 w-4" />
    </button>
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
      ? "bg-emerald-500 text-white hover:bg-emerald-400"
      : tone === "amber"
        ? "bg-amber-300 text-amber-950 hover:bg-amber-200"
        : tone === "purple"
          ? "bg-purple-500 text-white hover:bg-purple-400"
          : tone === "slate"
            ? "bg-slate-200 text-slate-950 hover:bg-white"
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
  return (
    <div className={nodeFrame(data.status, selected, "w-[220px] min-h-[88px] rounded-[28px] border-2 bg-gradient-to-br from-primary/24 via-[#171024] to-[#100d18] p-4 text-on-surface")}>
      <HiddenHandles target={false} />
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/20 text-primary">
          <Flag className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-primary">Inicio</p>
            <StateBadge status={data.status} />
          </div>
          <p className="mt-2 text-base font-black text-on-surface">Comenzar narrativa</p>
          <p className="mt-1 text-xs font-semibold text-on-surface-variant">Arranque del flujo guiado</p>
        </div>
      </div>
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerEndNode({ data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const isCurrent = ctx?.currentNodeId === data.id;
  return (
    <div className={nodeFrame(data.status, selected, "w-[220px] min-h-[88px] rounded-[28px] border-2 bg-gradient-to-br from-emerald-500/22 via-[#101c18] to-[#0f1216] p-4 text-on-surface")}>
      <HiddenHandles source={false} />
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-400/15 text-emerald-300">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-300">Fin</p>
            <StateBadge status={data.status} />
          </div>
          <p className="mt-2 text-base font-black text-on-surface">{data.label || "Cierre de narrativa"}</p>
          {isCurrent ? (
            <div className="mt-3">
              <PrimaryButton tone="emerald" onClick={() => void ctx?.finishRun()}>
                <CheckCircle2 className="h-4 w-4" />
                Finalizar
              </PrimaryButton>
            </div>
          ) : null}
        </div>
      </div>
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerAudioButtonNode({ id, data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const isCurrent = ctx?.currentNodeId === id;
  const isPlaying = isCurrent && ctx?.playbackState === "playing";
  const isPaused = isCurrent && ctx?.playbackState === "paused";
  const [btnDetails, setBtnDetails] = useState<AudioButtonDetail | null>(null);

  useEffect(() => {
    if (!data.audioButtonId) return;
    api<AudioButtonDetail>(`/audio-buttons/${data.audioButtonId}`).then(setBtnDetails).catch(() => setBtnDetails(null));
  }, [data.audioButtonId]);

  const label = btnDetails?.label || data.label || "Botón de audio";
  const category = btnDetails?.category?.name || "Narrativa";

  const play = () => {
    if (!ctx) return;
    if (!isCurrent) {
      ctx.setMessage("Este botón se habilita cuando sea el paso actual.");
      return;
    }
    ctx.selectNode(id);
    if (isPlaying) ctx.pauseAudio();
    else if (isPaused) ctx.resumeAudio();
    else void ctx.startAudioPlayback(id);
  };

  return (
    <div className={nodeFrame(data.status, selected, "w-[280px] min-h-[150px] overflow-hidden rounded-[30px] border-2 bg-gradient-to-br from-primary/28 via-[#171124] to-[#0f0c18] p-4 text-on-surface")}>
      <HiddenHandles />
      <div className="flex items-start gap-4 pr-8">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            play();
          }}
          className={`nodrag flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] border border-primary/30 shadow-elevation-2 transition active:scale-95 ${
            isPlaying ? "bg-primary text-on-primary animate-pulse" : "bg-primary/20 text-primary hover:bg-primary/30"
          }`}
        >
          {isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary">Botonera</span>
            <StateBadge status={data.status} />
          </div>
          <p className="mt-3 line-clamp-2 text-xl font-black leading-tight text-on-surface">{label}</p>
          <p className="mt-2 text-xs font-semibold text-on-surface-variant">Categoría: {category}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <PrimaryButton disabled={!isCurrent} onClick={() => play()}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          {isPlaying ? "Pausar" : isPaused ? "Reanudar" : "Reproducir"}
        </PrimaryButton>
        <p className="text-[11px] font-semibold text-primary/80">{btnDetails?.audioAsset?.originalName || "Audio asociado"}</p>
      </div>
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerScriptTextNode({ id, data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const isCurrent = ctx?.currentNodeId === id;
  const text = nodeTextPreview(data.label, "Sin guion disponible", 260);
  return (
    <div className={nodeFrame(data.status, selected, "w-[320px] min-h-[170px] overflow-hidden rounded-[30px] border-2 bg-gradient-to-br from-sky-500/16 via-[#101923] to-[#0f1118] p-5 text-on-surface")}>
      <HiddenHandles />
      <div className="flex items-start justify-between gap-4 pr-8">
        <div className="flex items-center gap-2 text-sky-300">
          <FileText className="h-5 w-5" />
          <span className="text-[11px] font-black uppercase tracking-[0.22em]">Guion a leer</span>
        </div>
        <StateBadge status={data.status} />
      </div>
      <div className="relative mt-4 max-h-[96px] overflow-hidden rounded-2xl border border-sky-300/16 bg-black/24 px-4 py-3">
        <p className="whitespace-pre-wrap text-[15px] font-semibold leading-6 text-slate-50">"{text}"</p>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#101923] to-transparent" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <PrimaryButton tone="slate" onClick={() => void ctx?.copyNodeText(id)}>
          <Copy className="h-4 w-4" />
          Copiar texto
        </PrimaryButton>
        {isCurrent ? (
          <PrimaryButton onClick={() => void ctx?.completeCurrentNode(false)}>
            <CheckCircle2 className="h-4 w-4" />
            Leído
          </PrimaryButton>
        ) : null}
      </div>
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerInstructionNode({ id, data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const isCurrent = ctx?.currentNodeId === id;
  return (
    <div className={nodeFrame(data.status, selected, "w-[280px] min-h-[160px] rotate-[-1deg] rounded-bl-[34px] rounded-br-xl rounded-tl-xl rounded-tr-[34px] border-2 border-amber-300/30 bg-gradient-to-br from-amber-300/26 via-[#2a1d0d] to-[#16100a] p-5 text-amber-50")}>
      <HiddenHandles />
      <div className="flex items-start justify-between gap-4 pr-8">
        <div className="flex items-center gap-2 text-amber-200">
          <AlertCircle className="h-5 w-5" />
          <span className="text-[11px] font-black uppercase tracking-[0.22em]">Instrucción</span>
        </div>
        <StateBadge status={data.status} />
      </div>
      <p className="mt-4 min-h-[56px] whitespace-pre-wrap text-[15px] font-bold leading-6 text-amber-50">
        {nodeTextPreview(data.label, "Sin instrucción", 180)}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        {isCurrent ? (
          <PrimaryButton tone="amber" onClick={() => void ctx?.completeCurrentNode(false)}>
            <CheckCircle2 className="h-4 w-4" />
            Entendido
          </PrimaryButton>
        ) : <span className="text-xs font-semibold text-amber-100/70">Nota operativa</span>}
        <span className="h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-amber-200/35" />
      </div>
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerAudioNode({ id, data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
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
    <div className={nodeFrame(data.status, selected, "w-[280px] min-h-[150px] rounded-[30px] border-2 bg-gradient-to-br from-violet-500/22 via-[#161325] to-[#0f0c18] p-5 text-on-surface")}>
      <HiddenHandles />
      <div className="flex items-start justify-between gap-4 pr-8">
        <div className="flex items-center gap-3">
          <div className={`flex h-13 w-13 items-center justify-center rounded-2xl border border-violet-300/25 ${isPlaying ? "bg-primary text-on-primary animate-pulse" : "bg-violet-500/18 text-violet-200"}`}>
            {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Volume2 className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-200">Audio</p>
            <p className="mt-1 text-xs font-semibold text-on-surface-variant">{data.isRequired ? "Obligatorio" : "Opcional"}</p>
          </div>
        </div>
        <StateBadge status={data.status} />
      </div>
      <p className="mt-4 line-clamp-2 text-lg font-black leading-tight text-on-surface">{data.label}</p>
      <p className="mt-2 text-xs font-semibold text-on-surface-variant">{isPlaying ? "Reproduciendo" : isPaused ? "Pausado" : "No reproducido"}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <PrimaryButton disabled={!isCurrent} onClick={() => play()}>
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
  const isCurrent = ctx?.currentNodeId === id;
  const isTimer = data.nodeData?.manual === false || data.nodeData?.pauseType === "timer";
  const duration = data.nodeData?.durationSeconds;
  return (
    <div className={nodeFrame(data.status, selected, "w-[240px] min-h-[120px] rounded-[28px] border-2 bg-gradient-to-br from-slate-500/18 via-[#151821] to-[#0f1118] p-4 text-on-surface")}>
      <HiddenHandles />
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-slate-300/14 bg-slate-500/18 text-slate-200">
          <Clock3 className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-200">Pausa</p>
            <StateBadge status={data.status} />
          </div>
          <p className="mt-2 text-base font-black text-on-surface">{isTimer ? "Temporizada" : "Manual"}</p>
          <p className="mt-1 text-xs font-semibold text-on-surface-variant">{isTimer && duration ? `${duration}s de espera` : "Esperar señal"}</p>
        </div>
      </div>
      {isCurrent ? (
        <div className="mt-4">
          <PrimaryButton onClick={() => void ctx?.completeCurrentNode(false)}>
            <ArrowRight className="h-4 w-4" />
            Continuar
          </PrimaryButton>
        </div>
      ) : null}
      <NodeActionButton id={data.id} />
    </div>
  );
}

export function PlayerDecisionNode({ id, data, selected }: NodeProps<Node<PlayerFlowNodeData>>) {
  const ctx = useContext(NarrativePlayerContext);
  const isCurrent = ctx?.currentNodeId === id;
  const choices = data.decisionChoices?.length
    ? data.decisionChoices
    : readDecisionLabels(data.nodeData?.options).map((label) => ({ label, targetNodeId: label }));
  return (
    <div className={nodeFrame(data.status, selected, "w-[320px] min-h-[180px] rounded-[32px] border-2 bg-gradient-to-br from-purple-500/22 via-[#1b1126] to-[#100d18] p-5 text-on-surface")}>
      <HiddenHandles />
      <div className="flex items-start justify-between gap-4 pr-8">
        <div className="flex items-center gap-2 text-purple-200">
          <Split className="h-5 w-5" />
          <span className="text-[11px] font-black uppercase tracking-[0.22em]">Decisión</span>
        </div>
        <StateBadge status={data.status} />
      </div>
      <p className="mt-4 text-[15px] font-black leading-6 text-purple-50">{nodeTextPreview(data.label, "¿Qué sigue?", 170)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {choices.slice(0, 5).map((choice) => (
          <button
            key={`${choice.targetNodeId}-${choice.label}`}
            type="button"
            disabled={!isCurrent}
            onClick={(event) => {
              event.stopPropagation();
              if (isCurrent) void ctx?.chooseDecision(choice.targetNodeId, choice.label);
            }}
            className="nodrag rounded-2xl border border-purple-300/28 bg-purple-950/55 px-3 py-2 text-xs font-black text-purple-100 transition hover:border-purple-200/70 hover:bg-purple-500/20 disabled:cursor-default disabled:opacity-80"
          >
            {choice.label}
          </button>
        ))}
      </div>
      {isCurrent ? <p className="mt-3 text-xs font-bold text-purple-200">Selecciona una ruta para continuar</p> : null}
      <NodeActionButton id={data.id} />
    </div>
  );
}

export const playerNodeTypes: NodeTypes = {
  START: PlayerStartNode,
  END: PlayerEndNode,
  AUDIO: PlayerAudioNode,
  AUDIO_BUTTON: PlayerAudioButtonNode,
  SCRIPT_TEXT: PlayerScriptTextNode,
  INSTRUCTION: PlayerInstructionNode,
  PAUSE: PlayerPauseNode,
  DECISION: PlayerDecisionNode,
  narrativeNode: PlayerInstructionNode,
};
