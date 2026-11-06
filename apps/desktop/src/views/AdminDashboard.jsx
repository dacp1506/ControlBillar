import { useEffect, useState } from 'react';
import PosPanel from '../components/PosPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const initialTables = [
  { id: 1, name: 'Mesa 1', type: 'Profesional 9 ft', status: 'occupied', hourlyRate: 30, seconds: 2450, consumption: [{ id: 'starter-beer', name: 'Cerveza Paceña', price: 20, quantity: 1 }, { id: 'starter-nachos', name: 'Nachos', price: 35, quantity: 1 }] },
  { id: 2, name: 'Mesa 2', type: 'Profesional 9 ft', status: 'available', hourlyRate: 30, seconds: 0, consumption: [] },
  { id: 3, name: 'Mesa 3', type: 'Profesional 9 ft', status: 'occupied', hourlyRate: 30, seconds: 5400, consumption: [{ id: 'starter-soda', name: 'Gaseosa', price: 12, quantity: 1 }] },
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

function MetricCard({ label, value, note, accent }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </div>
  );
}

function AdminDashboard() {
  const [tables, setTables] = useState(initialTables);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [notice, setNotice] = useState('');
  const occupiedCount = tables.filter((table) => table.status === 'occupied').length;
  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? null;

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

  function closeTable(table) {
    const consumptionTotal = table.consumption.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const total = (table.seconds / 3600) * table.hourlyRate + consumptionTotal;
    setTables((current) =>
      current.map((item) =>
        item.id === table.id
          ? { ...item, status: 'available', seconds: 0, consumption: [] }
          : item,
      ),
    );
    if (selectedTableId === table.id) setSelectedTableId(null);
    setNotice(`${table.name} cerrada · Total de la cuenta: ${money(total)}.`);
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

  const dailySales = tables.reduce(
    (sum, table) =>
      sum + table.consumption.reduce((itemsTotal, item) => itemsTotal + item.price * item.quantity, 0),
    0,
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            Administración
          </p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Panel de mesas</h1>
          <p className="mt-2 text-sm text-slate-400">
            Control de sesiones, cronómetros y consumos del salón.
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
          ● Sistema activo
        </span>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" role="status">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Mesas ocupadas"
          value={`${occupiedCount} / ${tables.length}`}
          note={`${Math.round((occupiedCount / tables.length) * 100)}% de ocupación actual`}
          accent="text-rose-300"
        />
        <MetricCard
          label="Mesas disponibles"
          value={tables.filter((table) => table.status === 'available').length}
          note={`${tables.filter((table) => table.status === 'reserved').length} reservada(s)`}
          accent="text-emerald-300"
        />
        <MetricCard
          label="Consumos abiertos"
          value={money(dailySales)}
          note="Productos asociados a sesiones activas"
          accent="text-amber-300"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Estado de mesas en tiempo real</h2>
              <p className="mt-1 text-xs text-slate-500">Tarifa y cuenta parcial por mesa</p>
            </div>
            <div className="flex gap-3 text-[11px] text-slate-400">
              <span><i className="mr-1.5 inline-block size-2 rounded-full bg-emerald-400" />Disponible</span>
              <span><i className="mr-1.5 inline-block size-2 rounded-full bg-rose-400" />Ocupada</span>
              <span><i className="mr-1.5 inline-block size-2 rounded-full bg-amber-300" />Reservada</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {tables.map((table) => {
              const consumptionTotal = table.consumption.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0,
              );
              const timeTotal = (table.seconds / 3600) * table.hourlyRate;
              const borderStyle = {
                occupied: 'border-rose-500/30',
                available: 'border-slate-800',
                reserved: 'border-amber-500/30',
              }[table.status];

              return (
                <article
                  key={table.id}
                  className={`rounded-2xl border bg-slate-900 p-4 shadow-lg shadow-black/10 ${borderStyle}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold">{table.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">{table.type}</p>
                    </div>
                    <StatusBadge status={table.status} />
                  </div>

                  <div className="my-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cronómetro</p>
                      <p className={`mt-1 font-mono text-lg font-extrabold ${table.status === 'occupied' ? 'text-rose-300' : 'text-slate-500'}`}>
                        {formatTime(table.seconds)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total parcial</p>
                      <p className="mt-1 font-mono text-lg font-extrabold text-emerald-300">
                        {money(timeTotal + consumptionTotal)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 flex justify-between text-xs text-slate-400">
                    <span>{money(table.hourlyRate)} / hora</span>
                    <span>{table.consumption.reduce((sum, item) => sum + item.quantity, 0)} consumos</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      disabled={table.status === 'occupied'}
                      onClick={() => openTable(table.id)}
                      className="rounded-lg bg-emerald-400 px-2 py-2 text-xs font-extrabold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      Abrir mesa
                    </button>
                    <button
                      type="button"
                      disabled={table.status !== 'occupied'}
                      onClick={() => setSelectedTableId(table.id)}
                      className={`rounded-lg border px-2 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600 ${
                        selectedTableId === table.id
                          ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                          : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Ver cuenta
                    </button>
                    <button
                      type="button"
                      disabled={table.status === 'available'}
                      onClick={() => closeTable(table)}
                      className="rounded-lg border border-rose-500/20 px-2 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
                    >
                      Liberar mesa
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <PosPanel
          table={selectedTable?.status === 'occupied' ? selectedTable : null}
          occupiedTables={tables.filter((table) => table.status === 'occupied')}
          onAddProduct={addProduct}
          onSelectTable={setSelectedTableId}
        />
      </div>
    </section>
  );
}

export default AdminDashboard;
