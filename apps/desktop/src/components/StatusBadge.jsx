const statusStyles = {
  available: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  occupied: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  reserved: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  paused: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
};

const statusLabels = {
  available: 'Disponible',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  paused: 'Pausada',
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusStyles[status] ?? statusStyles.available}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {statusLabels[status] ?? status}
    </span>
  );
}

export default StatusBadge;
