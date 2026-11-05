create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.tenant_status as enum ('active', 'suspended');
create type public.mesa_estado as enum ('disponible', 'ocupada', 'reservada', 'mantenimiento');
create type public.reservation_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.session_status as enum ('active', 'closed', 'cancelled');
create type public.sale_status as enum ('open', 'paid', 'cancelled');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'expired');

create table public.roles (
  id smallint generated always as identity primary key,
  codigo text not null unique check (codigo in ('superadmin', 'dueno', 'cajero')),
  nombre text not null
);

insert into public.roles (codigo, nombre)
values ('superadmin', 'Súper Administrador'), ('dueno', 'Dueño'), ('cajero', 'Cajero')
on conflict (codigo) do nothing;

create table public.billar_tenant (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  estado public.tenant_status not null default 'active',
  zona_horaria text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billar_sucursal (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.billar_tenant(id),
  nombre text not null,
  direccion text,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, nombre)
);

create table public.usuario_billar (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.billar_tenant(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id smallint not null references public.roles(id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (tenant_id, id)
);

create table public.mesa (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.billar_tenant(id),
  id_sucursal uuid not null,
  nombre text not null,
  estado public.mesa_estado not null default 'disponible',
  precio_por_minuto numeric(10, 4) not null check (precio_por_minuto >= 0),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id_sucursal, nombre),
  unique (tenant_id, id),
  foreign key (tenant_id, id_sucursal)
    references public.billar_sucursal(tenant_id, id)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.billar_tenant(id),
  id_sucursal uuid not null,
  mesa_id uuid not null,
  customer_user_id uuid references auth.users(id) on delete set null,
  guest_name text,
  guest_email text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.reservation_status not null default 'pending',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (tenant_id, id_sucursal)
    references public.billar_sucursal(tenant_id, id),
  foreign key (tenant_id, mesa_id)
    references public.mesa(tenant_id, id),
  exclude using gist (
    mesa_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

create table public.sesion_mesa (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.billar_tenant(id),
  id_sucursal uuid not null,
  mesa_id uuid not null,
  usuario_inicio uuid not null references auth.users(id),
  hora_inicio timestamptz not null default clock_timestamp(),
  hora_fin timestamptz,
  precio_por_minuto numeric(10, 4) not null check (precio_por_minuto >= 0),
  costo_calculado numeric(12, 2),
  estado public.session_status not null default 'active',
  created_at timestamptz not null default now(),
  check ((estado = 'active' and hora_fin is null and costo_calculado is null)
    or (estado <> 'active' and hora_fin is not null)),
  foreign key (tenant_id, id_sucursal)
    references public.billar_sucursal(tenant_id, id),
  foreign key (tenant_id, mesa_id)
    references public.mesa(tenant_id, id),
  unique (tenant_id, id)
);

create unique index una_sesion_activa_por_mesa
  on public.sesion_mesa (mesa_id) where estado = 'active';

create table public.producto (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.billar_tenant(id),
  id_sucursal uuid not null,
  nombre text not null,
  precio numeric(12, 2) not null check (precio >= 0),
  stock numeric(12, 3) check (stock is null or stock >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, id_sucursal)
    references public.billar_sucursal(tenant_id, id)
);

create table public.venta (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.billar_tenant(id),
  id_sucursal uuid not null,
  sesion_id uuid,
  usuario_id uuid not null references auth.users(id),
  estado public.sale_status not null default 'open',
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  metodo_pago text check (metodo_pago is null or metodo_pago in ('efectivo', 'tarjeta', 'transferencia', 'otro')),
  created_at timestamptz not null default now(),
  pagada_at timestamptz,
  foreign key (tenant_id, id_sucursal)
    references public.billar_sucursal(tenant_id, id),
  foreign key (tenant_id, sesion_id)
    references public.sesion_mesa(tenant_id, id),
  unique (sesion_id),
  unique (tenant_id, id)
);

create table public.detalle_venta (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  venta_id uuid not null,
  producto_id uuid,
  descripcion text not null,
  cantidad numeric(12, 3) not null check (cantidad > 0),
  precio_unitario numeric(12, 2) not null check (precio_unitario >= 0),
  total numeric(12, 2) generated always as (round(cantidad * precio_unitario, 2)) stored,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, venta_id)
    references public.venta(tenant_id, id),
  foreign key (tenant_id, producto_id)
    references public.producto(tenant_id, id)
);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  precio_mensual numeric(12, 2) not null check (precio_mensual >= 0),
  max_sucursales integer not null check (max_sucursales > 0),
  activo boolean not null default true
);

create table public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.billar_tenant(id),
  plan_id uuid not null references public.subscription_plans(id),
  estado public.subscription_status not null default 'trialing',
  periodo_inicio timestamptz not null default now(),
  periodo_fin timestamptz,
  licencia_ref text unique,
  created_at timestamptz not null default now(),
  check (periodo_fin is null or periodo_fin > periodo_inicio),
  unique (tenant_id)
);

create table public.desktop_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  plataforma text not null check (plataforma in ('windows', 'macos', 'linux')),
  download_url text not null,
  sha256 text,
  publicada boolean not null default false,
  created_at timestamptz not null default now(),
  unique (version, plataforma)
);

create index mesa_sucursal_estado_idx on public.mesa (id_sucursal, estado);
create index reservation_tenant_time_idx on public.reservations (tenant_id, starts_at, ends_at);
create index sesion_tenant_inicio_idx on public.sesion_mesa (tenant_id, hora_inicio desc);
create index venta_tenant_fecha_idx on public.venta (tenant_id, created_at desc);
create index producto_sucursal_idx on public.producto (id_sucursal, activo);

create or replace function public.es_superadmin()
returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'platform_admin')::boolean, false);
$$;

create or replace function public.es_miembro(p_tenant uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuario_billar ub
    where ub.tenant_id = p_tenant and ub.user_id = auth.uid() and ub.activo
  );
$$;

create or replace function public.tiene_rol(p_tenant uuid, p_rol text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuario_billar ub
    join public.roles r on r.id = ub.role_id
    where ub.tenant_id = p_tenant and ub.user_id = auth.uid()
      and ub.activo and r.codigo = p_rol
  );
$$;

alter table public.billar_tenant enable row level security;
alter table public.billar_sucursal enable row level security;
alter table public.usuario_billar enable row level security;
alter table public.roles enable row level security;
alter table public.mesa enable row level security;
alter table public.reservations enable row level security;
alter table public.sesion_mesa enable row level security;
alter table public.producto enable row level security;
alter table public.venta enable row level security;
alter table public.detalle_venta enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.desktop_releases enable row level security;

grant select on public.roles, public.billar_tenant, public.billar_sucursal,
  public.usuario_billar, public.mesa, public.reservations, public.sesion_mesa,
  public.producto, public.venta, public.detalle_venta,
  public.subscription_plans, public.tenant_subscriptions, public.desktop_releases
  to authenticated;
grant select on public.subscription_plans, public.desktop_releases to anon;
grant insert, update on public.billar_tenant to authenticated;
grant insert, update on public.billar_sucursal, public.mesa, public.producto to authenticated;
grant insert, update on public.usuario_billar to authenticated;
grant insert, update, delete on public.subscription_plans,
  public.tenant_subscriptions, public.desktop_releases to authenticated;

create policy roles_read on public.roles for select to authenticated using (true);
create policy tenant_read on public.billar_tenant for select to authenticated
  using (public.es_superadmin() or public.es_miembro(id));
create policy tenant_platform_manage on public.billar_tenant for all to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());
create policy branch_read on public.billar_sucursal for select to authenticated
  using (public.es_superadmin() or public.es_miembro(tenant_id));
create policy branch_owner_insert on public.billar_sucursal for insert to authenticated
  with check (public.tiene_rol(tenant_id, 'dueno'));
create policy branch_owner_update on public.billar_sucursal for update to authenticated
  using (public.tiene_rol(tenant_id, 'dueno'))
  with check (public.tiene_rol(tenant_id, 'dueno'));

create policy membership_read on public.usuario_billar for select to authenticated
  using (user_id = auth.uid() or public.es_superadmin() or public.tiene_rol(tenant_id, 'dueno'));
create policy membership_owner_insert_cashier on public.usuario_billar for insert to authenticated
  with check (public.tiene_rol(tenant_id, 'dueno')
    and role_id = (select id from public.roles where codigo = 'cajero'));
create policy membership_owner_update_cashier on public.usuario_billar for update to authenticated
  using (public.tiene_rol(tenant_id, 'dueno'))
  with check (public.tiene_rol(tenant_id, 'dueno')
    and role_id = (select id from public.roles where codigo = 'cajero'));

create policy mesa_read on public.mesa for select to authenticated
  using (public.es_superadmin() or public.es_miembro(tenant_id));
create policy mesa_owner_insert on public.mesa for insert to authenticated
  with check (public.tiene_rol(tenant_id, 'dueno'));
create policy mesa_owner_update on public.mesa for update to authenticated
  using (public.tiene_rol(tenant_id, 'dueno'))
  with check (public.tiene_rol(tenant_id, 'dueno'));

create policy reservation_read on public.reservations for select to authenticated
  using (public.es_superadmin() or public.es_miembro(tenant_id));
create policy session_read on public.sesion_mesa for select to authenticated
  using (public.es_superadmin() or public.es_miembro(tenant_id));

create policy product_read on public.producto for select to authenticated
  using (public.es_superadmin() or public.es_miembro(tenant_id));
create policy product_owner_insert on public.producto for insert to authenticated
  with check (public.tiene_rol(tenant_id, 'dueno'));
create policy product_owner_update on public.producto for update to authenticated
  using (public.tiene_rol(tenant_id, 'dueno'))
  with check (public.tiene_rol(tenant_id, 'dueno'));

create policy sale_read on public.venta for select to authenticated
  using (public.es_superadmin() or public.es_miembro(tenant_id));
create policy sale_detail_read on public.detalle_venta for select to authenticated
  using (public.es_superadmin() or public.es_miembro(tenant_id));
create policy plan_read on public.subscription_plans for select to anon, authenticated
  using (activo or public.es_superadmin());
create policy plan_platform_manage on public.subscription_plans for all to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());
create policy subscription_read on public.tenant_subscriptions for select to authenticated
  using (public.es_superadmin() or public.es_miembro(tenant_id));
create policy subscription_platform_manage on public.tenant_subscriptions for all to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());
create policy release_read on public.desktop_releases for select to anon, authenticated
  using (publicada or public.es_superadmin());
create policy release_platform_manage on public.desktop_releases for all to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());

create or replace function public.get_public_availability(
  p_slug text, p_from timestamptz, p_to timestamptz
)
returns table (
  sucursal_id uuid, sucursal text, mesa_id uuid, mesa text, disponible boolean
)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  if p_from is null or p_to is null or p_to <= p_from
    or p_to > p_from + interval '31 days' then
    raise exception 'Intervalo de consulta inválido';
  end if;

  select t.id into v_tenant
  from public.billar_tenant t
  where t.slug = p_slug and t.estado = 'active';

  if v_tenant is null then return; end if;

  return query
  select b.id, b.nombre, m.id, m.nombre,
    (m.estado = 'disponible'
      and not exists (
        select 1 from public.reservations r
        where r.mesa_id = m.id
          and r.status in ('pending', 'confirmed')
          and tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(p_from, p_to, '[)')
      )
      and not exists (
        select 1 from public.sesion_mesa s
        where s.mesa_id = m.id and s.estado = 'active'
      ))
  from public.billar_sucursal b
  join public.mesa m on m.id_sucursal = b.id and m.tenant_id = b.tenant_id
  where b.tenant_id = v_tenant and b.activa and m.activa;
end;
$$;

grant execute on function public.get_public_availability(text, timestamptz, timestamptz) to anon, authenticated;

create or replace function public.get_branch_dashboard(p_branch_id uuid)
returns table (
  mesa_id uuid,
  mesa_nombre text,
  estado public.mesa_estado,
  precio_por_minuto numeric,
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
    s.hora_inicio,
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

revoke all on function public.get_branch_dashboard(uuid) from public;
grant execute on function public.get_branch_dashboard(uuid) to authenticated;

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
      or public.tiene_rol(v_mesa.tenant_id, 'cajero')) then
    raise exception 'Mesa no encontrada o acceso denegado';
  end if;
  if not exists (
    select 1 from public.billar_tenant t
    join public.tenant_subscriptions ts on ts.tenant_id = t.id
    where t.id = v_mesa.tenant_id and t.estado = 'active'
      and ts.estado in ('trialing', 'active')
      and (ts.periodo_fin is null or ts.periodo_fin > clock_timestamp())
  ) then
    raise exception 'El negocio no tiene una licencia activa';
  end if;
  if v_mesa.estado <> 'disponible' then raise exception 'La mesa no está disponible'; end if;

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

  return query select v_venta, v_costo;
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
  if p_cantidad <= 0 then raise exception 'Cantidad inválida'; end if;
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
  end if;

  select coalesce(sum(d.total), 0) into v_total
    from public.detalle_venta d where d.venta_id = v_venta.id;
  update public.venta set subtotal = v_total, total = v_total where id = v_venta.id;
  return v_total;
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
begin
  if p_metodo not in ('efectivo', 'tarjeta', 'transferencia', 'otro') then
    raise exception 'Método de pago inválido';
  end if;
  select * into v_venta from public.venta where id = p_venta for update;
  if not found or v_venta.estado <> 'open'
    or not (public.tiene_rol(v_venta.tenant_id, 'dueno')
      or public.tiene_rol(v_venta.tenant_id, 'cajero')) then
    raise exception 'Venta no disponible o acceso denegado';
  end if;
  update public.venta set estado = 'paid', metodo_pago = p_metodo,
    pagada_at = clock_timestamp() where id = p_venta returning pagada_at into v_pagada_at;
  return v_pagada_at;
end;
$$;

revoke all on function public.iniciar_sesion_mesa(uuid) from public;
revoke all on function public.cerrar_sesion_mesa(uuid) from public;
revoke all on function public.agregar_producto_venta(uuid, uuid, numeric) from public;
revoke all on function public.pagar_venta(uuid, text) from public;
grant execute on function public.iniciar_sesion_mesa(uuid) to authenticated;
grant execute on function public.cerrar_sesion_mesa(uuid) to authenticated;
grant execute on function public.agregar_producto_venta(uuid, uuid, numeric) to authenticated;
grant execute on function public.pagar_venta(uuid, text) to authenticated;

alter table public.mesa replica identity full;
alter table public.sesion_mesa replica identity full;
alter table public.venta replica identity full;
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['mesa', 'sesion_mesa', 'venta'] loop
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
