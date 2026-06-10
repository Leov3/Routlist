import { Clock3, Star } from "lucide-react";
import type { ReactNode } from "react";
import type { BoardCategoryOption, BoardQuickFilter } from "./board-ui";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all ${
        active
          ? "border-primary/40 bg-primary/15 text-on-surface shadow-[0_0_0_1px_rgba(124,58,237,.18)]"
          : "border-outline-variant bg-surface-container text-on-surface-variant hover:border-primary/30 hover:bg-surface-container-high hover:text-on-surface"
      }`}
    >
      {children}
    </button>
  );
}

export function BoardFilterChips({
  categoryOptions,
  selectedCategoryId,
  onSelectCategory,
  quickFilter,
  onQuickFilterChange,
}: {
  categoryOptions: BoardCategoryOption[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  quickFilter: BoardQuickFilter;
  onQuickFilterChange: (next: BoardQuickFilter) => void;
}) {
  const visibleCategoryOptions = categoryOptions.filter((category) => category.name.trim().length > 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip active={selectedCategoryId === "all"} onClick={() => onSelectCategory("all")}>
        Todos
      </Chip>
      {visibleCategoryOptions.map((category) => (
        <Chip
          key={category.id}
          active={selectedCategoryId === category.id}
          onClick={() => onSelectCategory(category.id)}
        >
          {category.name}
        </Chip>
      ))}
      <Chip
        active={quickFilter === "favorites"}
        onClick={() => onQuickFilterChange(quickFilter === "favorites" ? "all" : "favorites")}
      >
        <Star className="h-3.5 w-3.5" />
        Favoritos
      </Chip>
      <Chip
        active={quickFilter === "recent"}
        onClick={() => onQuickFilterChange(quickFilter === "recent" ? "all" : "recent")}
      >
        <Clock3 className="h-3.5 w-3.5" />
        Recientes
      </Chip>
    </div>
  );
}
