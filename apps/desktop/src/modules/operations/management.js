import { supabase } from '../../lib/supabase.js';

function requireClient() {
  if (!supabase) throw new Error('Configura Supabase en el entorno de la aplicación.');
  return supabase;
}

async function unwrap(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function loadManagementData(branchId) {
  const client = requireClient();
  const branch = await unwrap(client.from('billar_sucursal').select('id,tenant_id,nombre').eq('id', branchId).single());
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('No hay una sesión autenticada.');
  const roleMembership = await unwrap(client.from('usuario_billar').select('roles(codigo)').eq('tenant_id', branch.tenant_id).eq('user_id', user.id).eq('activo', true).single());
  const role = roleMembership.roles.codigo;
  const [cashShifts, products, reservations, orders, tasks, memberships, tables, inventoryMovements] = await Promise.all([
    unwrap(client.from('cash_shifts').select('*').eq('branch_id', branchId).order('opened_at', { ascending: false }).limit(30)),
    unwrap(client.from('producto').select('id,nombre,precio,stock,activo').eq('id_sucursal', branchId).order('nombre')),
    unwrap(client.from('reservations').select('id,mesa_id,guest_name,guest_email,starts_at,ends_at,status,mesa(nombre)').eq('id_sucursal', branchId).order('starts_at', { ascending: false }).limit(100)),
    unwrap(client.from('qr_orders').select('id,table_id,session_id,customer_name,status,created_at,mesa(nombre),qr_order_items(description,quantity,unit_price)').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(50)),
    unwrap(client.from('staff_tasks').select('*').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(100)),
    role === 'dueno' ? unwrap(client.rpc('listar_personal', { p_sucursal: branchId })) : Promise.resolve([]),
    unwrap(client.from('mesa').select('id,nombre,qr_token').eq('id_sucursal', branchId).eq('activa', true).order('nombre')),
    unwrap(client.from('inventory_movements').select('id,quantity_change,reason,created_at,producto(nombre)').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(50)),
  ]);
  return { branch, cashShifts, products, reservations, orders, tasks, memberships, tables, inventoryMovements, role, currentUserId: user.id };
}

export async function createProduct(branchId, product) {
  return unwrap(requireClient().rpc('crear_producto_sucursal', {
    p_sucursal: branchId,
    p_nombre: product.name.trim(),
    p_precio: Number(product.price),
    p_stock: product.stock === '' ? null : Number(product.stock),
  }));
}

export async function updateProduct(productId, changes) {
  return unwrap(requireClient().from('producto').update({
    nombre: changes.name.trim(),
    precio: Number(changes.price),
    activo: changes.active,
  }).eq('id', productId));
}

export async function adjustProductStock(productId, quantityChange, reason) {
  return unwrap(requireClient().rpc('ajustar_stock_producto', {
    p_producto: productId,
    p_cambio: Number(quantityChange),
    p_motivo: reason.trim(),
  }));
}

export async function loadCashMovements(shiftId) {
  return unwrap(requireClient().from('cash_movements').select('*').eq('shift_id', shiftId).order('created_at', { ascending: false }));
}

export async function startCashShift(branchId, openingAmount) {
  return unwrap(requireClient().rpc('iniciar_turno_caja', {
    p_sucursal: branchId,
    p_apertura: Number(openingAmount),
  }));
}

export async function recordCashMovement(branchId, direction, amount, description, paymentMethod) {
  return unwrap(requireClient().rpc('registrar_movimiento_caja', {
    p_sucursal: branchId,
    p_direccion: direction,
    p_monto: Number(amount),
    p_descripcion: description.trim(),
    p_metodo: paymentMethod,
  }));
}

export async function closeCashShift(shiftId, countedAmount, notes) {
  return unwrap(requireClient().rpc('cerrar_turno_caja', {
    p_turno: shiftId,
    p_arqueo: Number(countedAmount),
    p_notas: notes.trim() || null,
  }));
}

export async function updateReservation(reservationId, status) {
  return unwrap(requireClient().rpc('gestionar_reserva', {
    p_reserva: reservationId,
    p_estado: status,
  }));
}

export async function resolveQrOrder(orderId, accept) {
  return unwrap(requireClient().rpc('resolver_pedido_qr', {
    p_pedido: orderId,
    p_aceptar: accept,
  }));
}

export async function createStaffTask(branchId, title, description, assignedTo, dueAt) {
  return unwrap(requireClient().rpc('crear_tarea_personal', {
    p_sucursal: branchId,
    p_titulo: title.trim(),
    p_descripcion: description.trim(),
    p_asignado: assignedTo || null,
    p_vencimiento: dueAt || null,
  }));
}

export async function updateStaffTask(taskId, status) {
  return unwrap(requireClient().rpc('actualizar_estado_tarea', {
    p_tarea: taskId,
    p_estado: status,
  }));
}

export async function enrollStaff(branchId, email, name, role) {
  return unwrap(requireClient().rpc('inscribir_personal', {
    p_sucursal: branchId,
    p_email: email.trim(),
    p_nombre: name.trim(),
    p_rol: role,
  }));
}

export async function loadBranchReport(branchId, from, to) {
  return unwrap(requireClient().rpc('get_branch_report', {
    p_sucursal: branchId,
    p_desde: from,
    p_hasta: to,
  }));
}
