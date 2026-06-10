import { Box, ScanLine, SquareStack } from "lucide-react";
import type { ComponentType } from "react";
import type { BoardDensity } from "@/types/routlis";

export function BoardDensityToggle({
  value,
  onChange,
}: {
  value: BoardDensity;
  onChange: (next: BoardDensity) => void;
}) {
  const items: Array<{ value: BoardDensity; label: string; icon: ComponentType<{ className?: string }> }> = [
    { value: "compact", label: "Compacta", icon: ScanLine },
    { value: "medium", label: "Mediana", icon: Box },
    { value: "large", label: "Grande", icon: SquareStack },
  ];

  return (
    <div className="inline-flex rounded-full border border-outline-variant bg-surface-container-high p-1 shadow-[0_12px_24px_rgba(0,0,0,.12)]">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-all ${
              value === item.value
                ? "bg-primary text-on-primary shadow-elevation-1"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
