import { Clock3, RotateCcw } from "lucide-react";
import type { RecentPlaybackEvent } from "@/types/routlis";

export function BoardRecentStrip({
  events,
  onPlay,
}: {
  events: RecentPlaybackEvent[];
  onPlay: (audioButtonId: string) => void;
}) {
  if (!events.length) return null;

  return (
    <section className="mb-4 rounded-[24px] border border-outline-variant bg-surface-container/80 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight text-on-surface">Historial rápido</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {events.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => onPlay(event.audioButton.id)}
            className="inline-flex min-w-[180px] items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-high px-3 py-2 text-left text-sm text-on-surface transition-colors hover:border-primary/40 hover:bg-surface-container"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <RotateCcw className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              {event.audioButton.label.trim().length > 0 ? (
                <span className="block truncate font-medium">{event.audioButton.label}</span>
              ) : null}
              {event.audioButton.category.name.trim().length > 0 ? (
                <span className="block truncate text-xs text-on-surface-variant">
                  {event.audioButton.category.name}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
