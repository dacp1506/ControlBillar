import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

const money = (amount) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(amount) || 0);

function QrOrderingPortal({ token }) {
  const [menu, setMenu] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [customerName, setCustomerName] = useState('');
  const [status, setStatus] = useState('Cargando el menú de esta mesa…');
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState('');
  const table = menu[0];

  useEffect(() => {
    let active = true;
    async function loadMenu() {
      if (!supabase) {
        setStatus('El menú digital no está configurado.');
        return;
      }
      const { data, error } = await supabase.rpc('get_qr_menu', { p_token: token });
      if (!active) return;
      if (error) setStatus(error.message);
      else if (!data?.length) setStatus('Esta mesa no tiene una sesión activa o no hay productos publicados.');
      else {
        setMenu(data);
        setStatus('');
      }
    }
    void loadMenu();
    return () => { active = false; };
  }, [token]);

  const total = menu.reduce((sum, product) => sum + Number(product.precio) * (quantities[product.producto_id] ?? 0), 0);
  const count = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);

  async function submitOrder(event) {
    event.preventDefault();
    if (!supabase || count === 0) return;
    setBusy(true);
    setStatus('');
    const items = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([product_id, quantity]) => ({ product_id, quantity }));
    const { data, error } = await supabase.rpc('enviar_pedido_qr', {
      p_token: token,
      p_items: items,
      p_nombre: customerName.trim() || null,
    });
    setBusy(false);
    if (error) setStatus(error.message || 'No se pudo enviar el pedido.');
    else {
      setOrderId(data);
      setQuantities({});
      setStatus('Pedido enviado. El personal de la mesa lo recibirá para confirmarlo.');
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-5 px-4 py-8 text-slate-100">
      <header className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-300">PoolMaster · Menú digital</p>
        <h1 className="mt-2 text-2xl font-extrabold">{table ? `${table.sucursal} · ${table.mesa}` : 'Pedido desde tu mesa'}</h1>
        <p className="mt-2 text-sm text-slate-400">Agrega productos y envía la comanda al personal. Se asociará a la cuenta de esta mesa.</p>
      </header>
      {status && <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${orderId ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>{status}</p>}
      {orderId && <p className="text-xs text-slate-500">Referencia: {orderId.slice(0, 8).toUpperCase()}</p>}
      {!!menu.length && (
        <form className="space-y-4" onSubmit={submitOrder}>
          <div className="space-y-2">
            {menu.map((product) => {
              const outOfStock = !product.disponible;
              return <article key={product.producto_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div><h2 className="font-bold">{product.producto}</h2><p className="mt-1 text-sm text-slate-400">{money(product.precio)}{outOfStock ? ' · Agotado' : ''}</p></div>
                <div className="flex items-center gap-3">
                  <button type="button" disabled={outOfStock || !quantities[product.producto_id]} onClick={() => setQuantities((current) => ({ ...current, [product.producto_id]: Math.max(0, (current[product.producto_id] ?? 0) - 1) }))} aria-label={`Quitar ${product.producto}`} className="grid size-9 place-items-center rounded-lg border border-slate-700 disabled:opacity-40">−</button>
                  <span className="w-5 text-center">{quantities[product.producto_id] ?? 0}</span>
                  <button type="button" disabled={outOfStock || (quantities[product.producto_id] ?? 0) >= 50} onClick={() => setQuantities((current) => ({ ...current, [product.producto_id]: (current[product.producto_id] ?? 0) + 1 }))} aria-label={`Agregar ${product.producto}`} className="grid size-9 place-items-center rounded-lg bg-lime-300 font-bold text-slate-950 disabled:opacity-40">+</button>
                </div>
              </article>;
            })}
          </div>
          <label className="grid gap-1 text-xs text-slate-400">Nombre (opcional)<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength="120" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white" /></label>
          <div className="sticky bottom-2 flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/95 p-4 backdrop-blur"><div><p className="text-xs text-slate-400">{count} artículo(s)</p><strong>{money(total)}</strong></div><button type="submit" disabled={busy || count === 0} className="rounded-lg bg-lime-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">{busy ? 'Enviando…' : 'Enviar pedido'}</button></div>
        </form>
      )}
    </main>
  );
}

export default QrOrderingPortal;
