"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  ChevronUp,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from "lucide-react";

export function AudioPlayerBar({
  label,
  transcript,
  audioElement,
  isPlaying,
  isPaused,
  onPause,
  onResume,
  onStop,
  volume,
  onVolumeChange,
}: {
  label: string | null;
  transcript?: string | null;
  audioElement?: HTMLAudioElement | null;
  isPlaying: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  volume: number;
  onVolumeChange: (value: number) => void;
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  // Sync time & duration from audioElement
  useEffect(() => {
    const el = audioElement;
    if (!el) { setCurrentTime(0); setDuration(0); return; }

    const onTime = () => setCurrentTime(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnded = () => { setCurrentTime(0); setDuration(0); };

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnded);
    setDuration(el.duration || 0);
    setCurrentTime(el.currentTime);

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnded);
    };
  }, [audioElement]);

  // Reset when stopped
  useEffect(() => {
    if (!label) { setCurrentTime(0); setDuration(0); }
  }, [label]);

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioElement || !progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audioElement.currentTime = ratio * (audioElement.duration || 0);
    },
    [audioElement],
  );

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const active = !!label;

  return (
    <div
      className={`fixed bottom-5 left-[calc(var(--routlis-sidebar-width)+20px)] right-5 z-50 overflow-hidden rounded-[26px] border border-outline-variant backdrop-blur-xl transition-all duration-300 ${
        active
          ? "shadow-[0_24px_70px_rgba(0,0,0,.36)]"
          : ""
      }`}
      style={{ background: "color-mix(in srgb, var(--md-sys-color-surface) 94%, transparent)" }}
    >
      <div
        ref={progressRef}
        onClick={seek}
        className={`relative h-1.5 w-full cursor-pointer bg-on-surface/10 ${active ? "opacity-100" : "opacity-40"}`}
      >
        <div
          className="absolute left-0 top-0 h-full transition-all duration-100"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, var(--md-sys-color-primary), var(--md-sys-color-tertiary), #c084fc)",
          }}
        />
        {active && (
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_6px_rgba(124,58,237,.16)]"
            style={{ left: `${progress}%` }}
          />
        )}
      </div>

      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl transition-colors ${active ? "bg-primary/15" : "bg-surface-container-high"}`}>
            <Music className={`h-6 w-6 transition-colors ${active ? "text-primary" : "text-on-surface-variant"}`} />
          </div>
          <div className="min-w-0">
            <p className={`truncate text-[15px] font-semibold leading-tight transition-colors ${active ? "text-on-surface" : "text-on-surface"}`}>
              {label ?? "Sin audio activo"}
            </p>
            {transcript ? (
              <p className="truncate text-sm text-on-surface-variant">{transcript}</p>
            ) : (
              <p className="text-sm text-on-surface-variant">
                {active ? "Reproduciendo..." : "Selecciona un audio"}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-3 lg:px-2">
          <button
            type="button"
            disabled={!active}
            onClick={() => { if (audioElement) audioElement.currentTime = Math.max(0, audioElement.currentTime - 10); }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-all hover:bg-surface-container-highest hover:text-on-surface disabled:opacity-30"
            title="Retroceder 10s"
          >
            <SkipBack className="h-4 w-4 fill-current" />
          </button>

          <button
            type="button"
            disabled={!active}
            onClick={isPaused ? onResume : onPause}
            className={`flex h-14 w-14 items-center justify-center rounded-full shadow-[0_0_0_8px_rgba(142,93,255,.14)] transition-all active:scale-95 disabled:opacity-40 ${
              active
                ? "bg-primary text-on-primary hover:brightness-110"
                : "bg-surface-container-high text-on-surface-variant"
            }`}
            title={isPaused ? "Reanudar" : "Pausar"}
          >
            {isPaused ? (
              <Play className="h-5 w-5 fill-current ml-0.5" />
            ) : (
              <Pause className="h-5 w-5 fill-current" />
            )}
          </button>

          <button
            type="button"
            disabled={!active}
            onClick={onStop}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-all hover:bg-surface-container-highest disabled:opacity-30"
            title="Detener todo"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>

          <button
            type="button"
            disabled={!active}
            onClick={onStop}
            className="hidden h-10 items-center rounded-full border border-outline-variant px-3 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-30 sm:inline-flex"
            title="Detener todo"
          >
            Detener todo
          </button>

          <button
            type="button"
            disabled={!active}
            onClick={() => { if (audioElement) audioElement.currentTime = Math.min(audioElement.duration || 0, audioElement.currentTime + 10); }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-all hover:bg-surface-container-highest hover:text-on-surface disabled:opacity-30"
            title="Adelantar 10s"
          >
            <SkipForward className="h-4 w-4 fill-current" />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-end gap-4">
          <span className="hidden text-xs tabular-nums text-on-surface-variant sm:block">
            {fmt(currentTime)} · {fmt(duration)}
          </span>

          <div className="hidden items-center gap-2 sm:flex">
            <Volume2 className="h-4 w-4 shrink-0 text-on-surface-variant" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-on-surface/10 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
              style={{
                background: `linear-gradient(to right, var(--md-sys-color-primary) ${volume * 100}%, rgba(0,0,0,.10) ${volume * 100}%)`,
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-all hover:bg-surface-container-highest hover:text-on-surface"
            title="Expandir"
          >
            <ChevronUp className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
