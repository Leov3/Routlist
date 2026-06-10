type StatusBadgeProps = {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
};

export function StatusBadge({ active, activeLabel = "Activo", inactiveLabel = "Inactivo" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-outline-variant/30 text-on-surface-variant"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-on-surface-variant"}`}
      />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
