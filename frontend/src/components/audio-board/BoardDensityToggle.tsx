import { Box, ScanLine, SquareStack } from "lucide-react";
import type { ComponentType } from "react";
import type { BoardDensity } from "@/types/routlis";

export function BoardDensityToggle({
  value,
  onChange,
  fullWidth = false,
  compact = false,
}: {
  value: BoardDensity;
  onChange: (next: BoardDensity) => void;
  fullWidth?: boolean;
  compact?: boolean;
}) {
  const items: Array<{ value: BoardDensity; label: string; icon: ComponentType<{ className?: string }> }> = [
    { value: "compact", label: "Compacta", icon: ScanLine },
    { value: "medium", label: "Mediana", icon: Box },
    { value: "large", label: "Grande", icon: SquareStack },
  ];

  return (
    <div
      className={`grid rounded-[16px] border border-outline-variant bg-surface-container-high p-1 shadow-[0_8px_18px_rgba(0,0,0,.08)] ${
        fullWidth ? "w-full grid-cols-3" : "w-auto min-w-[320px] grid-cols-3"
      }`}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={value === item.value}
            onClick={() => onChange(item.value)}
            className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-[12px] font-medium transition-all ${
              compact ? "px-2 py-1.5 text-[11px]" : "px-2.5 py-2 text-xs sm:px-3"
            } ${
              value === item.value
                ? "bg-primary text-on-primary shadow-elevation-1"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
