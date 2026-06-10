"use client";

interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterBarProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: FilterOption<T>[];
}

export function FilterBar<T extends string>({ value, onChange, options }: FilterBarProps<T>) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
            value === opt.value
              ? "bg-primary text-on-primary shadow-elevation-1"
              : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
