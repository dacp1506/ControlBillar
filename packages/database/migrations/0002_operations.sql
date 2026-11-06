alter table public.mesa
  add column qr_token uuid not null default gen_random_uuid();

alter table public.roles drop constraint roles_codigo_check;
alter table public.roles
  add constraint roles_codigo_check
  check (codigo in ('superadmin', 'dueno', 'cajero', 'mesero'));
insert into public.roles (codigo, nombre)
values ('mesero', 'Mesero')
on conflict (codigo) do nothing;

drop policy if exists membership_owner_insert_cashier on public.usuario_billar;
drop policy if exists membership_owner_update_cashier on public.usuario_billar;
create policy membership_owner_insert_staff on public.usuario_billar for insert to authenticated
  with check (public.tiene_rol(tenant_id, 'dueno')
    and role_id in (
      select id from public.roles where codigo in ('cajero', 'mesero')
    ));
create policy membership_owner_update_staff on public.usuario_billar for update to authenticated
  using (public.tiene_rol(tenant_id, 'dueno'))
  with check (public.tiene_rol(tenant_id, 'dueno')
    and role_id in (
      select id from public.roles where codigo in ('cajero', 'mesero')
    ));

create or replace function public.iniciar_sesion_mesa(p_mesa uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_mesa public.mesa%rowtype;
  v_sesion uuid := gen_random_uuid();
begin
  select * into v_mesa from public.mesa where id = p_mesa and activa for update;
  if not found or not (public.tiene_rol(v_mesa.tenant_id, 'dueno')
      or public.tiene_rol(v_mesa.tenant_id, 'cajero')
      or public.tiene_rol(v_mesa.tenant_id, 'mesero')) then
    raise exception 'Mesa no encontrada o acceso denegado';
  end if;
  if not exists (
    select 1 from public.billar_tenant t
    join public.tenant_subscriptions ts on ts.tenant_id = t.id
    where t.id = v_mesa.tenant_id and t.estado = 'active'
      and ts.estado in ('trialing', 'active')
      and (ts.periodo_fin is null or ts.periodo_fin > clock_timestamp())
  ) then raise exception 'El negocio no tiene una licencia activa'; end if;
  if v_mesa.estado <> 'disponible' then raise exception 'La mesa no está disponible'; end if;
  if exists (
    select 1 from public.reservations r
    where r.mesa_id = v_mesa.id and r.status in ('pending', 'confirmed')
      and r.starts_at <= clock_timestamp() and r.ends_at > clock_timestamp()
  ) then raise exception 'La mesa está reservada en este horario'; end if;
  insert into public.sesion_mesa (
    id, tenant_id, id_sucursal, mesa_id, usuario_inicio, precio_por_minuto
  ) values (
    v_sesion, v_mesa.tenant_id, v_mesa.id_sucursal, v_mesa.id,
    auth.uid(), v_mesa.precio_por_minuto
  );
  update public.mesa set estado = 'ocupada' where id = v_mesa.id;
  return v_sesion;
end;
$$;

create table public.cash_shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.billar_tenant(id),
  branch_id uuid not null,
  opened_by uuid not null references auth.users(id),
  closed_by uuid references auth.users(id),
  opening_amount numeric(12, 2) not null check (opening_amount >= 0),
  counted_amount numeric(12, 2) check (counted_amount is null or counted_amount >= 0),
  expected_amount numeric(12, 2),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  notes text,
  foreign key (tenant_id, branch_id) references public.billar_sucursal(tenant_id, id),
  check ((status = 'open' and closed_at is null and counted_amount is null)
    or (status = 'closed' and closed_at is not null and counted_amount is not null))
);
create unique index one_open_cash_shift_per_branch
  on public.cash_shifts (branch_id) where status = 'open';

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  shift_id uuid not null references public.cash_shifts(id),
  created_by uuid not null references auth.users(id),
  sale_id uuid references public.venta(id) unique,
  direction text not null check (direction in ('income', 'expense')),
  payment_method text not null default 'efectivo'
    check (payment_method in ('efectivo', 'tarjeta', 'transferencia', 'otro')),
  amount numeric(12, 2) not null check (amount > 0),
  description text not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (tenant_id, branch_id) references public.billar_sucursal(tenant_id, id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  product_id uuid not null,
  created_by uuid not null references auth.users(id),
  quantity_change numeric(12, 3) not null check (quantity_change <> 0),
  reason text not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (tenant_id, branch_id) references public.billar_sucursal(tenant_id, id),
  foreign key (tenant_id, product_id) references public.producto(tenant_id, id)
);

create table public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  assigned_to uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  due_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  foreign key (tenant_id, branch_id) references public.billar_sucursal(tenant_id, id)
);

alter table public.usuario_billar
  add column nombre_visible text not null default '';

create table public.qr_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  table_id uuid not null,
  session_id uuid not null,
  customer_name text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'served')),
  created_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  foreign key (tenant_id, branch_id) references public.billar_sucursal(tenant_id, id),
  foreign key (tenant_id, table_id) references public.mesa(tenant_id, id),
  foreign key (tenant_id, session_id) references public.sesion_mesa(tenant_id, id)
);

create table public.qr_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  order_id uuid not null references public.qr_orders(id) on delete cascade,
  product_id uuid not null,
  description text not null,
  quantity numeric(12, 3) not null check (quantity > 0 and quantity <= 50),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  foreign key (tenant_id, product_id) references public.producto(tenant_id, id)
);

create index cash_shift_branch_status_idx on public.cash_shifts (branch_id, status);
create index cash_movement_shift_idx on public.cash_movements (shift_id, created_at);
create index inventory_movement_product_idx on public.inventory_movements (product_id, created_at desc);
create index staff_tasks_branch_status_idx on public.staff_tasks (branch_id, status, due_at);
create index qr_orders_branch_status_idx on public.qr_orders (branch_id, status, created_at);

drop function public.get_branch_dashboard(uuid);
create function public.get_branch_dashboard(p_branch_id uuid)
returns table (
  mesa_id uuid,
  mesa_nombre text,
  estado public.mesa_estado,
  precio_por_minuto numeric,
  sesion_id uuid,
  hora_inicio timestamptz,
  ventas_hoy numeric,
  hora_servidor timestamptz
)
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_timezone text;
  v_today_start timestamptz;
  v_today_end timestamptz;
begin
  select b.tenant_id, t.zona_horaria into v_tenant, v_timezone
  from public.billar_sucursal b
  join public.billar_tenant t on t.id = b.tenant_id
  where b.id = p_branch_id and b.activa;
  if v_tenant is null or not public.es_miembro(v_tenant) then
    raise exception 'Sucursal no encontrada o acceso denegado';
  end if;
  v_today_start := date_trunc('day', timezone(v_timezone, clock_timestamp())) at time zone v_timezone;
  v_today_end := v_today_start + interval '1 day';
  return query
  select m.id, m.nombre, m.estado, m.precio_por_minuto,
    s.id, s.hora_inicio,
    coalesce((
      select sum(v.total) from public.venta v
      where v.id_sucursal = p_branch_id and v.estado = 'paid'
        and v.pagada_at >= v_today_start and v.pagada_at < v_today_end
    ), 0),
    clock_timestamp()
  from public.mesa m
  left join public.sesion_mesa s on s.mesa_id = m.id and s.estado = 'active'
  where m.id_sucursal = p_branch_id and m.activa
  order by m.nombre;
end;
$$;
grant execute on function public.get_branch_dashboard(uuid) to authenticated;

alter table public.cash_shifts enable row level security;
alter table public.cash_movements enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.staff_tasks enable row level security;
alter table public.qr_orders enable row level security;
alter table public.qr_order_items enable row level security;

grant select on public.cash_shifts, public.cash_movements,
  public.inventory_movements, public.staff_tasks, public.qr_orders,
  public.qr_order_items to authenticated;

create policy cash_shift_read on public.cash_shifts for select to authenticated
  using (public.es_superadmin() or public.tiene_rol(tenant_id, 'dueno')
    or public.tiene_rol(tenant_id, 'cajero'));
create policy cash_movement_read on public.cash_movements for select to authenticated
  using (public.es_superadmin() or public.tiene_rol(tenant_id, 'dueno')
    or public.tiene_rol(tenant_id, 'cajero'));
create policy inventory_movement_read on public.inventory_movements for select to authenticated
  using (public.es_superadmin() or public.tiene_rol(tenant_id, 'dueno')
    or public.tiene_rol(tenant_id, 'cajero'));
create policy staff_task_read on public.staff_tasks for select to authenticated
  using (public.es_superadmin() or public.tiene_rol(tenant_id, 'dueno')
    or assigned_to = auth.uid());
create policy qr_order_read on public.qr_orders for select to authenticated
  using (public.es_superadmin() or public.es_miembro(tenant_id));
create policy qr_order_item_read on public.qr_order_items for select to authenticated
  using (public.es_superadmin() or public.es_miembro(tenant_id));

create or replace function public.crear_reserva_publica(
  p_slug text,
  p_mesa uuid,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_nombre text,
  p_email text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_reserva uuid := gen_random_uuid();
begin
  if p_inicio is null or p_fin is null
    or p_inicio < clock_timestamp() - interval '5 minutes'
    or p_inicio > clock_timestamp() + interval '60 days'
    or p_fin <= p_inicio
    or p_fin - p_inicio < interval '30 minutes'
    or p_fin - p_inicio > interval '4 hours'
    or length(trim(coalesce(p_nombre, ''))) not between 2 and 120
    or length(trim(coalesce(p_email, ''))) not between 5 and 254
    or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Datos de reserva inválidos';
  end if;

  select t.id into v_tenant
  from public.billar_tenant t
  join public.mesa m on m.tenant_id = t.id
  join public.billar_sucursal b on b.tenant_id = t.id and b.id = m.id_sucursal
  where t.slug = p_slug and t.estado = 'active'
    and b.activa and m.activa and m.id = p_mesa
  for update of m;
  if v_tenant is null then raise exception 'Mesa no disponible'; end if;
  if not exists (
    select 1 from public.tenant_subscriptions ts
    where ts.tenant_id = v_tenant and ts.estado in ('trialing', 'active')
      and (ts.periodo_fin is null or ts.periodo_fin > clock_timestamp())
  ) then raise exception 'El negocio no acepta reservas en este momento'; end if;
  if exists (
    select 1 from public.sesion_mesa s
    where s.mesa_id = p_mesa and s.estado = 'active'
  ) or exists (
    select 1 from public.reservations r
    where r.mesa_id = p_mesa and r.status in ('pending', 'confirmed')
      and tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(p_inicio, p_fin, '[)')
  ) then
    raise exception 'La mesa ya no está disponible en ese horario';
  end if;

  insert into public.reservations (
    id, tenant_id, id_sucursal, mesa_id, guest_name, guest_email, starts_at, ends_at
  )
  select v_reserva, v_tenant, m.id_sucursal, m.id,
    trim(p_nombre), lower(trim(p_email)), p_inicio, p_fin
  from public.mesa m where m.id = p_mesa;
  return v_reserva;
end;
$$;
revoke all on function public.get_branch_dashboard(uuid) from public;

create or replace function public.gestionar_reserva(p_reserva uuid, p_estado text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  if p_estado is null or p_estado not in ('confirmed', 'cancelled', 'completed', 'no_show') then
    raise exception 'Estado de reserva inválido';
  end if;
  select tenant_id into v_tenant from public.reservations where id = p_reserva for update;
  if v_tenant is null or not (
    public.tiene_rol(v_tenant, 'dueno')
    or public.tiene_rol(v_tenant, 'cajero')
  ) then
    raise exception 'Reserva no encontrada o acceso denegado';
  end if;
  update public.reservations set status = p_estado where id = p_reserva;
end;
$$;

create or replace function public.iniciar_turno_caja(p_sucursal uuid, p_apertura numeric)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_turno uuid := gen_random_uuid();
begin
  if p_apertura is null or p_apertura < 0 then raise exception 'Monto de apertura inválido'; end if;
  select tenant_id into v_tenant from public.billar_sucursal
    where id = p_sucursal and activa;
  if v_tenant is null or not (
    public.tiene_rol(v_tenant, 'dueno') or public.tiene_rol(v_tenant, 'cajero')
  ) then
    raise exception 'Sucursal no encontrada o acceso denegado';
  end if;
  if not exists (
    select 1 from public.tenant_subscriptions ts
    join public.billar_tenant t on t.id = ts.tenant_id
    where ts.tenant_id = v_tenant and t.estado = 'active'
      and ts.estado in ('trialing', 'active')
      and (ts.periodo_fin is null or ts.periodo_fin > clock_timestamp())
  ) then raise exception 'El negocio no tiene una licencia activa'; end if;

  insert into public.cash_shifts (id, tenant_id, branch_id, opened_by, opening_amount)
  values (v_turno, v_tenant, p_sucursal, auth.uid(), p_apertura);
  return v_turno;
end;
$$;

create or replace function public.registrar_movimiento_caja(
  p_sucursal uuid,
  p_direccion text,
  p_monto numeric,
  p_descripcion text,
  p_metodo text default 'efectivo'
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_turno uuid;
  v_movimiento uuid := gen_random_uuid();
begin
  if p_direccion is null or p_direccion not in ('income', 'expense')
    or p_metodo is null or p_metodo not in ('efectivo', 'tarjeta', 'transferencia', 'otro')
    or p_monto is null or p_monto <= 0
    or length(trim(coalesce(p_descripcion, ''))) not between 2 and 240 then
    raise exception 'Movimiento de caja inválido';
  end if;
  select b.tenant_id, cs.id into v_tenant, v_turno
  from public.billar_sucursal b
  join public.cash_shifts cs on cs.branch_id = b.id and cs.status = 'open'
  where b.id = p_sucursal
  for update of cs;
  if v_tenant is null or not (
    public.tiene_rol(v_tenant, 'dueno') or public.tiene_rol(v_tenant, 'cajero')
  ) then raise exception 'No hay un turno abierto o acceso denegado'; end if;
  insert into public.cash_movements (
    id, tenant_id, branch_id, shift_id, created_by, direction,
    payment_method, amount, description
  ) values (
    v_movimiento, v_tenant, p_sucursal, v_turno, auth.uid(), p_direccion,
    p_metodo, p_monto, trim(p_descripcion)
  );
  return v_movimiento;
end;
$$;

create or replace function public.cerrar_turno_caja(p_turno uuid, p_arqueo numeric, p_notas text default null)
returns table (expected numeric, counted numeric, difference numeric)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_turno public.cash_shifts%rowtype;
  v_esperado numeric(12, 2);
begin
  if p_arqueo is null or p_arqueo < 0 then raise exception 'Monto de arqueo inválido'; end if;
  select * into v_turno from public.cash_shifts where id = p_turno for update;
  if not found or v_turno.status <> 'open'
    or not (public.tiene_rol(v_turno.tenant_id, 'dueno')
      or public.tiene_rol(v_turno.tenant_id, 'cajero')) then
    raise exception 'Turno no disponible o acceso denegado';
  end if;
  select round(v_turno.opening_amount + coalesce(sum(
    case when cm.direction = 'income' then cm.amount else -cm.amount end
  ), 0), 2)
    into v_esperado
  from public.cash_movements cm
  where cm.shift_id = v_turno.id and cm.payment_method = 'efectivo';
  update public.cash_shifts
    set status = 'closed', closed_by = auth.uid(), closed_at = clock_timestamp(),
      counted_amount = p_arqueo, expected_amount = v_esperado,
      notes = nullif(trim(coalesce(p_notas, '')), '')
    where id = v_turno.id;
  return query select v_esperado, p_arqueo, round(p_arqueo - v_esperado, 2);
end;
$$;

create or replace function public.ajustar_stock_producto(
  p_producto uuid, p_cambio numeric, p_motivo text
)
returns numeric
language plpgsql security definer
set search_path = ''
as $$
declare
  v_producto public.producto%rowtype;
begin
  if p_cambio is null or p_cambio = 0
    or length(trim(coalesce(p_motivo, ''))) not between 2 and 240 then
    raise exception 'Ajuste de inventario inválido';
  end if;
  select * into v_producto from public.producto where id = p_producto for update;
  if not found or not public.tiene_rol(v_producto.tenant_id, 'dueno') then
    raise exception 'Producto no encontrado o acceso denegado';
  end if;
  if v_producto.stock is null or v_producto.stock + p_cambio < 0 then
    raise exception 'El producto no tiene stock controlado o el ajuste deja stock negativo';
  end if;
  update public.producto set stock = stock + p_cambio where id = p_producto;
  insert into public.inventory_movements (
    tenant_id, branch_id, product_id, created_by, quantity_change, reason
  ) values (
    v_producto.tenant_id, v_producto.id_sucursal, p_producto, auth.uid(),
    p_cambio, trim(p_motivo)
  );
  return v_producto.stock + p_cambio;
end;
$$;

create or replace function public.crear_producto_sucursal(
  p_sucursal uuid, p_nombre text, p_precio numeric, p_stock numeric default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_producto uuid := gen_random_uuid();
begin
  if length(trim(coalesce(p_nombre, ''))) not between 1 and 120
    or p_precio is null or p_precio < 0
    or p_stock < 0 then
    raise exception 'Datos de producto inválidos';
  end if;
  select tenant_id into v_tenant from public.billar_sucursal
    where id = p_sucursal and activa;
  if v_tenant is null or not public.tiene_rol(v_tenant, 'dueno') then
    raise exception 'Sucursal no encontrada o acceso denegado';
  end if;
  insert into public.producto (id, tenant_id, id_sucursal, nombre, precio, stock)
  values (v_producto, v_tenant, p_sucursal, trim(p_nombre), p_precio, p_stock);
  if p_stock > 0 then
    insert into public.inventory_movements (
      tenant_id, branch_id, product_id, created_by, quantity_change, reason
    ) values (
      v_tenant, p_sucursal, v_producto, auth.uid(), p_stock, 'Stock inicial'
    );
  end if;
  return v_producto;
end;
$$;

create or replace function public.crear_tarea_personal(
  p_sucursal uuid, p_titulo text, p_descripcion text default '',
  p_asignado uuid default null, p_vencimiento timestamptz default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_tarea uuid := gen_random_uuid();
begin
  select tenant_id into v_tenant from public.billar_sucursal
    where id = p_sucursal and activa;
  if v_tenant is null or not public.tiene_rol(v_tenant, 'dueno') then
    raise exception 'Sucursal no encontrada o acceso denegado';
  end if;
  if p_asignado is not null and not exists (
    select 1 from public.usuario_billar
    where tenant_id = v_tenant and user_id = p_asignado and activo
  ) then raise exception 'El responsable no pertenece a este negocio'; end if;
  insert into public.staff_tasks (
    id, tenant_id, branch_id, assigned_to, created_by, title, description, due_at
  ) values (
    v_tarea, v_tenant, p_sucursal, p_asignado, auth.uid(),
    trim(p_titulo), trim(coalesce(p_descripcion, '')), p_vencimiento
  );
  return v_tarea;
end;
$$;

create or replace function public.actualizar_estado_tarea(p_tarea uuid, p_estado text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tarea public.staff_tasks%rowtype;
begin
  if p_estado is null or p_estado not in ('pending', 'in_progress', 'done') then
    raise exception 'Estado de tarea inválido';
  end if;
  select * into v_tarea from public.staff_tasks where id = p_tarea for update;
  if not found or not (
    v_tarea.assigned_to = auth.uid()
    or public.tiene_rol(v_tarea.tenant_id, 'dueno')
  ) then raise exception 'Tarea no encontrada o acceso denegado'; end if;
  update public.staff_tasks
    set status = p_estado,
      completed_at = case when p_estado = 'done' then clock_timestamp() else null end
    where id = p_tarea;
end;
$$;

create or replace function public.listar_personal(p_sucursal uuid)
returns table (user_id uuid, email text, nombre text, rol text, activo boolean)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.billar_sucursal where id = p_sucursal;
  if v_tenant is null or not public.tiene_rol(v_tenant, 'dueno') then
    raise exception 'Sucursal no encontrada o acceso denegado';
  end if;
  return query
  select ub.user_id, u.email::text, ub.nombre_visible, r.codigo, ub.activo
  from public.usuario_billar ub
  join public.roles r on r.id = ub.role_id
  join auth.users u on u.id = ub.user_id
  where ub.tenant_id = v_tenant and r.codigo in ('cajero', 'mesero')
  order by ub.nombre_visible, u.email;
end;
$$;

create or replace function public.inscribir_personal(
  p_sucursal uuid, p_email text, p_nombre text, p_rol text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_user uuid;
  v_role smallint;
begin
  if p_rol is null or p_rol not in ('cajero', 'mesero')
    or length(trim(coalesce(p_email, ''))) not between 5 and 254
    or length(trim(coalesce(p_nombre, ''))) not between 2 and 120 then
    raise exception 'Datos de personal inválidos';
  end if;
  select tenant_id into v_tenant from public.billar_sucursal
    where id = p_sucursal and activa;
  if v_tenant is null or not public.tiene_rol(v_tenant, 'dueno') then
    raise exception 'Sucursal no encontrada o acceso denegado';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'El usuario debe crear su cuenta antes de inscribirlo'; end if;
  if exists (
    select 1 from public.usuario_billar ub
    join public.roles r on r.id = ub.role_id
    where ub.tenant_id = v_tenant and ub.user_id = v_user and r.codigo = 'dueno'
  ) then raise exception 'No se puede modificar el rol de dueño'; end if;
  select id into v_role from public.roles where codigo = p_rol;

  insert into public.usuario_billar (tenant_id, user_id, role_id, nombre_visible)
  values (v_tenant, v_user, v_role, trim(p_nombre))
  on conflict (tenant_id, user_id) do update
    set role_id = excluded.role_id, nombre_visible = excluded.nombre_visible, activo = true
    where public.usuario_billar.role_id in (
      select id from public.roles where codigo in ('cajero', 'mesero')
    );
  if not exists (
    select 1 from public.usuario_billar
    where tenant_id = v_tenant and user_id = v_user and activo
  ) then raise exception 'No se puede modificar el rol de dueño'; end if;
  return v_user;
end;
$$;

create or replace function public.get_branch_report(
  p_sucursal uuid, p_desde timestamptz, p_hasta timestamptz
)
returns table (
  fecha date,
  ventas bigint,
  total numeric,
  efectivo numeric,
  tarjeta numeric,
  transferencia numeric,
  otros numeric
)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  if p_desde is null or p_hasta is null or p_hasta <= p_desde
    or p_hasta > p_desde + interval '366 days' then
    raise exception 'Período de reporte inválido';
  end if;
  select tenant_id into v_tenant from public.billar_sucursal
    where id = p_sucursal and activa;
  if v_tenant is null or not (
    public.tiene_rol(v_tenant, 'dueno') or public.tiene_rol(v_tenant, 'cajero')
  ) then
    raise exception 'Sucursal no encontrada o acceso denegado';
  end if;
  return query
  select (v.pagada_at at time zone t.zona_horaria)::date,
    count(*)::bigint, coalesce(sum(v.total), 0),
    coalesce(sum(v.total) filter (where v.metodo_pago = 'efectivo'), 0),
    coalesce(sum(v.total) filter (where v.metodo_pago = 'tarjeta'), 0),
    coalesce(sum(v.total) filter (where v.metodo_pago = 'transferencia'), 0),
    coalesce(sum(v.total) filter (where v.metodo_pago = 'otro'), 0)
  from public.venta v
  join public.billar_tenant t on t.id = v.tenant_id
  where v.id_sucursal = p_sucursal and v.estado = 'paid'
    and v.pagada_at >= p_desde and v.pagada_at < p_hasta
  group by (v.pagada_at at time zone t.zona_horaria)::date
  order by 1 desc;
end;
$$;

create or replace function public.get_qr_menu(p_token uuid)
returns table (
  mesa text,
  sucursal text,
  producto_id uuid,
  producto text,
  precio numeric,
  disponible boolean
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return query
  select m.nombre, b.nombre, p.id, p.nombre, p.precio,
    (p.stock is null or p.stock > 0)
  from public.mesa m
  join public.billar_sucursal b on b.id = m.id_sucursal and b.activa
  join public.billar_tenant t on t.id = m.tenant_id and t.estado = 'active'
  join public.tenant_subscriptions ts on ts.tenant_id = t.id
    and ts.estado in ('trialing', 'active')
    and (ts.periodo_fin is null or ts.periodo_fin > clock_timestamp())
  join public.sesion_mesa s on s.mesa_id = m.id and s.estado = 'active'
  join public.producto p on p.id_sucursal = b.id and p.activo
  where m.qr_token = p_token and m.activa
  order by p.nombre;
end;
$$;

create or replace function public.enviar_pedido_qr(
  p_token uuid, p_items jsonb, p_nombre text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_mesa public.mesa%rowtype;
  v_sesion uuid;
  v_orden uuid := gen_random_uuid();
  v_item jsonb;
  v_producto public.producto%rowtype;
  v_cantidad numeric;
begin
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array'
    or length(trim(coalesce(p_nombre, ''))) > 120 then
    raise exception 'Pedido inválido';
  end if;
  if jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'Pedido inválido';
  end if;
  select * into v_mesa from public.mesa
    where qr_token = p_token and activa;
  if not found or not exists (
    select 1 from public.billar_sucursal b
    where b.id = v_mesa.id_sucursal and b.activa
  ) or not exists (
    select 1 from public.billar_tenant t
    join public.tenant_subscriptions ts on ts.tenant_id = t.id
    where t.id = v_mesa.tenant_id and t.estado = 'active'
      and ts.estado in ('trialing', 'active')
      and (ts.periodo_fin is null or ts.periodo_fin > clock_timestamp())
  ) then raise exception 'Mesa no disponible'; end if;
  select id into v_sesion from public.sesion_mesa
    where mesa_id = v_mesa.id and estado = 'active' for update;
  if v_sesion is null then raise exception 'La mesa no tiene una sesión activa'; end if;

  insert into public.qr_orders (
    id, tenant_id, branch_id, table_id, session_id, customer_name
  ) values (
    v_orden, v_mesa.tenant_id, v_mesa.id_sucursal, v_mesa.id, v_sesion,
    nullif(trim(coalesce(p_nombre, '')), '')
  );
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or coalesce(v_item ->> 'product_id', '') !~* '^[0-9a-f-]{36}$'
      or coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+(\.[0-9]{1,3})?$' then
      raise exception 'Producto o cantidad inválida';
    end if;
    v_cantidad := (v_item ->> 'quantity')::numeric;
    if v_cantidad <= 0 or v_cantidad > 50 then raise exception 'Cantidad inválida'; end if;
    select * into v_producto from public.producto p
      where p.id = (v_item ->> 'product_id')::uuid
        and p.tenant_id = v_mesa.tenant_id and p.id_sucursal = v_mesa.id_sucursal
        and p.activo;
    if not found then raise exception 'Producto no disponible'; end if;
    insert into public.qr_order_items (
      tenant_id, order_id, product_id, description, quantity, unit_price
    ) values (
      v_mesa.tenant_id, v_orden, v_producto.id, v_producto.nombre,
      v_cantidad, v_producto.precio
    );
  end loop;
  return v_orden;
end;
$$;

create or replace function public.resolver_pedido_qr(p_pedido uuid, p_aceptar boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_pedido public.qr_orders%rowtype;
  v_sesion_estado public.session_status;
  v_item record;
  v_producto public.producto%rowtype;
begin
  if p_aceptar is null then raise exception 'Decisión de pedido inválida'; end if;
  select * into v_pedido from public.qr_orders where id = p_pedido;
  if not found
    or not (public.tiene_rol(v_pedido.tenant_id, 'dueno')
      or public.tiene_rol(v_pedido.tenant_id, 'cajero')
      or public.tiene_rol(v_pedido.tenant_id, 'mesero')) then
    raise exception 'Pedido no disponible o acceso denegado';
  end if;
  select estado into v_sesion_estado from public.sesion_mesa
    where id = v_pedido.session_id for update;
  select * into v_pedido from public.qr_orders where id = p_pedido for update;
  if v_pedido.status <> 'pending' then raise exception 'El pedido ya fue atendido'; end if;
  if p_aceptar and v_sesion_estado <> 'active' then
    raise exception 'La sesión de la mesa ya terminó';
  end if;

  if p_aceptar then
    for v_item in
      select * from public.qr_order_items where order_id = p_pedido order by product_id
    loop
      select * into v_producto from public.producto
        where id = v_item.product_id and activo for update;
      if not found or v_producto.stock is not null and v_producto.stock < v_item.quantity then
        raise exception 'Stock insuficiente para %', v_item.description;
      end if;
      if v_producto.stock is not null then
        update public.producto set stock = stock - v_item.quantity where id = v_producto.id;
        insert into public.inventory_movements (
          tenant_id, branch_id, product_id, created_by, quantity_change, reason
        ) values (
          v_producto.tenant_id, v_producto.id_sucursal, v_producto.id, auth.uid(),
          -v_item.quantity, 'Pedido QR ' || left(v_pedido.id::text, 8)
        );
      end if;
    end loop;
  end if;
  update public.qr_orders set status = case when p_aceptar then 'approved' else 'rejected' end,
    resolved_at = clock_timestamp(), resolved_by = auth.uid()
    where id = p_pedido;
end;
$$;

create or replace function public.agregar_producto_venta(
  p_venta uuid, p_producto uuid, p_cantidad numeric
)
returns numeric
language plpgsql security definer
set search_path = ''
as $$
declare
  v_venta public.venta%rowtype;
  v_producto public.producto%rowtype;
  v_total numeric(12, 2);
begin
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'Cantidad inválida'; end if;
  select * into v_venta from public.venta where id = p_venta for update;
  if not found or v_venta.estado <> 'open'
    or not (public.tiene_rol(v_venta.tenant_id, 'dueno')
      or public.tiene_rol(v_venta.tenant_id, 'cajero')) then
    raise exception 'Venta no disponible o acceso denegado';
  end if;
  select * into v_producto from public.producto
    where id = p_producto and tenant_id = v_venta.tenant_id and activo for update;
  if not found or v_producto.id_sucursal <> v_venta.id_sucursal then
    raise exception 'Producto no disponible en esta sucursal';
  end if;
  if v_producto.stock is not null and v_producto.stock < p_cantidad then
    raise exception 'Stock insuficiente';
  end if;
  insert into public.detalle_venta (
    tenant_id, venta_id, producto_id, descripcion, cantidad, precio_unitario
  ) values (
    v_venta.tenant_id, v_venta.id, v_producto.id, v_producto.nombre,
    p_cantidad, v_producto.precio
  );
  if v_producto.stock is not null then
    update public.producto set stock = stock - p_cantidad where id = v_producto.id;
    insert into public.inventory_movements (
      tenant_id, branch_id, product_id, created_by, quantity_change, reason
    ) values (
      v_producto.tenant_id, v_producto.id_sucursal, v_producto.id, auth.uid(),
      -p_cantidad, 'Venta ' || left(v_venta.id::text, 8)
    );
  end if;
  select coalesce(sum(d.total), 0) into v_total
    from public.detalle_venta d where d.venta_id = v_venta.id;
  update public.venta set subtotal = v_total, total = v_total where id = v_venta.id;
  return v_total;
end;
$$;

create or replace function public.cerrar_sesion_mesa(p_sesion uuid)
returns table (venta_id uuid, costo numeric)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_sesion public.sesion_mesa%rowtype;
  v_fin timestamptz := clock_timestamp();
  v_minutos numeric;
  v_costo numeric(12, 2);
  v_venta uuid := gen_random_uuid();
  v_orden record;
  v_item record;
begin
  select * into v_sesion from public.sesion_mesa where id = p_sesion for update;
  if not found or not (public.tiene_rol(v_sesion.tenant_id, 'dueno')
      or public.tiene_rol(v_sesion.tenant_id, 'cajero')) then
    raise exception 'Sesión no encontrada o acceso denegado';
  end if;
  if v_sesion.estado <> 'active' then raise exception 'La sesión ya está cerrada'; end if;

  v_minutos := ceil(extract(epoch from (v_fin - v_sesion.hora_inicio)) / 60.0);
  v_costo := round(v_sesion.precio_por_minuto * v_minutos, 2);
  update public.sesion_mesa
    set estado = 'closed', hora_fin = v_fin, costo_calculado = v_costo
    where id = p_sesion;
  update public.mesa set estado = 'disponible' where id = v_sesion.mesa_id;

  insert into public.venta (id, tenant_id, id_sucursal, sesion_id, usuario_id, subtotal, total)
    values (v_venta, v_sesion.tenant_id, v_sesion.id_sucursal, v_sesion.id,
      auth.uid(), v_costo, v_costo);
  insert into public.detalle_venta (
    tenant_id, venta_id, descripcion, cantidad, precio_unitario
  ) values (
    v_sesion.tenant_id, v_venta,
    'Uso de mesa (' || v_minutos::text || ' min)', 1, v_costo
  );
  for v_orden in
    select id from public.qr_orders
    where session_id = v_sesion.id and status = 'approved'
    for update
  loop
    for v_item in
      select * from public.qr_order_items where order_id = v_orden.id
    loop
      insert into public.detalle_venta (
        tenant_id, venta_id, producto_id, descripcion, cantidad, precio_unitario
      ) values (
        v_sesion.tenant_id, v_venta, v_item.product_id, v_item.description,
        v_item.quantity, v_item.unit_price
      );
    end loop;
    update public.qr_orders set status = 'served' where id = v_orden.id;
  end loop;
  select coalesce(sum(d.total), 0) into v_costo
    from public.detalle_venta d where d.venta_id = v_venta;
  update public.venta set subtotal = v_costo, total = v_costo where id = v_venta;
  return query select v_venta, v_costo;
end;
$$;

create or replace function public.pagar_venta(p_venta uuid, p_metodo text)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_venta public.venta%rowtype;
  v_pagada_at timestamptz;
  v_turno uuid;
begin
  if p_metodo is null or p_metodo not in ('efectivo', 'tarjeta', 'transferencia', 'otro') then
    raise exception 'Método de pago inválido';
  end if;
  select * into v_venta from public.venta where id = p_venta for update;
  if not found or v_venta.estado <> 'open'
    or not (public.tiene_rol(v_venta.tenant_id, 'dueno')
      or public.tiene_rol(v_venta.tenant_id, 'cajero')) then
    raise exception 'Venta no disponible o acceso denegado';
  end if;
  select id into v_turno from public.cash_shifts
    where branch_id = v_venta.id_sucursal and status = 'open' for update;
  if v_turno is null then raise exception 'Abre un turno de caja antes de cobrar'; end if;

  update public.venta set estado = 'paid', metodo_pago = p_metodo,
    pagada_at = clock_timestamp() where id = p_venta returning pagada_at into v_pagada_at;
  insert into public.cash_movements (
    tenant_id, branch_id, shift_id, created_by, sale_id,
    direction, payment_method, amount, description
  ) values (
    v_venta.tenant_id, v_venta.id_sucursal, v_turno, auth.uid(), v_venta.id,
    'income', p_metodo, v_venta.total, 'Cobro de venta ' || left(v_venta.id::text, 8)
  );
  return v_pagada_at;
end;
$$;

revoke all on function public.crear_reserva_publica(text, uuid, timestamptz, timestamptz, text, text) from public;
revoke all on function public.gestionar_reserva(uuid, text) from public;
revoke all on function public.iniciar_turno_caja(uuid, numeric) from public;
revoke all on function public.registrar_movimiento_caja(uuid, text, numeric, text, text) from public;
revoke all on function public.cerrar_turno_caja(uuid, numeric, text) from public;
revoke all on function public.ajustar_stock_producto(uuid, numeric, text) from public;
revoke all on function public.crear_producto_sucursal(uuid, text, numeric, numeric) from public;
revoke all on function public.crear_tarea_personal(uuid, text, text, uuid, timestamptz) from public;
revoke all on function public.actualizar_estado_tarea(uuid, text) from public;
revoke all on function public.listar_personal(uuid) from public;
revoke all on function public.inscribir_personal(uuid, text, text, text) from public;
revoke all on function public.get_branch_report(uuid, timestamptz, timestamptz) from public;
revoke all on function public.get_qr_menu(uuid) from public;
revoke all on function public.enviar_pedido_qr(uuid, jsonb, text) from public;
revoke all on function public.resolver_pedido_qr(uuid, boolean) from public;
revoke all on function public.cerrar_sesion_mesa(uuid) from public;
revoke all on function public.pagar_venta(uuid, text) from public;

grant execute on function public.crear_reserva_publica(text, uuid, timestamptz, timestamptz, text, text) to anon, authenticated;
grant execute on function public.gestionar_reserva(uuid, text) to authenticated;
grant execute on function public.iniciar_turno_caja(uuid, numeric) to authenticated;
grant execute on function public.registrar_movimiento_caja(uuid, text, numeric, text, text) to authenticated;
grant execute on function public.cerrar_turno_caja(uuid, numeric, text) to authenticated;
grant execute on function public.ajustar_stock_producto(uuid, numeric, text) to authenticated;
grant execute on function public.crear_producto_sucursal(uuid, text, numeric, numeric) to authenticated;
grant execute on function public.crear_tarea_personal(uuid, text, text, uuid, timestamptz) to authenticated;
grant execute on function public.actualizar_estado_tarea(uuid, text) to authenticated;
grant execute on function public.listar_personal(uuid) to authenticated;
grant execute on function public.inscribir_personal(uuid, text, text, text) to authenticated;
grant execute on function public.get_branch_report(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_qr_menu(uuid) to anon, authenticated;
grant execute on function public.enviar_pedido_qr(uuid, jsonb, text) to anon, authenticated;
grant execute on function public.resolver_pedido_qr(uuid, boolean) to authenticated;
grant execute on function public.cerrar_sesion_mesa(uuid) to authenticated;
grant execute on function public.pagar_venta(uuid, text) to authenticated;

alter table public.cash_shifts replica identity full;
alter table public.cash_movements replica identity full;
alter table public.staff_tasks replica identity full;
alter table public.qr_orders replica identity full;
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'cash_shifts', 'cash_movements', 'staff_tasks', 'qr_orders',
      'reservations', 'producto', 'inventory_movements'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public' and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;
