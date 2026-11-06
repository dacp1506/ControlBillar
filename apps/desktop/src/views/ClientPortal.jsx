import { useMemo, useState } from 'react';
import PaymentQrModal from '../components/PaymentQrModal.jsx';

const initialTables = [
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

function getDurationHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5));
  const endMinutes = Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3, 5));
  const difference = endMinutes - startMinutes;
  if (difference === 0) return 0;
  return (difference < 0 ? difference + 24 * 60 : difference) / 60;
}

const fieldClass =
  'w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500';

const statusCopy = {
  available: 'Disponible hoy',
  occupied: 'Ocupada en sala',
  reserved: 'Reservada',
  paused: 'Pausada',
};

function ClientPortal() {
  const [tables, setTables] = useState(initialTables);
  const [selectedTableId, setSelectedTableId] = useState(1);
  const [date, setDate] = useState(getLocalDate);
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('21:00');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState(null);

  const selectedTable = tables.find((table) => table.id === selectedTableId);
  const durationHours = useMemo(
    () => getDurationHours(startTime, endTime),
    [startTime, endTime],
  );
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
      tableId: selectedTable.id,
      customerName: name.trim(),
      phone: phone.trim(),
      tableName: selectedTable.name,
      date,
      startTime,
      endTime,
      totalLabel: money(total),
    });
  }

  function markTableReserved(tableId) {
    setTables((current) =>
      current.map((table) =>
        table.id === tableId ? { ...table, status: 'reserved' } : table,
      ),
    );
  }

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 p-6 sm:p-10">
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
            <span aria-hidden="true">⚡</span> Reservas 24/7 en tiempo real
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Reserva tu mesa de billar preferida al instante
          </h1>
          <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Asegura tu horario sin filas. Elige la mesa de tu preferencia, confirma tu tiempo y
            paga fácilmente mediante código QR.
          </p>
          <a
            className="inline-flex rounded-xl bg-emerald-400 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-300"
            href="#reserva"
          >
            Reservar una mesa
          </a>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(#10b981_1px,transparent_1px)] opacity-10 [background-size:16px_16px]" />
      </div>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-3" id="reserva">
        <div className="space-y-4 lg:col-span-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="size-2 rounded-full bg-emerald-400" />
              Selección de mesa en salón
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Haz clic en una mesa disponible para seleccionarla en tu reserva
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {tables.map((table) => {
                const isSelected = table.id === selectedTableId;
                const isAvailable = table.status === 'available';
                return (
                  <button
                    aria-pressed={isSelected}
                    className={`space-y-2 rounded-2xl border p-4 text-center transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-950/20 ring-2 ring-emerald-500/40'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                    disabled={!isAvailable}
                    key={table.id}
                    onClick={() => setSelectedTableId(table.id)}
                    type="button"
                  >
                    <span
                      className={`mx-auto grid size-10 place-items-center rounded-full text-base font-bold ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {table.id}
                    </span>
                    <span className="block">
                      <span className="block text-sm font-bold text-white">{table.name}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">{table.type}</span>
                    </span>
                    <span
                      className={`block text-[10px] font-semibold ${
                        isAvailable ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {statusCopy[table.status]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 text-xs text-slate-300 sm:grid-cols-3">
            <p className="flex items-center gap-2">
              <span aria-hidden="true">🛡️</span> Mesas profesional tournament
            </p>
            <p className="flex items-center gap-2">
              <span aria-hidden="true">🏷️</span> Tarifa normal: <b>{money(30)} / hr</b>
            </p>
            <p className="flex items-center gap-2">
              <span aria-hidden="true">⭐</span> Mesa VIP Lounge: <b>{money(45)} / hr</b>
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="size-2 rounded-full bg-emerald-400" />
              Detalle de reserva
            </h2>
            <p className="mt-1 text-xs text-slate-400">Completa los datos requeridos</p>
          </div>

          <form
            className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6"
            onSubmit={handleSubmit}
          >
            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-300">
                Mesa seleccionada:
              </span>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-slate-950 px-3 py-2">
                <span className="text-sm font-bold text-emerald-400">
                  {selectedTable ? `${selectedTable.name} (${selectedTable.type})` : 'Sin mesa'}
                </span>
                <span className="shrink-0 text-xs font-normal text-slate-400">
                  {money(selectedTable?.rate ?? 0)}/hr
                </span>
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-300">
                Nombre completo:
              </span>
              <input
                autoComplete="name"
                className={fieldClass}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Carlos Mendoza"
                required
                value={name}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-300">
                Teléfono / WhatsApp:
              </span>
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

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-300">Fecha:</span>
              <input
                className={fieldClass}
                min={getLocalDate()}
                onChange={(event) => setDate(event.target.value)}
                required
                type="date"
                value={date}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-300">
                  Hora inicio:
                </span>
                <input
                  className={fieldClass}
                  onChange={(event) => setStartTime(event.target.value)}
                  required
                  type="time"
                  value={startTime}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-300">
                  Hora fin:
                </span>
                <input
                  className={fieldClass}
                  onChange={(event) => setEndTime(event.target.value)}
                  required
                  type="time"
                  value={endTime}
                />
              </label>
            </div>

            <div className="space-y-1 border-t border-slate-800 pt-3">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Duración estimada:</span>
                <span>
                  {durationHours > 0
                    ? `${Number(durationHours.toFixed(2))} ${durationHours === 1 ? 'hora' : 'horas'}`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between pt-1 text-sm font-bold text-white">
                <span>Total a pagar:</span>
                <span className="text-base text-emerald-400">{money(total)}</span>
              </div>
            </div>

            {error && (
              <p
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              type="submit"
            >
              <span aria-hidden="true">▦</span> Reservar y pagar con QR
            </button>
          </form>
        </div>
      </section>

      {reservation && (
        <PaymentQrModal
          onClose={() => setReservation(null)}
          onPaid={() => markTableReserved(reservation.tableId)}
          reservation={reservation}
        />
      )}
    </section>
  );
}

export default ClientPortal;
