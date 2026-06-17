"use client";

import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export function MailModuleShell({
  children,
  onReload,
  action,
}: {
  children: React.ReactNode;
  onReload?: () => void;
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  const meta = getMailPageMeta(pathname);

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.title}
        description={meta.description}
        action={
          onReload || action ? (
            <div className="flex items-center gap-2">
              {action}
              {onReload ? (
                <button
                  type="button"
                  onClick={onReload}
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface transition hover:border-primary"
                >
                  <RefreshCw className="h-4 w-4" />
                  Recargar
                </button>
              ) : null}
            </div>
          ) : null
        }
      />

      {children}
    </div>
  );
}

function getMailPageMeta(pathname: string) {
  if (pathname === "/admin/mail/test") {
    return {
      title: "Pruebas de correo",
      description: "Envía correos de prueba para verificar la configuración SMTP.",
    };
  }
  if (pathname === "/admin/mail/templates") {
    return {
      title: "Plantillas de correo",
      description: "Crea, edita, duplica o elimina plantillas transaccionales.",
    };
  }
  if (pathname === "/admin/mail/events") {
    return {
      title: "Eventos de correo",
      description: "Define qué acciones de Routlis generan notificaciones automáticas.",
    };
  }
  if (pathname === "/admin/mail/logs") {
    return {
      title: "Historial de correos",
      description: "Consulta envíos exitosos, fallidos y respuestas SMTP.",
    };
  }
  return {
    title: "SMTP",
    description: "Configura el proveedor global de envío de correos de Routlis.",
  };
}
