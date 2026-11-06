import { supabase } from '../../lib/supabase.js';

function requireClient() {
  if (!supabase) throw new Error('Configura Supabase en el entorno de la aplicación.');
  return supabase;
}

export async function loadBranchSnapshot(branchId) {
  const client = requireClient();
  const { data, error } = await client.rpc('get_branch_dashboard', { p_branch_id: branchId });
  if (error) throw error;
  return {
    tables: (data ?? []).map((table) => ({
      ...table,
      id: table.mesa_id,
      nombre: table.mesa_nombre,
      session: table.hora_inicio ? { hora_inicio: table.hora_inicio } : null,
    })),
    serverTime: data?.[0]?.hora_servidor ?? null,
    salesToday: data?.[0]?.ventas_hoy ?? 0,
  };
}

export function subscribeBranch(branchId, onChange, onError = () => {}) {
  const client = requireClient();
  const channel = client.channel(`branch-operations:${branchId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'mesa', filter: `id_sucursal=eq.${branchId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'sesion_mesa', filter: `id_sucursal=eq.${branchId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'venta', filter: `id_sucursal=eq.${branchId}`,
    }, onChange)
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError(status);
    });

  return () => { void client.removeChannel(channel); };
}

export async function startTableSession(tableId) {
  const { data, error } = await requireClient().rpc('iniciar_sesion_mesa', { p_mesa: tableId });
  if (error) throw error;
  return data;
}

export async function closeTableSession(sessionId) {
  const { data, error } = await requireClient().rpc('cerrar_sesion_mesa', { p_sesion: sessionId });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function addSaleProduct(saleId, productId, quantity = 1) {
  const { data, error } = await requireClient().rpc('agregar_producto_venta', {
    p_venta: saleId,
    p_producto: productId,
    p_cantidad: quantity,
  });
  if (error) throw error;
  return data;
}

export async function paySale(saleId, method) {
  const { data, error } = await requireClient().rpc('pagar_venta', {
    p_venta: saleId,
    p_metodo: method,
  });
  if (error) throw error;
  return data;
}
