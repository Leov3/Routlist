"use client";

import { MoreVertical, Pause, Play, Star } from "lucide-react";
import { mediaUrl } from "@/lib/api";
import type { BoardAudioButton, BoardDensity } from "@/types/routlis";

export function AudioButton({
  button,
  active,
  isFavorite,
  density = "medium",
  onPlay,
  onToggleFavorite,
  onOpenDetails,
}: {
  button: BoardAudioButton;
  active: boolean;
  isFavorite: boolean;
  density?: BoardDensity;
  onPlay: (button: BoardAudioButton) => void;
  onToggleFavorite: (button: BoardAudioButton) => void;
  onOpenDetails: (button: BoardAudioButton) => void;
}) {
  const hasLabel = button.label.trim().length > 0;
  const sizeClasses =
    density === "compact"
      ? "h-[124px] max-h-[124px] max-w-[240px]"
      : density === "large"
        ? "h-[182px] max-h-[182px] max-w-[340px]"
        : "h-[150px] max-h-[150px] max-w-[300px]";
  const thumbSize =
    density === "compact" ? "h-9 w-9" : density === "large" ? "h-14 w-14" : "h-11 w-11";
  const playSize =
    density === "compact" ? "h-8 w-8" : density === "large" ? "h-11 w-11" : "h-9 w-9";
  const textSize =
    density === "compact" ? "text-[13px]" : density === "large" ? "text-[16px]" : "text-[15px]";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onPlay(button)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPlay(button);
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenDetails(button);
      }}
      className={`group relative flex ${sizeClasses} w-full cursor-pointer flex-col overflow-hidden rounded-[18px] border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/35 ${
        active
          ? "border-primary/50 bg-primary/10 shadow-[0_0_0_1px_rgba(124,58,237,.2),0_18px_40px_rgba(124,58,237,.14)]"
          : "border-outline-variant bg-surface-container hover:border-primary/25 hover:bg-surface-container-high"
      }`}
    >
      <div className="flex items-start gap-3 px-3 pt-3">
        <div className={`relative shrink-0 overflow-hidden rounded-[14px] border border-white/8 bg-surface-container ${thumbSize}`}>
          {button.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl(button.imageUrl)}
              alt={button.label}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-primary/10 text-primary">
              <Play className="h-4 w-4 fill-current" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPlay(button);
          }}
          className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full shadow-elevation-2 transition-all duration-200 active:scale-95 ${playSize} ${
            active
              ? "bg-primary text-on-primary ring-8 ring-primary/15 animate-pulse"
              : "bg-primary/80 text-on-primary hover:bg-primary"
          }`}
        >
          {active ? (
            <Pause className={density === "large" ? "h-5 w-5 fill-current" : "h-4 w-4 fill-current"} />
          ) : (
            <Play className={`ml-0.5 ${density === "large" ? "h-5 w-5" : "h-4 w-4"} fill-current`} />
          )}
        </button>

        <div className="ml-auto flex items-center gap-2 text-on-surface-variant">
          <button
            type="button"
            className="rounded-full p-1 transition-colors hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Ver detalles"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetails(button);
            }}
          >
            <MoreVertical className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="rounded-full p-1 transition-colors hover:bg-surface-container-high hover:text-on-surface"
            aria-label={isFavorite ? "Quitar de favoritos" : "Marcar favorito"}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(button);
            }}
          >
            <Star className={`h-3 w-3 ${isFavorite ? "fill-primary text-primary" : ""}`} />
          </button>
        </div>
      </div>

      {hasLabel ? (
        <div className="flex min-h-0 flex-1 items-center px-3 pb-3">
          <p
            className={`min-w-0 overflow-hidden font-semibold leading-tight tracking-tight text-on-surface ${textSize}`}
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {button.label}
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1" />
      )}

      {active && (
        <div className="px-3 pb-3">
          <div className="h-1 w-full rounded-full bg-on-surface/10">
            <div className="progress-bar h-1 rounded-full" style={{ width: "33%" }} />
          </div>
        </div>
      )}
    </div>
  );
}
