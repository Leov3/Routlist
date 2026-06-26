export default function MailQueuePage() {
  return (
    <div className="grid gap-6">
      <section className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1 sm:p-5">
        <h2 className="text-xl font-semibold text-on-surface">Cola</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Estructura preparada para correos pendientes, fallidos y en reintento.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <QueueStat label="Pendientes" value="0" tone="warning" />
          <QueueStat label="Fallidos" value="0" tone="danger" />
          <QueueStat label="Reintento" value="0" tone="neutral" />
        </div>
      </section>

      <section className="rounded-[28px] border border-dashed border-outline-variant bg-surface-container-high p-4 text-sm text-on-surface-variant shadow-elevation-1 sm:p-5">
        <p className="font-semibold text-on-surface">Próxima iteración</p>
        <p className="mt-2">
          Aquí se listarán los mensajes pendientes, el estado de reintentos y las acciones manuales de recuperación.
        </p>
      </section>
    </div>
  );
}

function QueueStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "warning" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "warning"
      ? "warning-surface-strong"
      : tone === "danger"
        ? "danger-surface"
        : "border border-outline-variant bg-surface";

  return (
    <div className={`rounded-2xl px-4 py-3 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
