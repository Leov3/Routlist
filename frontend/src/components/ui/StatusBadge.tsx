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
          ? "success-surface"
          : "bg-outline-variant/30 text-on-surface-variant"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[color:var(--success-icon)]" : "bg-on-surface-variant"}`}
      />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
