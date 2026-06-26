import { LayoutGrid, PanelLeft } from "lucide-react";
import type { BoardViewMode } from "./board-ui";

export function BoardViewModeToggle({
  value,
  onChange,
  fullWidth = false,
  compact = false,
}: {
  value: BoardViewMode;
  onChange: (next: BoardViewMode) => void;
  fullWidth?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid rounded-[16px] border border-outline-variant bg-surface-container-high p-1 shadow-[0_8px_18px_rgba(0,0,0,.08)] ${
        fullWidth ? "w-full grid-cols-2" : "w-auto min-w-[280px] grid-cols-2"
      }`}
    >
      <button
        type="button"
        aria-pressed={value === "simple"}
        onClick={() => onChange("simple")}
        className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-[12px] font-medium transition-all ${
          compact ? "px-2.5 py-1.5 text-[13px]" : "px-3 py-2 text-sm sm:px-4"
        } ${
          value === "simple"
            ? "bg-primary text-on-primary shadow-elevation-1"
            : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        }`}
      >
        <PanelLeft className="h-4 w-4" />
        <span className="truncate">Modo simple</span>
      </button>
      <button
        type="button"
        aria-pressed={value === "dual"}
        onClick={() => onChange("dual")}
        className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-[12px] font-medium transition-all ${
          compact ? "px-2.5 py-1.5 text-[13px]" : "px-3 py-2 text-sm sm:px-4"
        } ${
          value === "dual"
            ? "bg-primary text-on-primary shadow-elevation-1"
            : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        }`}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="truncate">2 columnas</span>
      </button>
    </div>
  );
}
