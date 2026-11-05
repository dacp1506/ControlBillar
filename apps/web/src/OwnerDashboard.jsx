import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import './owner.css';

const money = (amount) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount ?? 0);

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':');
}

function OwnerDashboard({ user, onSignOut }) {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [rows, setRows] = useState([]);
  const [clock, setClock] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [message, setMessage] = useState('Cargando sucursales…');

  useEffect(() => {
    let mounted = true;
    async function loadBranches() {
      if (!supabase) return;
      const { data: memberships, error: membershipError } = await supabase
        .from('usuario_billar').select('tenant_id').eq('user_id', user.id).eq('activo', true);
      if (membershipError || !memberships?.length) {
        if (mounted) setMessage('Esta cuenta no tiene negocios activos asociados.');
        return;
      }
      const tenantIds = [...new Set(memberships.map((membership) => membership.tenant_id))];
      const { data, error } = await supabase.from('billar_sucursal')
        .select('id,nombre,tenant_id').in('tenant_id', tenantIds).eq('activa', true).order('nombre');
      if (!mounted) return;
      if (error || !data?.length) setMessage('No hay sucursales disponibles para esta cuenta.');
      else {
        setBranches(data);
        setBranchId(data[0].id);
        setMessage('');
      }
    }
    void loadBranches();
    return () => { mounted = false; };
  }, [user.id]);

  useEffect(() => {
    if (!supabase || !branchId) return undefined;
    let mounted = true;
    const refresh = async () => {
      const { data, error } = await supabase.rpc('get_branch_dashboard', { p_branch_id: branchId });
      if (!mounted) return;
      if (error) {
        setMessage('No se pudo actualizar el panel remoto.');
        return;
      }
      setRows(data ?? []);
      if (data?.[0]?.hora_servidor) {
        setServerOffset(new Date(data[0].hora_servidor).getTime() - Date.now());
      }
      setMessage('');
    };

    void refresh();
    const channel = supabase.channel(`owner-dashboard:${branchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesa', filter: `id_sucursal=eq.${branchId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesion_mesa', filter: `id_sucursal=eq.${branchId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venta', filter: `id_sucursal=eq.${branchId}` }, refresh)
      .subscribe((status) => { if (status === 'SUBSCRIBED') void refresh(); });
    const clockId = window.setInterval(() => setClock(Date.now()), 1000);
    return () => {
      mounted = false;
      window.clearInterval(clockId);
      void supabase.removeChannel(channel);
    };
  }, [branchId]);

  const salesToday = rows[0]?.ventas_hoy ?? 0;
  const occupied = rows.filter((row) => row.estado === 'ocupada').length;

  async function signOut() {
    await supabase?.auth.signOut();
    onSignOut();
  }

  return (
    <main className="owner-shell">
      <header className="owner-header">
        <div><p className="eyebrow">VISTA REMOTA</p><h1>Panel del negocio</h1><p>{user.email}</p></div>
        <button className="owner-signout" onClick={() => void signOut()}>Cerrar sesión</button>
      </header>
      <div className="owner-controls">
        <label>Sucursal<select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}
        </select></label>
        <span className="live-indicator"><i /> En vivo</span>
      </div>
      {message && <p className="section-note" role="status">{message}</p>}
      <section className="owner-metrics">
        <article><span>Mesas ocupadas</span><strong>{occupied} / {rows.length}</strong></article>
        <article><span>Ventas cobradas hoy</span><strong>{money(salesToday)}</strong></article>
      </section>
      <section className="owner-table-list">
        <div className="owner-table-head"><span>Mesa</span><span>Estado</span><span>Tiempo</span><span>Estimado</span></div>
        {rows.map((row) => {
          const elapsed = row.hora_inicio
            ? Math.max(0, Math.floor((clock + serverOffset - new Date(row.hora_inicio).getTime()) / 1000))
            : 0;
          const estimate = row.hora_inicio ? Math.ceil(elapsed / 60) * Number(row.precio_por_minuto) : 0;
          return <div className="owner-table-row" key={row.mesa_id}>
            <strong>{row.mesa_nombre}</strong>
            <span className={`owner-state state-${row.estado}`}>{row.estado}</span>
            <span className="owner-time">{row.hora_inicio ? formatDuration(elapsed) : '—'}</span>
            <span>{row.hora_inicio ? money(estimate) : '—'}</span>
          </div>;
        })}
        {!rows.length && !message && <p className="section-note">No hay mesas activas en esta sucursal.</p>}
      </section>
      <p className="owner-footnote">El tiempo se muestra con referencia a la hora del servidor. El cobro final se calcula en la base de datos.</p>
    </main>
  );
}

export default OwnerDashboard;
