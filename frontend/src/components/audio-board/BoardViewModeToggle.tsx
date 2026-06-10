import { LayoutGrid, PanelLeft } from "lucide-react";
import type { BoardViewMode } from "./board-ui";

export function BoardViewModeToggle({
  value,
  onChange,
}: {
  value: BoardViewMode;
  onChange: (next: BoardViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-outline-variant bg-surface-container-high p-1 shadow-[0_12px_24px_rgba(0,0,0,.12)]">
      <button
        type="button"
        onClick={() => onChange("simple")}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
          value === "simple"
            ? "bg-primary text-on-primary shadow-elevation-1"
            : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        <PanelLeft className="h-4 w-4" />
        Modo simple
      </button>
      <button
        type="button"
        onClick={() => onChange("dual")}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
          value === "dual"
            ? "bg-primary text-on-primary shadow-elevation-1"
            : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        <LayoutGrid className="h-4 w-4" />
        Modo 2 columnas
      </button>
    </div>
  );
}
