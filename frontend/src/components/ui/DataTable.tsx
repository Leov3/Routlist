import type { ReactNode } from "react";

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  onSort?: (key: string) => void;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  emptyMessage?: string;
}

export function DataTable<T>({
  columns, rows, getKey, onSort, sortKey, sortDir, emptyMessage = "Sin resultados.",
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-outline-variant bg-surface-container-high">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant ${col.className ?? ""}`}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => onSort?.(col.key)}
                    className="inline-flex items-center gap-1 transition-colors hover:text-primary"
                  >
                    {col.label}
                    <span className="opacity-50">
                      {sortKey === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
                    </span>
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-on-surface-variant">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getKey(row)} className="border-b border-outline-variant/50 bg-surface-container transition-colors last:border-0 hover:bg-surface-container-high">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3.5 text-on-surface ${col.className ?? ""}`}>
                    {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as ReactNode}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
