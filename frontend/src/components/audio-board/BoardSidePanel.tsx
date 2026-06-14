"use client";

import { ArrowLeftRight } from "lucide-react";
import { useMemo } from "react";
import { AudioButton } from "./AudioButton";
import { AudioSearch } from "./AudioSearch";
import { BoardFilterChips } from "./BoardFilterChips";
import { BoardMoreFiltersMenu } from "./BoardMoreFiltersMenu";
import { filterBoardButtons, type BoardButton, type BoardCategoryOption, type BoardSideState } from "./board-ui";
import type { BoardDensity } from "@/types/routlis";

export function BoardSidePanel({
  title,
  subtitle,
  tone,
  buttons,
  categoryOptions,
  side,
  favoriteIds,
  recentIds,
  activeButtonId,
  onPlay,
  onStop,
  onToggleFavorite,
  onOpenDetails,
  onSwapSides,
  onSideChange,
  density,
}: {
  title: string;
  subtitle: string;
  tone: "violet" | "teal";
  buttons: BoardButton[];
  categoryOptions: BoardCategoryOption[];
  side: BoardSideState;
  favoriteIds: string[];
  recentIds: string[];
  activeButtonId: string | null;
  onPlay: (button: BoardButton) => void;
  onStop: () => void;
  onToggleFavorite: (button: BoardButton) => void;
  onOpenDetails: (button: BoardButton) => void;
  onSwapSides: () => void;
  onSideChange: (next: BoardSideState) => void;
  density: BoardDensity;
}) {
  const filteredButtons = useMemo(
    () =>
      filterBoardButtons({
        buttons,
        side,
        favoriteIds,
        recentIds,
      }),
    [buttons, favoriteIds, recentIds, side],
  );

  const toneClasses =
    tone === "violet"
      ? {
          dot: "bg-primary",
          badge: "border-primary/25 bg-primary/10 text-primary",
          panel: "shadow-[0_0_0_1px_rgba(124,58,237,.08),0_28px_60px_rgba(0,0,0,.12)]",
        }
      : {
          dot: "bg-emerald-400",
          badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
          panel: "shadow-[0_0_0_1px_rgba(52,211,153,.08),0_28px_60px_rgba(0,0,0,.12)]",
      };

  function updateQuickFilter(next: BoardSideState["quickFilter"]) {
    onSideChange({
      ...side,
      quickFilter: next,
      selectedCategoryId: next === "all" ? side.selectedCategoryId : "all",
    });
  }

  return (
    <section
      className={`flex max-h-[calc(100dvh-18rem)] min-h-0 flex-col overflow-hidden rounded-[28px] border border-outline-variant bg-surface-container-high p-5 ${toneClasses.panel}`}
    >
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${toneClasses.dot}`} />
            <h2 className="text-lg font-semibold tracking-tight text-on-surface">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSwapSides}
            className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-surface-container ${
              tone === "violet"
                ? "border-primary/25 bg-primary/10 text-on-surface"
                : "border-emerald-400/20 bg-emerald-400/10 text-on-surface"
            }`}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Intercambiar lados
          </button>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneClasses.badge}`}>
            {filteredButtons.length} audio{filteredButtons.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 2xl:flex-row 2xl:items-center">
        <AudioSearch
          value={side.search}
          onChange={(value) => onSideChange({ ...side, search: value })}
          placeholder={`Buscar audios en ${title}...`}
          className="min-w-0 flex-1"
        />

        <BoardMoreFiltersMenu
          quickFilter={side.quickFilter}
          onQuickFilterChange={updateQuickFilter}
        />
      </div>

      <BoardFilterChips
        categoryOptions={categoryOptions}
        selectedCategoryId={side.selectedCategoryId}
        onSelectCategory={(categoryId) => onSideChange({ ...side, selectedCategoryId: categoryId })}
        quickFilter={side.quickFilter}
        onQuickFilterChange={updateQuickFilter}
      />

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <div
          className={`grid gap-3 ${
            density === "compact"
              ? "md:grid-cols-3 xl:grid-cols-3"
              : density === "large"
                ? "md:grid-cols-1 xl:grid-cols-1"
                : "md:grid-cols-2 xl:grid-cols-2"
          }`}
        >
          {filteredButtons.length ? (
            filteredButtons.map((button) => (
              <AudioButton
                key={button.id}
                button={button}
                active={activeButtonId === button.id}
                isFavorite={favoriteIds.includes(button.id)}
                density={density}
                onPlay={onPlay}
                onStop={onStop}
                onToggleFavorite={onToggleFavorite}
                onOpenDetails={onOpenDetails}
              />
            ))
          ) : (
            <div className="col-span-full flex items-center justify-center rounded-[24px] border border-dashed border-outline-variant bg-surface py-16 text-sm text-on-surface-variant">
              No hay botones disponibles en este lado.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
