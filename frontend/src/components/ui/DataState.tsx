export function DataState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-outline-variant bg-surface-container py-16 text-sm text-on-surface-variant">
      {children}
    </div>
  );
}
