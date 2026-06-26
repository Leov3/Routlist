import { AudioButton } from "./AudioButton";
import type { BoardAudioButton, BoardCategory } from "@/types/routlis";

export function CategorySection({
  category,
  activeButtonId,
  onPlay,
  onStop,
  onOpenDetails,
}: {
  category: BoardCategory;
  activeButtonId: string | null;
  onPlay: (button: BoardAudioButton) => void;
  onStop: () => void;
  onOpenDetails: (button: BoardAudioButton) => void;
}) {
  return (
    <section className="mb-8">
      {/* Category header */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="h-4 w-0.5 rounded-full bg-primary" />
          <h2 className="text-base font-semibold tracking-tight text-on-surface">
            {category.name}
          </h2>
          {category.description && (
            <p className="text-sm text-on-surface-variant">{category.description}</p>
          )}
        </div>
        <span className="rounded-full border border-outline-variant bg-surface-container px-2.5 py-0.5 text-xs font-medium text-on-surface-variant">
          {category.buttons.length} botón{category.buttons.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Buttons grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {category.buttons.map((button) => (
          <AudioButton
            key={button.id}
            button={button}
            active={activeButtonId === button.id}
            isFavorite={false}
            onPlay={onPlay}
            onStop={onStop}
            onToggleFavorite={() => undefined}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </div>
    </section>
  );
}
