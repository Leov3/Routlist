"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Pause, Play, Square, X } from "lucide-react";
import { mediaUrl } from "@/lib/api";
import type { BoardAudioButton } from "@/types/routlis";

export function AudioButtonDetailsModal({
  button,
  onClose,
}: {
  button: BoardAudioButton;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"button" | "audio" | null>(null);
  const [playbackState, setPlaybackState] = useState<"idle" | "playing" | "paused">("idle");
  const [playbackProgress, setPlaybackProgress] = useState({ current: 0, duration: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasLabel = button.label.trim().length > 0;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  async function copyText(value: string, scope: "button" | "audio") {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopied(scope);
    window.setTimeout(() => setCopied(null), 1500);
  }

  function ensureAudioElement() {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio(mediaUrl(button.audioUrl));
    audio.preload = "auto";
    audio.crossOrigin = "use-credentials";
    audio.volume = 1;
    audio.onplay = () => setPlaybackState("playing");
    audio.onpause = () => setPlaybackState((current) => (current === "playing" ? "paused" : current));
    audio.onended = () => {
      setPlaybackState("idle");
      setPlaybackProgress({ current: 0, duration: 0 });
    };
    audio.ontimeupdate = () => {
      setPlaybackProgress({ current: audio.currentTime, duration: audio.duration || 0 });
    };
    audio.onloadedmetadata = () => {
      setPlaybackProgress({ current: 0, duration: audio.duration || 0 });
    };
    audioRef.current = audio;
    return audio;
  }

  async function playAudio() {
    const audio = ensureAudioElement();
    await audio.play();
    setPlaybackState("playing");
  }

  function pauseAudio() {
    audioRef.current?.pause();
  }

  async function resumeAudio() {
    if (!audioRef.current) return;
    await audioRef.current.play();
    setPlaybackState("playing");
  }

  function stopAudio() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlaybackState("idle");
    setPlaybackProgress({ current: 0, duration: 0 });
  }

  const buttonText = button.description?.trim() || "Sin texto del botón";
  const audioText = button.audioAsset.transcript?.trim() || button.description?.trim() || "Sin texto disponible";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 px-3 py-3 backdrop-blur-md sm:items-center sm:px-4 sm:py-4"
      onClick={onClose}
    >
      <div
        className="flex h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-outline-variant bg-surface shadow-[0_30px_90px_rgba(0,0,0,.28)] sm:h-[calc(100dvh-2rem)]"
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-on-surface-variant">Detalles del botón</p>
            {hasLabel ? (
              <h3 className="mt-1 text-xl font-semibold text-on-surface">{button.label}</h3>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[1.05fr_.95fr]">
          <div className="min-h-0 border-b border-outline-variant p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="overflow-hidden rounded-[22px] border border-outline-variant bg-surface-container">
              {button.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(button.imageUrl)}
                  alt={button.label}
                  className="h-[240px] w-full object-cover sm:h-[320px]"
                />
              ) : (
                <div className="flex h-[240px] items-center justify-center text-sm text-on-surface-variant sm:h-[320px]">
                  Este botón no tiene imagen todavía.
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {button.imageDownloadUrl ? (
                <a
                  href={mediaUrl(button.imageDownloadUrl)}
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <Download className="h-4 w-4" />
                  Descargar imagen
                </a>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
            <div className="space-y-4 pb-1">
              <div className="rounded-[20px] border border-outline-variant bg-surface-container p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Texto del botón</p>
                <p className="mt-2 max-h-28 overflow-y-auto text-sm leading-6 text-on-surface">{buttonText}</p>
              </div>

              <div className="rounded-[20px] border border-outline-variant bg-surface-container p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Texto del audio</p>
                    <p className="mt-2 max-h-28 overflow-y-auto text-sm leading-6 text-on-surface">{audioText}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyText(audioText, "audio")}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high"
                  >
                    {copied === "audio" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === "audio" ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>

              {button.description ? (
                <div className="rounded-[20px] border border-outline-variant bg-surface-container p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Texto adicional</p>
                    <p className="mt-2 max-h-28 overflow-y-auto text-sm leading-6 text-on-surface">{button.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyText(button.description ?? "", "button")}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high"
                    >
                      {copied === "button" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied === "button" ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-[20px] border border-outline-variant bg-surface-container p-4 text-sm text-on-surface-variant">
                <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Audio</p>
                <p className="mt-2 max-h-24 overflow-y-auto text-on-surface">{button.audioAsset.originalName}</p>
                <p className="mt-1">
                  {button.audioAsset.durationSeconds
                    ? `${button.audioAsset.durationSeconds}s`
                    : "Duración no disponible"}
                </p>
                <div className="mt-4 space-y-3">
                  {playbackProgress.duration > 0 ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-on-surface-variant">
                        <span>{Math.floor(playbackProgress.current)}s</span>
                        <span>{Math.floor(playbackProgress.duration)}s</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-variant/30">
                        <div
                          className="h-full bg-primary transition-all duration-200 ease-linear"
                          style={{
                            width: `${playbackProgress.duration > 0 ? (playbackProgress.current / playbackProgress.duration) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void playAudio()}
                      disabled={playbackState === "playing"}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Play className="h-4 w-4" />
                      Reproducir
                    </button>
                    <button
                      type="button"
                      onClick={() => void pauseAudio()}
                      disabled={playbackState !== "playing"}
                      className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Pause className="h-4 w-4" />
                      Pausar
                    </button>
                    <button
                      type="button"
                      onClick={() => void resumeAudio()}
                      disabled={playbackState !== "paused"}
                      className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Play className="h-4 w-4" />
                      Reanudar
                    </button>
                    <button
                      type="button"
                      onClick={() => void stopAudio()}
                      disabled={playbackState === "idle"}
                      className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Square className="h-4 w-4" />
                      Detener
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
