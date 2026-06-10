import type { BoardAudioButton } from "@/types/routlis";

export type BoardViewMode = "simple" | "dual";
export type BoardQuickFilter = "all" | "favorites" | "recent";

export type BoardSideState = {
  search: string;
  selectedCategoryId: string;
  quickFilter: BoardQuickFilter;
};

export type BoardCategoryOption = {
  id: string;
  name: string;
  count: number;
};

export type BoardButton = BoardAudioButton;

export function createDefaultSideState(): BoardSideState {
  return {
    search: "",
    selectedCategoryId: "all",
    quickFilter: "all",
  };
}

export function filterBoardButtons({
  buttons,
  side,
  favoriteIds,
  recentIds,
}: {
  buttons: BoardButton[];
  side: BoardSideState;
  favoriteIds: string[];
  recentIds: string[];
}) {
  const term = side.search.trim().toLowerCase();

  const filtered = buttons.filter((button) => {
    const matchesCategory =
      side.selectedCategoryId === "all" || button.category.id === side.selectedCategoryId;
    const matchesQuickFilter =
      side.quickFilter === "all" ||
      (side.quickFilter === "favorites" && favoriteIds.includes(button.id)) ||
      (side.quickFilter === "recent" && recentIds.includes(button.id));
    const matchesSearch =
      !term ||
      `${button.label} ${button.audioAsset.originalName} ${button.category.name}`
        .toLowerCase()
        .includes(term);

    return matchesCategory && matchesQuickFilter && matchesSearch;
  });

  if (side.quickFilter === "recent") {
    const rank = new Map(recentIds.map((id, index) => [id, index]));
    return filtered.sort((left, right) => (rank.get(left.id) ?? Infinity) - (rank.get(right.id) ?? Infinity));
  }

  if (side.quickFilter === "favorites") {
    const rank = new Map(favoriteIds.map((id, index) => [id, index]));
    return filtered.sort((left, right) => (rank.get(left.id) ?? Infinity) - (rank.get(right.id) ?? Infinity));
  }

  return filtered;
}
