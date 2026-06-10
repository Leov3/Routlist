import { Search } from "lucide-react";

export function AudioSearch({
  value,
  onChange,
  placeholder = "Buscar audio",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`relative block ${className}`}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-14 w-full rounded-full border border-outline bg-surface-container-highest pl-12 pr-4 text-base text-on-surface outline-none transition-all duration-300 ease-[var(--ease-expressive)] hover:bg-surface-variant focus:border-primary focus:bg-surface focus:ring-1 focus:ring-primary"
      />
    </label>
  );
}
