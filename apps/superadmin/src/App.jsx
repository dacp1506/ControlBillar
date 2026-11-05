import { useEffect, useState } from 'react';
import { createSupabaseClient } from '@billar/database';

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = import.meta.env;
const supabase = VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY
  ? createSupabaseClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
  : null;

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenants, setTenants] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [releases, setReleases] = useState([]);
  const [message, setMessage] = useState('');
  const [release, setRelease] = useState({ version: '', plataforma: 'windows', download_url: '', sha256: '' });

  async function loadDashboard() {
    if (!supabase) return;
    const [tenantResult, subscriptionResult, planResult, releaseResult] = await Promise.all([
      supabase.from('billar_tenant').select('id,nombre,slug,estado,created_at').order('created_at', { ascending: false }),
      supabase.from('tenant_subscriptions').select('id,tenant_id,plan_id,estado,periodo_fin'),
      supabase.from('subscription_plans').select('id,nombre,precio_mensual,activo').order('precio_mensual'),
      supabase.from('desktop_releases').select('id,version,plataforma,download_url,publicada,created_at').order('created_at', { ascending: false }),
    ]);
    const failed = [tenantResult, subscriptionResult, planResult, releaseResult].find((result) => result.error);
    if (failed) {
      setMessage('No se pudieron cargar los datos. Verifica las migraciones y las políticas RLS.');
      return;
    }
    setTenants(tenantResult.data ?? []);
    setSubscriptions(subscriptionResult.data ?? []);
    setPlans(planResult.data ?? []);
    setReleases(releaseResult.data ?? []);
    setMessage('');
  }

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted || !data.user?.app_metadata?.platform_admin) return;
      setUser(data.user);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (user) void loadDashboard();
  }, [user]);

  async function signIn(event) {
    event.preventDefault();
    if (!supabase) {
      setMessage('Configura las variables públicas de Supabase.');
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage('No se pudo iniciar sesión.');
      return;
    }
    if (!data.user.app_metadata?.platform_admin) {
      await supabase.auth.signOut();
      setMessage('La cuenta no tiene acceso de Súper Administrador.');
      return;
    }
    setUser(data.user);
  }

  async function updateTenant(id, estado) {
    const { error } = await supabase.from('billar_tenant').update({ estado }).eq('id', id);
    setMessage(error ? 'No se pudo actualizar el negocio.' : 'Estado del negocio actualizado.');
    if (!error) await loadDashboard();
  }

  async function updateSubscription(id, changes) {
    const { error } = await supabase.from('tenant_subscriptions').update(changes).eq('id', id);
    setMessage(error ? 'No se pudo actualizar la licencia.' : 'Licencia actualizada.');
    if (!error) await loadDashboard();
  }

  async function publishRelease(event) {
    event.preventDefault();
    const { error } = await supabase.from('desktop_releases').insert({ ...release, publicada: false });
    setMessage(error ? 'No se pudo registrar la versión.' : 'Versión registrada como no publicada.');
    if (!error) {
      setRelease({ version: '', plataforma: 'windows', download_url: '', sha256: '' });
      await loadDashboard();
    }
  }

  async function setReleasePublished(id, publicada) {
    const { error } = await supabase.from('desktop_releases').update({ publicada }).eq('id', id);
    setMessage(error ? 'No se pudo cambiar la publicación.' : 'Estado de publicación actualizado.');
    if (!error) await loadDashboard();
  }

  const activeSubscriptions = subscriptions.filter((item) => item.estado === 'active').length;

  if (!user) {
    return (
      <main className="login-shell">
        <form className="login-panel" onSubmit={signIn}>
          <p className="eyebrow">CONTROL DE PLATAFORMA</p>
          <h1>Súper Administrador</h1>
          <label>Correo<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button>Ingresar</button>
          {message && <p role="status">{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="header"><div><p className="eyebrow">BILLAR SAAS / PLATAFORMA</p><h1>Consola global</h1></div><button className="secondary" onClick={() => supabase.auth.signOut().then(() => setUser(null))}>Cerrar sesión</button></header>
      {message && <p className="message" role="status">{message}</p>}
      <section className="metrics" aria-label="Métricas globales">
        <article><span>Negocios</span><strong>{tenants.length}</strong></article>
        <article><span>Licencias activas</span><strong>{activeSubscriptions}</strong></article>
        <article><span>Versiones registradas</span><strong>{releases.length}</strong></article>
      </section>

      <section className="section"><div className="section-title"><div><p className="eyebrow">CLIENTES</p><h2>Negocios y sucursales</h2></div></div>
        <div className="table-wrap"><table><thead><tr><th>Negocio</th><th>Slug</th><th>Estado</th><th>Alta</th></tr></thead><tbody>
          {tenants.map((tenant) => <tr key={tenant.id}><td>{tenant.nombre}</td><td>{tenant.slug}</td><td><select value={tenant.estado} onChange={(event) => updateTenant(tenant.id, event.target.value)}><option value="active">Activo</option><option value="suspended">Suspendido</option></select></td><td>{new Date(tenant.created_at).toLocaleDateString('es')}</td></tr>)}
          {!tenants.length && <tr><td colSpan="4">No hay negocios registrados.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="section"><div className="section-title"><div><p className="eyebrow">SUSCRIPCIONES</p><h2>Licencias</h2></div></div>
        <div className="table-wrap"><table><thead><tr><th>Tenant</th><th>Plan</th><th>Estado</th><th>Fin del período</th></tr></thead><tbody>
          {subscriptions.map((subscription) => {
            const tenant = tenants.find((item) => item.id === subscription.tenant_id);
            return <tr key={subscription.id}><td>{tenant?.nombre ?? subscription.tenant_id}</td><td><select value={subscription.plan_id} onChange={(event) => updateSubscription(subscription.id, { plan_id: event.target.value })}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.nombre}</option>)}</select></td><td><select value={subscription.estado} onChange={(event) => updateSubscription(subscription.id, { estado: event.target.value })}>{['trialing', 'active', 'past_due', 'cancelled', 'expired'].map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td>{subscription.periodo_fin ? new Date(subscription.periodo_fin).toLocaleDateString('es') : 'Sin fecha'}</td></tr>;
          })}
          {!subscriptions.length && <tr><td colSpan="4">No hay licencias registradas.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="section release-section"><div><p className="eyebrow">DISTRIBUCIÓN</p><h2>Versiones de escritorio</h2></div>
        <form className="release-form" onSubmit={publishRelease}>
          <label>Versión<input required value={release.version} placeholder="1.0.0" onChange={(event) => setRelease({ ...release, version: event.target.value })} /></label>
          <label>Plataforma<select value={release.plataforma} onChange={(event) => setRelease({ ...release, plataforma: event.target.value })}><option value="windows">Windows</option><option value="macos">macOS</option><option value="linux">Linux</option></select></label>
          <label className="wide">URL de descarga<input required type="url" value={release.download_url} onChange={(event) => setRelease({ ...release, download_url: event.target.value })} /></label>
          <label className="wide">SHA-256<input value={release.sha256} onChange={(event) => setRelease({ ...release, sha256: event.target.value })} /></label>
          <button>Registrar versión</button>
        </form>
        <div className="release-list">{releases.map((item) => <div key={item.id}><strong>{item.version}</strong><span>{item.plataforma} · {item.publicada ? 'Publicada' : 'Borrador'} <button className="release-toggle" onClick={() => setReleasePublished(item.id, !item.publicada)}>{item.publicada ? 'Retirar' : 'Publicar'}</button></span></div>)}</div>
      </section>
    </main>
  );
}

export default App;
