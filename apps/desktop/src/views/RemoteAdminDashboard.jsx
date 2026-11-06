import { useEffect, useState } from 'react';
import {
  addSaleProduct,
  closeTableSession,
  loadSaleLines,
  loadBranchSnapshot,
  paySale,
  startTableSession,
  subscribeBranch,
} from '../modules/operations/api.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import LoginForm from '../components/auth/LoginForm.jsx';
import OperationsModules from './OperationsModules.jsx';
import { loadManagementData } from '../modules/operations/management.js';

const branchId = import.meta.env.VITE_BRANCH_ID;
const money = (amount) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount ?? 0);

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':');
}

function RemoteAdminDashboard({ onOpenDemo }) {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [tables, setTables] = useState([]);
  const [managementData, setManagementData] = useState(null);
  const [activeView, setActiveView] = useState('tables');
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [pendingSale, setPendingSale] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [message, setMessage] = useState('Conectando con Supabase…');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [snapshot, management] = await Promise.all([
        loadBranchSnapshot(branchId),
        loadManagementData(branchId),
      ]);
      setTables(snapshot.tables);
      setManagementData(management);
      if (snapshot.serverTime) setServerOffset(new Date(snapshot.serverTime).getTime() - Date.now());
      setMessage('');
      return true;
    } catch (error) {
      setMessage(error?.message || 'No se pudo cargar la información de la sucursal.');
      return false;
    }
  }

  useEffect(() => {
    if (!branchId || !supabase) {
      setMessage('Configura VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y VITE_BRANCH_ID.');
      return undefined;
    }
    if (!session) return undefined;
    void refresh();
    const unsubscribe = subscribeBranch(branchId, () => { void refresh(); }, () => setMessage('Conexión Realtime interrumpida; reintentando…'));
    const clockId = window.setInterval(() => setNow(Date.now()), 1000);
    const refreshId = window.setInterval(() => { void refresh(); }, 60_000);
    return () => {
      unsubscribe();
      window.clearInterval(clockId);
      window.clearInterval(refreshId);
    };
  }, [session]);

  async function openTable(table) {
    setBusy(true);
    try {
      await startTableSession(table.id);
      await refresh();
    } catch (error) {
      setMessage(error.message || 'No se pudo iniciar la sesión.');
    } finally { setBusy(false); }
  }

  async function closeTable(table) {
    if (!table.session) return;
    setBusy(true);
    try {
      const sale = await closeTableSession(table.session.id);
      let lines = [{ description: `Tiempo y consumos · ${table.nombre}`, quantity: 1, total: Number(sale.costo) }];
      let lineLoadError = null;
      try {
        lines = await loadSaleLines(sale.venta_id);
      } catch (error) {
        lineLoadError = error;
      }
      setPendingSale({
        id: sale.venta_id,
        total: Number(sale.costo),
        lines,
      });
      await refresh();
      if (lineLoadError) setMessage(`La cuenta quedó abierta por ${money(sale.costo)}, pero no se pudo cargar el detalle: ${lineLoadError.message}`);
    } catch (error) {
      setMessage(error.message || 'No se pudo cerrar la sesión.');
    } finally { setBusy(false); }
  }

  async function addProduct(product) {
    if (!pendingSale) return;
    setBusy(true);
    try {
      const total = await addSaleProduct(pendingSale.id, product.id, 1);
      setPendingSale((current) => ({
        ...current,
        total: Number(total),
        lines: [...current.lines, { description: product.nombre, quantity: 1, total: Number(product.precio) }],
      }));
    } catch (error) {
      setMessage(error.message || 'No se pudo agregar el producto.');
    } finally { setBusy(false); }
  }

  async function settleSale() {
    if (!pendingSale) return;
    setBusy(true);
    try {
      const paidAt = await paySale(pendingSale.id, paymentMethod);
      setPendingSale(null);
      const receipt = {
        businessName: 'Billar',
        branchName: 'Sucursal',
        receiptNumber: pendingSale.id.slice(0, 8).toUpperCase(),
        issuedAt: new Date(paidAt).toLocaleString('es-BO'),
        currency: 'BOB',
        lines: pendingSale.lines,
        total: pendingSale.total,
      };
      if (!window.receiptApi) {
        setMessage('Cuenta cobrada. La impresión PDF solo está disponible en Electron.');
        return;
      }
      try {
        const result = await window.receiptApi.savePdf(receipt);
        setMessage(result.canceled ? 'Cuenta cobrada; no se guardó el PDF.' : 'Cuenta cobrada y recibo guardado.');
      } catch {
        setMessage('Cuenta cobrada, pero no se pudo guardar el recibo PDF.');
      }
    } catch (error) {
      setMessage(error.message || 'No se pudo completar el cobro o generar el recibo.');
    } finally { setBusy(false); }
  }

  async function runOperation(action) {
    setBusy(true);
    try {
      const result = await action();
      const refreshed = await refresh();
      if (!refreshed) return;
      if (result?.[0]?.expected !== undefined) {
        const close = result[0];
        setMessage(`Turno cerrado · Esperado ${money(close.expected)} · Contado ${money(close.counted)} · Diferencia ${money(close.difference)}.`);
      } else {
        setMessage('Cambios guardados.');
      }
    } catch (error) {
      setMessage(error?.message || 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  }

  const occupied = tables.filter((table) => table.estado === 'ocupada').length;
  const canManage = managementData?.role === 'dueno';
  const canOperateCash = ['dueno', 'cajero'].includes(managementData?.role);
  const canResolveOrders = ['dueno', 'cajero', 'mesero'].includes(managementData?.role);
  const hasOpenCashShift = managementData?.cashShifts.some((shift) => shift.status === 'open') ?? false;
  const menu = [
    ['tables', 'Mesas'],
    ['modules', 'Gestión del local'],
  ];

  if (authLoading) return <main className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-300">Cargando sesión…</main>;
  if (!supabase || !branchId) return <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-sm text-amber-200">Configura Supabase y VITE_BRANCH_ID.</main>;
  if (!session || !user) return <LoginForm onOpenDemo={onOpenDemo} />;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">PoolMaster · Operación</p><h1 className="mt-1 text-3xl font-extrabold">{managementData?.branch.nombre || 'Panel de gestión'}</h1><p className="mt-2 text-sm text-slate-400">Sucursal en tiempo real · El servidor calcula sesiones, stock y cobros.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => void refresh()} className="border border-slate-700 px-3 py-2 text-xs font-bold hover:bg-slate-800">Actualizar</button><button type="button" onClick={() => void signOut()} className="border border-slate-700 px-3 py-2 text-xs font-bold hover:bg-slate-800">Salir</button></div>
      </header>
      {message && <p className="border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-amber-200" role="status">{message}</p>}
      <nav aria-label="Secciones del negocio" className="flex gap-2 border-b border-slate-800 pb-3">
        {menu.map(([view, label]) => <button key={view} type="button" aria-pressed={activeView === view} onClick={() => setActiveView(view)}
          className={`border-b-2 px-3 py-2 text-sm font-bold ${activeView === view ? 'border-emerald-400 text-emerald-200' : 'border-transparent text-slate-400 hover:text-white'}`}>{label}</button>)}
      </nav>
      {activeView === 'tables' && <>
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Mesas ocupadas</p><strong className="mt-2 block text-2xl">{occupied} / {tables.length}</strong></div>
        <div className="border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Disponibles</p><strong className="mt-2 block text-2xl">{tables.filter((table) => table.estado === 'disponible').length}</strong></div>
        <div className="border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Ventas cobradas hoy</p><strong className="mt-2 block text-2xl">{money(tables[0]?.ventas_hoy ?? 0)}</strong></div>
      </section>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => {
          const elapsed = table.session?.hora_inicio
            ? Math.max(0, Math.floor((now + serverOffset - new Date(table.session.hora_inicio).getTime()) / 1000))
            : 0;
          const estimate = table.session ? Math.ceil(elapsed / 60) * Number(table.precio_por_minuto) : 0;
          return <article key={table.id} className="border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-start justify-between"><div><h2 className="font-bold">{table.nombre}</h2><p className="mt-1 text-xs capitalize text-slate-400">{table.estado}</p></div><span className="text-xs text-slate-400">{money(Number(table.precio_por_minuto) * 60)} / h</span></div>
            <div className="my-4 grid grid-cols-2 border border-slate-800 bg-slate-950 p-3 text-center"><div><p className="text-[10px] uppercase text-slate-500">Tiempo</p><strong className="font-mono">{table.session ? formatDuration(elapsed) : '00:00:00'}</strong></div><div><p className="text-[10px] uppercase text-slate-500">Estimado</p><strong>{table.session ? money(estimate) : '—'}</strong></div></div>
            {table.session
              ? canOperateCash
                ? <button disabled={busy} onClick={() => void closeTable(table)} className="w-full bg-rose-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">Cerrar cuenta</button>
                : <p className="w-full border border-slate-800 px-3 py-2 text-center text-xs text-slate-500">Sesión en curso</p>
              : ['dueno', 'cajero', 'mesero'].includes(managementData?.role)
                ? <button disabled={busy || table.estado !== 'disponible'} onClick={() => void openTable(table)} className="w-full bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">Abrir mesa</button>
                : <p className="w-full border border-slate-800 px-3 py-2 text-center text-xs text-slate-500">Solo lectura</p>}
          </article>;
        })}
      </section>
      {pendingSale && <section className="border border-amber-500/30 bg-slate-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-300">Cuenta pendiente</p><h2 className="mt-1 text-lg font-bold">POS · {money(pendingSale.total)}</h2></div><label className="text-xs text-slate-400">Pago<select className="ml-2 bg-slate-950 p-2 text-white" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option></select></label></div>
        <div className="mt-3 space-y-1 text-xs text-slate-300">{pendingSale.lines.map((line, index) => <p key={`${line.description}-${index}`}>{line.description} × {line.quantity} · {money(line.total)}</p>)}</div>
        <div className="mt-4 flex flex-wrap gap-2">{(managementData?.products ?? []).filter((product) => product.activo).map((product) => <button key={product.id} disabled={busy || (product.stock !== null && product.stock < 1)} onClick={() => void addProduct(product)} className="border border-slate-700 px-3 py-2 text-xs hover:border-emerald-400 disabled:opacity-40">+ {product.nombre} · {money(product.precio)}</button>)}</div>
        <button disabled={busy || !hasOpenCashShift} onClick={() => void settleSale()} className="mt-4 bg-emerald-400 px-4 py-2 text-xs font-extrabold text-slate-950 disabled:opacity-50">{hasOpenCashShift ? 'Cobrar y guardar recibo PDF' : 'Abre un turno de caja para cobrar'}</button>
      </section>}
      </>}
      {activeView === 'modules' && managementData && <OperationsModules
        branchId={branchId}
        data={managementData}
        canManage={canManage}
        canOperateCash={canOperateCash}
        canManageReservations={canOperateCash}
        canResolveOrders={canResolveOrders}
        busy={busy}
        onRun={runOperation}
        onRefresh={() => void refresh()}
      />}
    </main>
  );
}

export default RemoteAdminDashboard;
