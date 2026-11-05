# Sistema SaaS de Gestión y Reservas para Billares

Monorepo con landing/portal de negocio, aplicación operativa Electron y consola de plataforma. Supabase es la fuente de verdad para Auth, PostgreSQL, RLS y Realtime.

## Estructura

- `apps/web`: landing pública, disponibilidad y panel remoto del dueño.
- `apps/desktop`: caja Electron + React, operación de mesas, POS y recibos PDF.
- `apps/superadmin`: gestión global de tenants, licencias y versiones.
- `packages/database`: cliente Supabase compartido y migraciones PostgreSQL.
- `backend`: API Express heredada; no es necesaria para el flujo principal Supabase.

## Desarrollo

Requisitos: Node.js 20+ y Corepack.

```powershell
corepack pnpm install
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/desktop/.env.example apps/desktop/.env.local
Copy-Item apps/superadmin/.env.example apps/superadmin/.env.local
```

Completa las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en cada `.env.local`. Nunca uses la clave `service_role` en una aplicación cliente.

```powershell
corepack pnpm dev:web
corepack pnpm dev:desktop
corepack pnpm dev:superadmin
```

El desktop opera con Supabase cuando se configura `VITE_BRANCH_ID`; sin esa variable mantiene el dashboard de demostración. La generación del instalador Windows es `corepack pnpm --filter @billar/desktop dist:win`.

## Supabase

Aplica `packages/database/migrations/0001_initial.sql` en un proyecto Supabase nuevo desde el SQL Editor. La migración incluye roles, RLS, reservas, operación de mesas, ventas, suscripciones, releases y funciones RPC. Para el primer tenant y el primer dueño se requiere un flujo de provisioning confiable; no se deben crear membresías de dueño desde un cliente público.

El Súper Administrador se identifica con `app_metadata.platform_admin = true`, atributo que solo debe establecerse desde un proceso de administración confiable. No se asigna mediante `user_metadata` ni desde la UI.

La disponibilidad pública se entrega mediante `get_public_availability`, que no expone datos personales. El panel del dueño consume `get_branch_dashboard`, y los clientes operativos escuchan cambios de mesas, sesiones y ventas por sucursal. Realtime requiere autenticación y las políticas RLS aplican también a las filas difundidas.

Las operaciones de inicio/cierre de sesión, adición de productos y cobro se realizan por RPC. La hora y el importe final se calculan en PostgreSQL; el reloj del cliente sirve únicamente para interpolar el cronómetro visual. La regla inicial cobra cada minuto iniciado.

## Recibos

El renderer envía datos estructurados al preload de Electron. El proceso principal escapa el contenido, genera el PDF y abre el diálogo de impresión local. No se habilita `nodeIntegration`.
