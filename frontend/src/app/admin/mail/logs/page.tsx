"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MailLog } from "@/types/mail";

export default function MailLogsPage() {
  const [logs, setLogs] = useState<MailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api<MailLog[]>("/admin/mail/logs").then(setLogs).finally(() => setLoading(false));
  }, []);

  return loading ? <Shell>...</Shell> : (
    <div className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1 sm:p-5">
      <h2 className="text-xl font-semibold text-on-surface">Historial de correos</h2>
      <p className="mt-1 text-sm text-on-surface-variant">Consulta envíos exitosos, fallidos y respuestas SMTP.</p>
      <div className="mt-4 max-h-[55vh] overflow-auto pr-1 sm:max-h-[68vh]">
        <div className="space-y-2.5">
          {logs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-outline-variant bg-surface-container-high p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-on-surface">{log.subject}</p>
                  <p className="text-xs text-on-surface-variant">{log.to}</p>
                </div>
                <span className="rounded-full border border-outline-variant px-2.5 py-1 text-[11px]">{log.status}</span>
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">{log.type} · {new Date(log.createdAt).toLocaleString()}</p>
              {log.contextJson?.responseMessage && <p className="mt-1 text-xs text-on-surface-variant">Respuesta SMTP: {String(log.contextJson.responseMessage)}</p>}
              {log.errorMessage && <p className="mt-1 text-xs text-on-surface-variant">Error: {log.errorMessage}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1 text-sm text-on-surface-variant sm:p-5">{children}</div>;
}
