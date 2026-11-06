const statusStyles = {
  available: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  occupied: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  reserved: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
};

const statusLabels = {
  available: 'Disponible',
  occupied: 'Ocupada',
  reserved: 'Reservada',
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusStyles[status]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}

export default StatusBadge;
