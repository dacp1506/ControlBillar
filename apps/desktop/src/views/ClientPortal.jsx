import { useMemo, useState } from 'react';
import PaymentQrModal from '../components/PaymentQrModal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const tableOptions = [
  { id: 1, name: 'Mesa 1', type: 'Profesional', rate: 30, status: 'available' },
  { id: 2, name: 'Mesa 2', type: 'Profesional', rate: 30, status: 'available' },
  { id: 3, name: 'Mesa 3', type: 'Profesional', rate: 30, status: 'occupied' },
  { id: 4, name: 'Mesa 4', type: 'VIP Lounge', rate: 45, status: 'reserved' },
  { id: 5, name: 'Mesa 5', type: 'Profesional', rate: 30, status: 'available' },
  { id: 6, name: 'Mesa 6', type: 'VIP Lounge', rate: 45, status: 'available' },
];

const money = (amount) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount);

function getLocalDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

const fieldClass =
  'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400';

function ClientPortal() {
  const [selectedTableId, setSelectedTableId] = useState(1);
  const [date, setDate] = useState(getLocalDate);
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('21:00');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState(null);

  const selectedTable = tableOptions.find((table) => table.id === selectedTableId);
  const durationHours = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5));
    const endMinutes = Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3, 5));
    return (endMinutes - startMinutes) / 60;
  }, [startTime, endTime]);
  const total = Math.max(durationHours, 0) * (selectedTable?.rate ?? 0);

  function handleSubmit(event) {
    event.preventDefault();
    if (durationHours <= 0) {
      setError('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }
    if (!selectedTable || selectedTable.status !== 'available') {
      setError('Selecciona una mesa disponible para continuar.');
      return;
    }

    setError('');
    setReservation({
      customerName: name.trim(),
      phone: phone.trim(),
      tableName: selectedTable.name,
      date,
      startTime,
      endTime,
      totalLabel: money(total),
    });
  }

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/50 p-6 sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
            Reservas en línea · Abierto todos los días
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-5xl">
            Tu próxima partida empieza aquí.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Elige tu mesa, reserva el horario que prefieras y disfruta una experiencia de billar
            hecha para compartir.
          </p>
          <a
            href="#reserva"
            className="mt-6 inline-flex rounded-xl bg-emerald-400 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-300"
          >
            Reservar una mesa
          </a>
        </div>
        <div className="pointer-events-none absolute -right-12 -top-20 size-80 rounded-full border-[40px] border-emerald-500/5" />
        <div className="pointer-events-none absolute -bottom-36 right-28 size-80 rounded-full border-[40px] border-teal-400/5" />
      </div>

      <section aria-labelledby="tables-title" className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">El salón</p>
          <h2 id="tables-title" className="mt-1 text-xl font-extrabold sm:text-2xl">
            Nuestras mesas y tarifas
          </h2>
          <p className="mt-1 text-sm text-slate-400">Tarifa por hora. La disponibilidad es de demostración.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tableOptions.map((table) => (
            <button
              key={table.id}
              type="button"
              disabled={table.status !== 'available'}
              aria-pressed={selectedTableId === table.id}
              onClick={() => setSelectedTableId(table.id)}
              className={`rounded-2xl border bg-slate-900 p-4 text-left transition ${
                selectedTableId === table.id
                  ? 'border-emerald-400/60 ring-1 ring-emerald-400/20'
                  : 'border-slate-800 hover:border-slate-600'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{table.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{table.type}</p>
                </div>
                <StatusBadge status={table.status} />
              </div>
              <p className="mt-4 text-lg font-extrabold text-emerald-300">
                {money(table.rate)} <span className="text-xs font-medium text-slate-500">/ hora</span>
              </p>
            </button>
          ))}
        </div>
      </section>

      <section id="reserva" className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6 lg:col-span-2">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Reserva online</p>
            <h2 className="mt-1 text-xl font-extrabold">Realizar una reserva</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-300">Nombre completo</span>
                <input
                  autoComplete="name"
                  className={fieldClass}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ej. Camila Rojas"
                  required
                  value={name}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-300">Teléfono / WhatsApp</span>
                <input
                  autoComplete="tel"
                  className={fieldClass}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Ej. 77912345"
                  required
                  type="tel"
                  value={phone}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-300">Mesa seleccionada</span>
              <select
                className={fieldClass}
                onChange={(event) => setSelectedTableId(Number(event.target.value))}
                value={selectedTableId}
              >
                {tableOptions.map((table) => (
                  <option key={table.id} disabled={table.status !== 'available'} value={table.id}>
                    {table.name} · {table.type} · {money(table.rate)}/h
                    {table.status !== 'available' ? ' · No disponible' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-300">Fecha</span>
              <input
                className={fieldClass}
                min={getLocalDate()}
                onChange={(event) => setDate(event.target.value)}
                required
                type="date"
                value={date}
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-300">Hora de inicio</span>
                <input
                  className={fieldClass}
                  onChange={(event) => setStartTime(event.target.value)}
                  required
                  type="time"
                  value={startTime}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-300">Hora de fin</span>
                <input
                  className={fieldClass}
                  onChange={(event) => setEndTime(event.target.value)}
                  required
                  type="time"
                  value={endTime}
                />
              </label>
            </div>

            {error && (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
                {error}
              </p>
            )}

            <button
              className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-300"
              type="submit"
            >
              Continuar al pago QR
            </button>
          </form>
        </div>

        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Resumen</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3 text-slate-400">
              <span>Mesa</span>
              <span className="font-semibold text-slate-200">{selectedTable?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-3 text-slate-400">
              <span>Duración</span>
              <span className="font-semibold text-slate-200">
                {durationHours > 0 ? `${durationHours} h` : '—'}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-slate-400">
              <span>Tarifa</span>
              <span className="font-semibold text-slate-200">{money(selectedTable?.rate ?? 0)}/h</span>
            </div>
            <div className="border-t border-slate-800 pt-4">
              <p className="text-xs text-slate-400">Total estimado</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-300">{money(total)}</p>
            </div>
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">
            Las reservas y el pago QR son una demostración visual; aún no se conectan con el backend.
          </p>
        </aside>
      </section>

      {reservation && (
        <PaymentQrModal
          reservation={reservation}
          onClose={() => setReservation(null)}
        />
      )}
    </section>
  );
}

export default ClientPortal;
