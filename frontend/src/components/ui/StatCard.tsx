import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  accent?: "primary" | "secondary" | "tertiary" | "success";
}

const accentMap = {
  primary:   { bg: "bg-primary/10",   icon: "text-primary",   ring: "ring-primary/20" },
  secondary: { bg: "bg-secondary/10", icon: "text-secondary",  ring: "ring-secondary/20" },
  tertiary:  { bg: "bg-tertiary/10",  icon: "text-tertiary",   ring: "ring-tertiary/20" },
  success:   {
    bg: "bg-[color:var(--success-bg)]",
    icon: "text-[color:var(--success-icon)]",
    ring: "ring-[color:var(--success-border)]",
  },
};

export function StatCard({ label, value, sub, icon, accent = "primary" }: StatCardProps) {
  const colors = accentMap[accent];
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-outline-variant bg-surface-container p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-elevation-2">
      <div className="min-w-0">
        <p className="mb-1 text-sm text-on-surface-variant">{label}</p>
        <p className="text-2xl font-bold tracking-tight text-on-surface">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-on-surface-variant">{sub}</p>}
      </div>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${colors.bg} ${colors.ring}`}>
        <span className={colors.icon}>{icon}</span>
      </div>
    </div>
  );
}
