const products = [
  { id: 'beer', name: 'Cerveza Paceña', detail: '620 ml', price: 20, color: 'text-amber-300' },
  { id: 'soda', name: 'Gaseosa', detail: '500 ml', price: 12, color: 'text-sky-300' },
  { id: 'snacks', name: 'Nachos con queso', detail: 'Porción', price: 35, color: 'text-orange-300' },
  { id: 'water', name: 'Agua mineral', detail: '500 ml', price: 8, color: 'text-cyan-300' },
];

const money = (amount) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount);

function PosPanel({ table, occupiedTables, onAddProduct, onSelectTable }) {
  const consumptionTotal =
    table?.consumption.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0;
  const timeTotal = table ? (table.seconds / 3600) * table.hourlyRate : 0;

  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex items-start justify-between border-b border-slate-800 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Punto de venta</p>
          <h2 className="mt-1 text-lg font-bold">Bar &amp; consumos</h2>
        </div>
        <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300">
          POS
        </span>
      </div>

      <div className="space-y-5 p-5">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-400">Mesa activa</span>
          <select
            value={table?.id ?? ''}
            onChange={(event) => onSelectTable(Number(event.target.value) || null)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400"
          >
            <option value="">Selecciona una mesa ocupada</option>
            {occupiedTables.map((occupiedTable) => (
              <option key={occupiedTable.id} value={occupiedTable.id}>
                {occupiedTable.name}
              </option>
            ))}
          </select>
        </label>

        {!table ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-5 text-center">
            <p className="text-sm font-semibold text-slate-300">Selecciona una mesa ocupada</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Usa «Ver cuenta» en una mesa para cargar sus consumos.
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-400">Agregar producto</p>
              <div className="space-y-2">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3"
                  >
                    <div className="min-w-0">
                      <p className={`text-sm font-bold ${product.color}`}>{product.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {product.detail} · {money(product.price)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddProduct(table.id, product)}
                      className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-400 hover:text-slate-950"
                    >
                      + Añadir
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400">Cuenta de {table.name}</p>
                <span className="text-xs text-slate-500">
                  {table.consumption.reduce((sum, item) => sum + item.quantity, 0)} artículos
                </span>
              </div>
              {table.consumption.length ? (
                <ul className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
                  {table.consumption.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3 text-xs">
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
            </div>

            <div className="space-y-2 border-t border-slate-800 pt-4 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Tiempo de juego</span>
                <span>{money(timeTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Consumos</span>
                <span>{money(consumptionTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-3 font-bold text-white">
                <span>Total parcial</span>
                <span className="text-emerald-300">{money(timeTotal + consumptionTotal)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

export default PosPanel;
