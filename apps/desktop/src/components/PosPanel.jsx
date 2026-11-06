const products = [
  { id: 'beer', name: 'Cerveza Paceña', detail: '620 ml', price: 20, color: 'text-amber-300', icon: '🍺', tile: 'border-amber-500/20 bg-amber-500/10' },
  { id: 'soda', name: 'Coca Cola', detail: '2 litros', price: 15, color: 'text-rose-300', icon: '🥤', tile: 'border-rose-500/20 bg-rose-500/10' },
  { id: 'snacks', name: 'Nachos supremos', detail: 'Queso y carne', price: 35, color: 'text-orange-300', icon: '🧀', tile: 'border-orange-500/20 bg-orange-500/10' },
  { id: 'chips', name: 'Pringles Original', detail: '124 g', price: 18, color: 'text-yellow-300', icon: '🥔', tile: 'border-yellow-500/20 bg-yellow-500/10' },
  { id: 'water', name: 'Agua mineral', detail: '500 ml', price: 8, color: 'text-teal-300', icon: '💧', tile: 'border-teal-500/20 bg-teal-500/10' },
];

const money = (amount) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount);

const statusLabels = { occupied: 'Ocupada', paused: 'Pausada' };

function PosPanel({ table, occupiedTables, onAddProduct, onSelectTable }) {
  const consumptionTotal =
    table?.consumption.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0;
  const timeTotal = table ? (table.seconds / 3600) * table.hourlyRate : 0;
  const itemsCount =
    table?.consumption.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <aside className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <span className="size-2 rounded-full bg-amber-400" />
          Bar &amp; venta rápida
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Asignar consumos directamente a mesas activas
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Mesa destino para consumo:
          </span>
          <select
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-500"
            onChange={(event) => onSelectTable(Number(event.target.value) || null)}
            value={table?.id ?? ''}
          >
            <option value="">Selecciona una mesa activa</option>
            {occupiedTables.map((occupiedTable) => (
              <option key={occupiedTable.id} value={occupiedTable.id}>
                {occupiedTable.name} ({statusLabels[occupiedTable.status]})
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">Productos disponibles:</p>
          <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
            {products.map((product) => (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-950 p-2.5 transition-colors hover:border-slate-700"
                key={product.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-lg border ${product.tile} text-base`}>
                    <span aria-hidden="true">{product.icon}</span>
                  </span>
                  <div className="min-w-0">
                    <p className={`truncate text-xs font-bold ${product.color}`}>{product.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {product.detail} · {money(product.price)}
                    </p>
                  </div>
                </div>
                <button
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-transparent disabled:text-slate-600"
                  disabled={!table}
                  onClick={() => table && onAddProduct(table.id, product)}
                  type="button"
                >
                  <span aria-hidden="true">+</span> Añadir
                </button>
              </div>
            ))}
          </div>
        </div>

        {!table ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-4 text-center">
            <p className="text-xs font-semibold text-slate-300">Selecciona una mesa activa</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Solo las mesas ocupadas o en pausa admiten consumos.
            </p>
          </div>
        ) : (
          <div className="space-y-2 border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400">Cuenta de {table.name}</p>
              <span className="text-xs text-slate-500">{itemsCount} artículo(s)</span>
            </div>
            {table.consumption.length ? (
              <ul className="max-h-32 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3">
                {table.consumption.map((item) => (
                  <li className="flex justify-between gap-3 text-xs" key={item.id}>
                    <span className="text-slate-300">
                      {item.name} <span className="text-slate-500">× {item.quantity}</span>
                    </span>
                    <span className="font-semibold text-white">
                      {money(item.price * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-700 p-3 text-xs text-slate-500">
                Aún no hay consumos asignados.
              </p>
            )}

            <div className="space-y-2 pt-2 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Tiempo de juego</span>
                <span>{money(timeTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Consumos</span>
                <span>{money(consumptionTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 font-bold text-white">
                <span>Total parcial</span>
                <span className="text-emerald-400">{money(timeTotal + consumptionTotal)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default PosPanel;
