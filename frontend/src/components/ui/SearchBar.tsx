"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Buscar..." }: SearchBarProps) {
  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all focus:border-primary focus:bg-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
    </div>
  );
}
