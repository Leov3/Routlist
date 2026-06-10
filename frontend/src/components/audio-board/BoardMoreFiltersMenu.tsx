import { Filter, ChevronDown, SlidersHorizontal, Star, Clock3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BoardQuickFilter } from "./board-ui";

export function BoardMoreFiltersMenu({
  quickFilter,
  onQuickFilterChange,
}: {
  quickFilter: BoardQuickFilter;
  onQuickFilterChange: (next: BoardQuickFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!open) return;
      const target = event.target as Node | null;
      if (ref.current && target && !ref.current.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-14 items-center gap-3 rounded-full border border-outline-variant bg-surface-container px-5 text-sm font-medium text-on-surface transition-colors hover:border-primary/40 hover:bg-surface-container-high"
      >
        <SlidersHorizontal className="h-4 w-4 text-on-surface-variant" />
        Más filtros
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-20 w-72 rounded-2xl border border-outline-variant bg-surface-container-high p-2 shadow-[0_22px_50px_rgba(0,0,0,.18)]">
          <button
            type="button"
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-container ${
              quickFilter === "all" ? "text-on-surface" : "text-on-surface-variant"
            }`}
            onClick={() => {
              onQuickFilterChange("all");
              setOpen(false);
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Filter className="h-4 w-4 text-on-surface-variant" />
              Sin filtro extra
            </span>
            <span className="text-xs text-on-surface-variant">
              {quickFilter === "all" ? "Activo" : "Cambiar"}
            </span>
          </button>
          <button
            type="button"
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-container ${
              quickFilter === "favorites" ? "text-on-surface" : "text-on-surface-variant"
            }`}
            onClick={() => {
              onQuickFilterChange(quickFilter === "favorites" ? "all" : "favorites");
              setOpen(false);
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Star className="h-4 w-4" />
              Favoritos
            </span>
            <span className="text-xs">{quickFilter === "favorites" ? "Activo" : "Ver"}</span>
          </button>
          <button
            type="button"
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-container ${
              quickFilter === "recent" ? "text-on-surface" : "text-on-surface-variant"
            }`}
            onClick={() => {
              onQuickFilterChange(quickFilter === "recent" ? "all" : "recent");
              setOpen(false);
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Recientes
            </span>
            <span className="text-xs">{quickFilter === "recent" ? "Activo" : "Ver"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
