import { useEffect, useState } from 'react';
import PosPanel from '../components/PosPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const initialTables = [
  { id: 1, name: 'Mesa 1', type: 'Profesional 9 ft', status: 'occupied', hourlyRate: 30, seconds: 2450, consumption: [{ id: 'beer', name: 'Cerveza Paceña', price: 20, quantity: 1 }, { id: 'snacks', name: 'Nachos con queso', price: 35, quantity: 1 }] },
  { id: 2, name: 'Mesa 2', type: 'Profesional 9 ft', status: 'available', hourlyRate: 30, seconds: 0, consumption: [] },
  { id: 3, name: 'Mesa 3', type: 'Profesional 9 ft', status: 'occupied', hourlyRate: 30, seconds: 5400, consumption: [{ id: 'soda', name: 'Coca Cola 2L', price: 15, quantity: 1 }] },
  { id: 4, name: 'Mesa 4', type: 'VIP Lounge', status: 'reserved', hourlyRate: 45, seconds: 0, consumption: [] },
  { id: 5, name: 'Mesa 5', type: 'Profesional 9 ft', status: 'occupied', hourlyRate: 30, seconds: 120, consumption: [] },
  { id: 6, name: 'Mesa 6', type: 'VIP Lounge', status: 'available', hourlyRate: 45, seconds: 0, consumption: [] },
];

const money = (amount) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount);

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function TableIcon({ className }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <rect height="7" rx="1.5" width="7" x="3" y="3" />
      <rect height="7" rx="1.5" width="7" x="14" y="3" />
      <rect height="7" rx="1.5" width="7" x="3" y="14" />
      <rect height="7" rx="1.5" width="7" x="14" y="14" />
    </svg>
  );
}

function CalendarIcon({ className }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <rect height="16" rx="2" width="18" x="3" y="5" />
      <path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}

function StopwatchIcon({ className }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6" strokeLinecap="round" />
    </svg>
  );
}

function BeerIcon({ className }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M6 8h11v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8Z" strokeLinejoin="round" />
      <path d="M17 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M6 8V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2M9 12v5M13 12v5" strokeLinecap="round" />
    </svg>
  );
}

function MetricCard({ label, value, note, accent, tile, icon }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
      <div className="relative z-10 space-y-1 pr-14">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className={`flex items-center gap-1 text-xs font-medium ${accent}`}>{note}</p>
      </div>
      <div className={`absolute right-4 top-4 z-10 grid size-12 place-items-center rounded-xl border ${tile}`}>
        {icon}
      </div>
      <div className="absolute -bottom-4 -right-4 size-24 rounded-full bg-white/[0.02] blur-xl" />
    </article>
  );
}

function AdminDashboard() {
  const [tables, setTables] = useState(initialTables);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [notice, setNotice] = useState('');
  const [closedTotals, setClosedTotals] = useState({ time: 0, bar: 0, items: 0 });

  const occupiedCount = tables.filter((table) => table.status === 'occupied').length;
  const reservedCount = tables.filter((table) => table.status === 'reserved').length;
  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? null;
  const activeTables = tables.filter(
    (table) => table.status === 'occupied' || table.status === 'paused',
  );

  const openBarTotal = tables.reduce(
    (sum, table) =>
      sum + table.consumption.reduce((itemsTotal, item) => itemsTotal + item.price * item.quantity, 0),
    0,
  );
  const openTimeTotal = tables.reduce(
    (sum, table) =>
      sum +
      (['occupied', 'paused'].includes(table.status)
        ? (table.seconds / 3600) * table.hourlyRate
        : 0),
    0,
  );
  const openItems = tables.reduce(
    (sum, table) => sum + table.consumption.reduce((items, item) => items + item.quantity, 0),
    0,
  );
  const consumptionTotal = closedTotals.bar + openBarTotal;
  const timeRevenue = closedTotals.time + openTimeTotal;
  const consumptionItems = closedTotals.items + openItems;
  const occupancy = tables.length ? Math.round((occupiedCount / tables.length) * 100) : 0;
  const nextReserved = tables.find((table) => table.status === 'reserved');

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setTables((currentTables) =>
        currentTables.map((table) =>
          table.status === 'occupied' ? { ...table, seconds: table.seconds + 1 } : table,
        ),
      );
    }, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  function openTable(tableId) {
    setTables((current) =>
      current.map((table) =>
        table.id === tableId
          ? { ...table, status: 'occupied', seconds: table.seconds || 0 }
          : table,
      ),
    );
    setSelectedTableId(tableId);
    setNotice(`Cronómetro iniciado para ${tables.find((table) => table.id === tableId)?.name}.`);
  }

  function pauseTable(tableId) {
    setTables((current) =>
      current.map((table) =>
        table.id === tableId ? { ...table, status: 'paused' } : table,
      ),
    );
    setSelectedTableId(tableId);
    setNotice(`${tables.find((table) => table.id === tableId)?.name} en pausa.`);
  }

  function resumeTable(tableId) {
    setTables((current) =>
      current.map((table) =>
        table.id === tableId ? { ...table, status: 'occupied' } : table,
      ),
    );
    setSelectedTableId(tableId);
  }

  function closeTable(table) {
    const itemsTotal = table.consumption.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const itemsCount = table.consumption.reduce((sum, item) => sum + item.quantity, 0);
    const timeTotal = (table.seconds / 3600) * table.hourlyRate;
    setClosedTotals((current) => ({
      time: current.time + timeTotal,
      bar: current.bar + itemsTotal,
      items: current.items + itemsCount,
    }));
    setTables((current) =>
      current.map((item) =>
        item.id === table.id
          ? { ...item, status: 'available', seconds: 0, consumption: [] }
          : item,
      ),
    );
    if (selectedTableId === table.id) setSelectedTableId(null);
    setNotice(
      `${table.name} cobrada · Tiempo ${money(timeTotal)} + bar ${money(itemsTotal)} = ${money(timeTotal + itemsTotal)}.`,
    );
  }

  function addProduct(tableId, product) {
    setTables((current) =>
      current.map((table) => {
        if (table.id !== tableId) return table;
        const existingItem = table.consumption.find((item) => item.id === product.id);
        const consumption = existingItem
          ? table.consumption.map((item) =>
              item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
            )
          : [...table.consumption, { ...product, quantity: 1 }];
        return { ...table, consumption };
      }),
    );
  }

  const borderStyles = {
    occupied: 'border-amber-500/40 shadow-amber-500/5',
    available: 'border-slate-800',
    reserved: 'border-sky-500/30',
    paused: 'border-slate-600/60',
  };

  const actionButton =
    'flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          accent="text-emerald-400"
          icon={<TableIcon className="size-6" />}
          label="Mesas ocupadas"
          note={`${occupancy}% de ocupación actual`}
          tile="border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          value={`${occupiedCount} / ${tables.length}`}
        />
        <MetricCard
          accent="text-sky-400"
          icon={<CalendarIcon className="size-6" />}
          label="Reservas de hoy"
          note={nextReserved ? `Próxima: ${nextReserved.name}` : 'Sin reservas programadas'}
          tile="border-sky-500/20 bg-sky-500/10 text-sky-400"
          value={reservedCount}
        />
        <MetricCard
          accent="text-amber-400"
          icon={<StopwatchIcon className="size-6" />}
          label="Ingresos por tiempo"
          note="Tiempo cobrado y sesiones en curso"
          tile="border-amber-500/20 bg-amber-500/10 text-amber-400"
          value={money(timeRevenue)}
        />
        <MetricCard
          accent="text-purple-400"
          icon={<BeerIcon className="size-6" />}
          label="Ventas de bar POS"
          note={`${consumptionItems} consumo(s) hoy`}
          tile="border-purple-500/20 bg-purple-500/10 text-purple-400"
          value={money(consumptionTotal)}
        />
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" role="status">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <span className="size-2 rounded-full bg-emerald-400" />
                Estado de mesas en tiempo real
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Control individual de cronometraje y consumos asociados
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-emerald-500" /> Disponible
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-amber-500" /> Ocupada
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-sky-500" /> Reservada
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {tables.map((table) => {
              const itemsTotal = table.consumption.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0,
              );
              const timeTotal = (table.seconds / 3600) * table.hourlyRate;
              const total = timeTotal + itemsTotal;
              const itemsCount = table.consumption.reduce((sum, item) => sum + item.quantity, 0);

              return (
                <article
                  key={table.id}
                  className={`relative space-y-3 overflow-hidden rounded-2xl border bg-slate-900 p-4 shadow-lg shadow-black/10 transition-all ${borderStyles[table.status]}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="flex items-center gap-2 text-base font-extrabold text-white">
                        {table.name}
                        <span className="rounded-md bg-slate-950 px-2 py-0.5 text-[10px] font-normal text-slate-400">
                          {table.type}
                        </span>
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Tarifa: {money(table.hourlyRate)}/h
                      </p>
                    </div>
                    <StatusBadge status={table.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800/80 bg-slate-950 p-3 text-center">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-400">Tiempo de juego</p>
                      <p className={`mt-1 font-mono text-lg font-black ${table.status === 'occupied' ? 'pulse-timer text-amber-400' : 'text-slate-500'}`}>
                        {formatTime(table.seconds)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-400">Monto parcial</p>
                      <p className="mt-1 font-mono text-lg font-black text-emerald-400">
                        {money(total)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Consumos bar ({itemsCount}):</span>
                      <span className="font-bold text-white">{money(itemsTotal)}</span>
                    </div>
                    {table.consumption.length > 0 && (
                      <div className="max-h-16 space-y-0.5 overflow-y-auto rounded-lg border border-slate-800/60 bg-slate-950/60 p-1.5 text-[10px] text-slate-400">
                        {table.consumption.map((item) => (
                          <div className="flex justify-between gap-2" key={item.id}>
                            <span>• {item.name} × {item.quantity}</span>
                            <span>{money(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {table.status === 'available' && (
                      <button
                        className={`${actionButton} w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400`}
                        onClick={() => openTable(table.id)}
                        type="button"
                      >
                        <span aria-hidden="true">▶</span> Iniciar tiempo
                      </button>
                    )}

                    {table.status === 'occupied' && (
                      <>
                        <button
                          className={`${actionButton} flex-1 bg-slate-800 text-amber-400 hover:bg-slate-700`}
                          onClick={() => pauseTable(table.id)}
                          type="button"
                        >
                          <span aria-hidden="true">❚❚</span> Pausar
                        </button>
                        <button
                          className={`${actionButton} flex-1 bg-emerald-500 text-slate-950 hover:bg-emerald-400`}
                          onClick={() => closeTable(table)}
                          type="button"
                        >
                          Cobrar
                        </button>
                      </>
                    )}

                    {table.status === 'paused' && (
                      <>
                        <button
                          className={`${actionButton} flex-1 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20`}
                          onClick={() => resumeTable(table.id)}
                          type="button"
                        >
                          <span aria-hidden="true">▶</span> Reanudar
                        </button>
                        <button
                          className={`${actionButton} flex-1 bg-emerald-500 text-slate-950 hover:bg-emerald-400`}
                          onClick={() => closeTable(table)}
                          type="button"
                        >
                          Cobrar
                        </button>
                      </>
                    )}

                    {table.status === 'reserved' && (
                      <button
                        className={`${actionButton} w-full bg-sky-500 text-slate-950 hover:bg-sky-400`}
                        onClick={() => openTable(table.id)}
                        type="button"
                      >
                        Abrir reserva
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <PosPanel
          occupiedTables={activeTables}
          onAddProduct={addProduct}
          onSelectTable={setSelectedTableId}
          table={
            selectedTable && ['occupied', 'paused'].includes(selectedTable.status)
              ? selectedTable
              : null
          }
        />
      </div>
    </section>
  );
}

export default AdminDashboard;
