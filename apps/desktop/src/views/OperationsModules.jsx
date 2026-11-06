import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  adjustProductStock,
  closeCashShift,
  createProduct,
  createStaffTask,
  enrollStaff,
  loadBranchReport,
  loadCashMovements,
  recordCashMovement,
  resolveQrOrder,
  startCashShift,
  updateProduct,
  updateReservation,
  updateStaffTask,
} from '../modules/operations/management.js';

const money = (amount) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(amount) || 0);
const dateTime = (value) => new Date(value).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
const publicWebUrl = import.meta.env.VITE_PUBLIC_WEB_URL?.replace(/\/+$/, '') ?? '';

const tabs = [
  ['inventory', 'Inventario'],
  ['cash', 'Caja'],
  ['reservations', 'Reservas'],
  ['orders', 'Pedidos QR'],
  ['staff', 'Personal y tareas'],
  ['reports', 'Reportes'],
];

function OperationsModules({ branchId, data, canManage, canOperateCash, canManageReservations, canResolveOrders, busy, onRun, onRefresh }) {
  const [activeTab, setActiveTab] = useState('inventory');
  const [cashMovements, setCashMovements] = useState([]);
  const [report, setReport] = useState([]);
  const [reportDays, setReportDays] = useState(30);
  const [editingProduct, setEditingProduct] = useState(null);
  const openShift = data.cashShifts.find((shift) => shift.status === 'open');

  useEffect(() => {
    let active = true;
    if (!openShift) {
      setCashMovements([]);
      return undefined;
    }
    loadCashMovements(openShift.id).then((rows) => {
      if (active) setCashMovements(rows);
    }).catch((error) => {
      if (active) onRun(() => Promise.reject(error));
    });
    return () => { active = false; };
  }, [openShift?.id, data.cashShifts]);

  useEffect(() => {
    if (activeTab !== 'reports') return undefined;
    let active = true;
    const to = new Date();
    const from = new Date(to.getTime() - reportDays * 24 * 60 * 60 * 1000);
    loadBranchReport(branchId, from.toISOString(), to.toISOString()).then((rows) => {
      if (active) setReport(rows);
    }).catch((error) => {
      if (active) onRun(() => Promise.reject(error));
    });
    return () => { active = false; };
  }, [activeTab, branchId, reportDays, data]);

  const totals = useMemo(() => report.reduce((sum, day) => ({
    sales: sum.sales + Number(day.ventas),
    total: sum.total + Number(day.total),
    cash: sum.cash + Number(day.efectivo),
    card: sum.card + Number(day.tarjeta),
    transfer: sum.transfer + Number(day.transferencia),
  }), { sales: 0, total: 0, cash: 0, card: 0, transfer: 0 }), [report]);

  function run(action) {
    return onRun(action);
  }

  return (
    <section className="space-y-5">
      <nav aria-label="Módulos de operación" className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {tabs.filter(([id]) => canOperateCash || !['cash', 'reports'].includes(id)).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={activeTab === id} onClick={() => setActiveTab(id)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${activeTab === id ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-slate-800 text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'inventory' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Inventario y productos</h2>
            <p className="mt-1 text-sm text-slate-400">El stock se descuenta al vender y los ajustes quedan registrados.</p>
          </div>
          {canManage && <form className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-4" onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            run(async () => {
              await createProduct(branchId, {
                name: form.elements.name.value, price: form.elements.price.value, stock: form.elements.stock.value,
              });
              form.reset();
            });
          }}>
            <input name="name" required maxLength="120" placeholder="Nombre del producto" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input name="price" type="number" min="0" step="0.01" required placeholder="Precio" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input name="stock" type="number" min="0" step="0.001" placeholder="Stock (opcional)" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <button disabled={busy} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Crear producto</button>
          </form>}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-500"><tr><th className="p-3">Producto</th><th className="p-3">Precio</th><th className="p-3">Stock</th><th className="p-3">Estado</th><th className="p-3">Acción</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {data.products.map((product) => <tr key={product.id}>
                  <td className="p-3 font-semibold">{editingProduct?.id === product.id
                    ? <input aria-label="Nombre del producto" value={editingProduct.name} onChange={(event) => setEditingProduct((current) => ({ ...current, name: event.target.value }))} maxLength="120" className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
                    : product.nombre}</td>
                  <td className="p-3">{editingProduct?.id === product.id
                    ? <input aria-label="Precio del producto" type="number" min="0" step="0.01" value={editingProduct.price} onChange={(event) => setEditingProduct((current) => ({ ...current, price: event.target.value }))} className="w-28 rounded border border-slate-700 bg-slate-950 px-2 py-1" />
                    : money(product.precio)}</td>
                  <td className="p-3">{product.stock === null ? 'Sin control' : product.stock}</td>
                  <td className="p-3">{product.activo ? 'Activo' : 'Pausado'}</td>
                  <td className="p-3">
                    {canManage ? <div className="flex flex-wrap gap-2">
                      {editingProduct?.id === product.id
                        ? <>
                          <button type="button" disabled={busy || !editingProduct.name.trim() || editingProduct.price === '' || !Number.isFinite(Number(editingProduct.price)) || Number(editingProduct.price) < 0} onClick={() => run(async () => {
                            await updateProduct(product.id, { ...editingProduct, active: product.activo });
                            setEditingProduct(null);
                          })} className="rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">Guardar</button>
                          <button type="button" disabled={busy} onClick={() => setEditingProduct(null)} className="rounded border border-slate-700 px-2 py-1 text-xs">Cancelar</button>
                        </>
                        : <button type="button" disabled={busy} onClick={() => setEditingProduct({ id: product.id, name: product.nombre, price: String(product.precio) })} className="rounded border border-slate-700 px-2 py-1 text-xs">Editar</button>}
                      {product.stock !== null && <form className="flex gap-1" onSubmit={(event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        run(async () => {
                          await adjustProductStock(product.id, form.elements.change.value, form.elements.reason.value);
                          form.reset();
                        });
                      }}>
                        <input name="change" type="number" step="0.001" required aria-label="Cambio de stock" placeholder="+/- stock" className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs" />
                        <input name="reason" required minLength="2" maxLength="240" aria-label="Motivo del ajuste" placeholder="Motivo" className="w-28 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs" />
                        <button disabled={busy} className="rounded bg-slate-800 px-2 text-xs">Ajustar</button>
                      </form>}
                      <button disabled={busy} onClick={() => run(() => updateProduct(product.id, { name: product.nombre, price: product.precio, active: !product.activo }))}
                        className="rounded border border-slate-700 px-2 py-1 text-xs">{product.activo ? 'Pausar' : 'Activar'}</button>
                    </div> : '—'}
                  </td>
                </tr>)}
                {!data.products.length && <tr><td className="p-4 text-slate-500" colSpan="5">No hay productos registrados para esta sucursal.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-900 text-xs uppercase text-slate-500"><tr><th className="p-3">Fecha</th><th className="p-3">Producto</th><th className="p-3">Variación</th><th className="p-3">Motivo</th></tr></thead>
              <tbody className="divide-y divide-slate-800">{data.inventoryMovements.map((movement) => <tr key={movement.id}><td className="p-3">{dateTime(movement.created_at)}</td><td className="p-3">{movement.producto?.nombre ?? 'Producto'}</td><td className={`p-3 font-semibold ${Number(movement.quantity_change) > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{Number(movement.quantity_change) > 0 ? '+' : ''}{movement.quantity_change}</td><td className="p-3">{movement.reason}</td></tr>)}
                {!data.inventoryMovements.length && <tr><td className="p-4 text-slate-500" colSpan="4">Todavía no hay movimientos de inventario.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'cash' && (
        <section className="space-y-4">
          <div><h2 className="text-xl font-bold">Caja y turnos</h2><p className="mt-1 text-sm text-slate-400">Los cobros requieren un turno abierto. El arqueo compara efectivo contado con los movimientos registrados.</p></div>
          {!openShift ? (canOperateCash ? <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4" onSubmit={(event) => {
            event.preventDefault();
            const opening = event.currentTarget.elements.opening.value;
            run(() => startCashShift(branchId, opening));
          }}>
            <label className="grid gap-1 text-xs text-slate-400">Fondo inicial<input name="opening" type="number" min="0" step="0.01" required className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
            <button disabled={busy} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Abrir turno</button>
          </form> : <p className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">No hay turno abierto en esta sucursal.</p>) : <>
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-xl border border-emerald-500/30 bg-slate-900 p-4"><p className="text-xs text-slate-400">Turno abierto</p><strong className="mt-1 block">{dateTime(openShift.opened_at)}</strong></article>
              <article className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Fondo inicial</p><strong className="mt-1 block">{money(openShift.opening_amount)}</strong></article>
              <article className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Movimientos de caja</p><strong className="mt-1 block">{cashMovements.length}</strong></article>
              <article className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Efectivo esperado (parcial)</p><strong className="mt-1 block">{money(Number(openShift.opening_amount) + cashMovements.filter((item) => item.payment_method === 'efectivo').reduce((sum, item) => sum + (item.direction === 'income' ? 1 : -1) * Number(item.amount), 0))}</strong></article>
            </div>
            {canOperateCash && <form className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-4" onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              run(async () => {
                await recordCashMovement(branchId, form.elements.direction.value, form.elements.amount.value, form.elements.description.value, form.elements.method.value);
                form.reset();
              });
            }}>
              <select name="direction" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="expense">Registrar gasto</option><option value="income">Otro ingreso</option></select>
              <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Monto" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input name="description" required minLength="2" maxLength="240" placeholder="Concepto" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <div className="flex gap-2"><select name="method" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs"><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option></select><button disabled={busy} className="rounded-lg border border-slate-700 px-3 text-xs font-bold">Guardar</button></div>
            </form>}
            {canOperateCash && <form className="flex flex-wrap items-end gap-3 rounded-xl border border-amber-500/20 bg-slate-900 p-4" onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              run(() => closeCashShift(openShift.id, form.elements.counted.value, form.elements.notes.value));
            }}>
              <label className="grid gap-1 text-xs text-slate-400">Efectivo contado<input name="counted" type="number" min="0" step="0.01" required className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              <label className="grid min-w-48 flex-1 gap-1 text-xs text-slate-400">Notas del cierre<input name="notes" maxLength="500" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              <button disabled={busy} className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Arqueo y cierre</button>
            </form>}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[580px] text-left text-sm"><thead className="bg-slate-900 text-xs uppercase text-slate-500"><tr><th className="p-3">Hora</th><th className="p-3">Tipo</th><th className="p-3">Concepto</th><th className="p-3">Método</th><th className="p-3">Monto</th></tr></thead>
                <tbody className="divide-y divide-slate-800">{cashMovements.map((item) => <tr key={item.id}><td className="p-3">{dateTime(item.created_at)}</td><td className="p-3">{item.direction === 'income' ? 'Ingreso' : 'Gasto'}</td><td className="p-3">{item.description}</td><td className="p-3 capitalize">{item.payment_method}</td><td className="p-3">{money(item.amount)}</td></tr>)}</tbody>
              </table>
            </div>
          </>}
          {!!data.cashShifts.filter((shift) => shift.status === 'closed').length && <div className="grid gap-2 sm:grid-cols-2">
            {data.cashShifts.filter((shift) => shift.status === 'closed').slice(0, 4).map((shift) => <article key={shift.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs"><p className="text-slate-400">Cierre · {dateTime(shift.closed_at)}</p><p className="mt-1">Esperado {money(shift.expected_amount)} · Contado {money(shift.counted_amount)} · Diferencia {money(Number(shift.counted_amount) - Number(shift.expected_amount))}</p></article>)}
          </div>}
        </section>
      )}

      {activeTab === 'reservations' && (
        <section className="space-y-4">
          <div><h2 className="text-xl font-bold">Reservas</h2><p className="mt-1 text-sm text-slate-400">Solicitudes realizadas desde el portal público de clientes.</p></div>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-900 text-xs uppercase text-slate-500"><tr><th className="p-3">Mesa</th><th className="p-3">Cliente</th><th className="p-3">Horario</th><th className="p-3">Estado</th><th className="p-3">Acción</th></tr></thead>
              <tbody className="divide-y divide-slate-800">{data.reservations.map((item) => <tr key={item.id}>
                <td className="p-3 font-semibold">{item.mesa?.nombre ?? 'Mesa'}</td><td className="p-3">{item.guest_name}<span className="block text-xs text-slate-500">{item.guest_email}</span></td>
                <td className="p-3">{dateTime(item.starts_at)} – {dateTime(item.ends_at)}</td><td className="p-3 capitalize">{item.status}</td>
                <td className="p-3">{canManageReservations && ['pending', 'confirmed'].includes(item.status) ? <div className="flex gap-2">
                  {item.status === 'pending' && <button disabled={busy} onClick={() => run(() => updateReservation(item.id, 'confirmed'))} className="rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">Confirmar</button>}
                  <button disabled={busy} onClick={() => run(() => updateReservation(item.id, 'cancelled'))} className="rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-200">Cancelar</button>
                </div> : '—'}</td>
              </tr>)}
                {!data.reservations.length && <tr><td className="p-4 text-slate-500" colSpan="5">Todavía no hay reservas en esta sucursal.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'orders' && (
        <section className="space-y-4">
          <div><h2 className="text-xl font-bold">Pedidos por QR</h2><p className="mt-1 text-sm text-slate-400">Confirma cada pedido para reservar stock. Los pedidos aprobados se cargan a la cuenta al cerrar la mesa.</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="font-bold">Códigos QR de mesa</h3>
            <p className="mt-1 text-xs text-slate-400">Cada código abre el menú público de esa mesa. El QR solo acepta pedidos con una sesión activa.</p>
            {!publicWebUrl && <p className="mt-3 text-xs text-amber-200">Configura VITE_PUBLIC_WEB_URL con la URL desplegada del portal web para generar códigos que los clientes puedan abrir.</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.tables.map((table) => {
                const url = publicWebUrl ? `${publicWebUrl}/?mesa=${table.qr_token}` : '';
                return <article key={table.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
                  {url && <QRCodeSVG value={url} size={88} level="M" includeMargin aria-label={`Código QR ${table.nombre}`} />}
                  <div className="min-w-0"><p className="font-bold">{table.nombre}</p>{url ? <a href={url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs text-emerald-300 underline">Abrir menú de mesa</a> : <p className="mt-1 break-all text-[10px] text-slate-500">{table.qr_token}</p>}</div>
                </article>;
              })}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {data.orders.map((order) => <article key={order.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-start justify-between gap-2"><div><h3 className="font-bold">{order.mesa?.nombre ?? 'Mesa'}{order.customer_name ? ` · ${order.customer_name}` : ''}</h3><p className="mt-1 text-xs text-slate-500">{dateTime(order.created_at)} · {order.status}</p></div><strong>{money(order.qr_order_items.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0))}</strong></div>
              <ul className="my-3 space-y-1 text-sm text-slate-300">{order.qr_order_items.map((item) => <li key={`${order.id}-${item.description}`}>{item.description} × {item.quantity}</li>)}</ul>
              {canResolveOrders && order.status === 'pending' && <div className="flex gap-2"><button disabled={busy} onClick={() => run(() => resolveQrOrder(order.id, true))} className="rounded bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950">Aceptar pedido</button><button disabled={busy} onClick={() => run(() => resolveQrOrder(order.id, false))} className="rounded border border-rose-500/30 px-3 py-2 text-xs text-rose-200">Rechazar</button></div>}
            </article>)}
            {!data.orders.length && <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-500">Aún no se han recibido pedidos por QR.</p>}
          </div>
        </section>
      )}

      {activeTab === 'staff' && (
        <section className="space-y-4">
          <div><h2 className="text-xl font-bold">Personal y tareas</h2><p className="mt-1 text-sm text-slate-400">El empleado debe crear su cuenta previamente; el dueño puede vincular su correo a esta sucursal.</p></div>
          {canManage && <form className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-4" onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            run(async () => {
              await enrollStaff(branchId, form.elements.email.value, form.elements.name.value, form.elements.role.value);
              form.reset();
            });
          }}>
            <input name="name" required minLength="2" maxLength="120" placeholder="Nombre del empleado" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input name="email" type="email" required placeholder="Correo de su cuenta" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <select name="role" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="cajero">Cajero</option><option value="mesero">Mesero</option></select>
            <button disabled={busy} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950">Vincular empleado</button>
          </form>}
          {canManage && <form className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-4" onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            run(async () => {
              await createStaffTask(branchId, form.elements.title.value, form.elements.description.value, form.elements.assignee.value, form.elements.due.value ? new Date(form.elements.due.value).toISOString() : null);
              form.reset();
            });
          }}>
            <input name="title" required maxLength="160" placeholder="Tarea" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input name="description" maxLength="1000" placeholder="Detalle (opcional)" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <select name="assignee" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">Sin asignar</option>{data.memberships.map((member) => <option key={member.user_id} value={member.user_id}>{member.nombre || member.email} · {member.rol}</option>)}</select>
            <div className="flex gap-2"><input name="due" type="datetime-local" aria-label="Fecha límite" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs" /><button disabled={busy} className="rounded-lg border border-slate-700 px-3 text-xs font-bold">Crear tarea</button></div>
          </form>}
          <div className="grid gap-2">
            {data.tasks.map((task) => {
              const assignee = data.memberships.find((member) => member.user_id === task.assigned_to);
              return <article key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div><h3 className="font-bold">{task.title}</h3><p className="mt-1 text-xs text-slate-400">{task.description || 'Sin detalle'} · {assignee ? `Asignada a ${assignee.nombre || assignee.email}` : 'Sin asignar'}{task.due_at ? ` · Límite ${dateTime(task.due_at)}` : ''}</p></div>
                <select aria-label={`Estado de ${task.title}`} value={task.status} disabled={busy || (!canManage && task.assigned_to !== data.currentUserId)} onChange={(event) => run(() => updateStaffTask(task.id, event.target.value))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"><option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="done">Completada</option></select>
              </article>;
            })}
            {!data.tasks.length && <p className="text-sm text-slate-500">No hay tareas asignadas.</p>}
          </div>
        </section>
      )}

      {activeTab === 'reports' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Reportes de ventas</h2><p className="mt-1 text-sm text-slate-400">Ventas cobradas por día y medio de pago.</p></div>
            <label className="grid gap-1 text-xs text-slate-400">Período<select value={reportDays} onChange={(event) => setReportDays(Number(event.target.value))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option><option value="365">12 meses</option></select></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-xl border border-slate-800 bg-slate-900 p-4"><span className="text-xs text-slate-400">Ingresos cobrados</span><strong className="mt-2 block text-xl">{money(totals.total)}</strong></article>
            <article className="rounded-xl border border-slate-800 bg-slate-900 p-4"><span className="text-xs text-slate-400">Ventas</span><strong className="mt-2 block text-xl">{totals.sales}</strong></article>
            <article className="rounded-xl border border-slate-800 bg-slate-900 p-4"><span className="text-xs text-slate-400">Efectivo</span><strong className="mt-2 block text-xl">{money(totals.cash)}</strong></article>
            <article className="rounded-xl border border-slate-800 bg-slate-900 p-4"><span className="text-xs text-slate-400">Tarjeta y transferencia</span><strong className="mt-2 block text-xl">{money(totals.card + totals.transfer)}</strong></article>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-900 text-xs uppercase text-slate-500"><tr><th className="p-3">Día</th><th className="p-3">Ventas</th><th className="p-3">Total</th><th className="p-3">Efectivo</th><th className="p-3">Tarjeta</th><th className="p-3">Transferencia</th></tr></thead>
            <tbody className="divide-y divide-slate-800">{report.map((day) => <tr key={day.fecha}><td className="p-3">{new Date(`${day.fecha}T12:00:00`).toLocaleDateString('es-BO')}</td><td className="p-3">{day.ventas}</td><td className="p-3 font-semibold">{money(day.total)}</td><td className="p-3">{money(day.efectivo)}</td><td className="p-3">{money(day.tarjeta)}</td><td className="p-3">{money(day.transferencia)}</td></tr>)}
              {!report.length && <tr><td colSpan="6" className="p-4 text-slate-500">Sin ventas cobradas para este período.</td></tr>}
            </tbody>
          </table></div>
        </section>
      )}
      <div className="flex justify-end"><button type="button" disabled={busy} onClick={onRefresh} className="text-xs font-semibold text-slate-400 hover:text-white">Actualizar datos</button></div>
    </section>
  );
}

export default OperationsModules;
