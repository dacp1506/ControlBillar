import { useEffect, useState } from 'react';
import OwnerDashboard from './OwnerDashboard.jsx';
import { supabase } from './lib/supabase.js';

const { VITE_PUBLIC_BILLAR_SLUG } = import.meta.env;

function App() {
  const [availability, setAvailability] = useState([]);
  const [availabilityMessage, setAvailabilityMessage] = useState('Configura Supabase y el slug del billar para consultar disponibilidad.');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ownerUser, setOwnerUser] = useState(null);

  useEffect(() => {
    if (!supabase || !VITE_PUBLIC_BILLAR_SLUG) return undefined;
    let mounted = true;

    async function loadAvailability() {
      const from = new Date();
      const to = new Date(from.getTime() + 3 * 60 * 60 * 1000);
      const { data, error } = await supabase.rpc('get_public_availability', {
        p_slug: VITE_PUBLIC_BILLAR_SLUG,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (!mounted) return;
      if (error) setAvailabilityMessage('No se pudo cargar la disponibilidad.');
      else {
        setAvailability(data ?? []);
        setAvailabilityMessage(data?.length ? 'Disponibilidad para las próximas tres horas.' : 'No hay mesas publicadas.');
      }
    }

    void loadAvailability();
    const intervalId = window.setInterval(loadAvailability, 30_000);
    return () => { mounted = false; window.clearInterval(intervalId); };
  }, []);

  async function signIn(event) {
    event.preventDefault();
    if (!supabase) {
      setLoginMessage('Configura las variables públicas de Supabase para habilitar el acceso.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setLoginMessage('No se pudo iniciar sesión. Revisa tus credenciales.');
    else setOwnerUser(data.user);
  }

  if (ownerUser) {
    return <OwnerDashboard user={ownerUser} onSignOut={() => { setOwnerUser(null); setLoginMessage('Sesión cerrada.'); }} />;
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#inicio"><span className="brand-mark">8</span><span>CUADRO<span className="brand-light">CLUB</span></span></a>
        <nav><a href="#disponibilidad">Disponibilidad</a><a href="#negocios">Acceso negocios</a></nav>
        <a className="download-link" href="#descarga">App para PC <span aria-hidden="true">↗</span></a>
      </header>

      <section className="intro" id="inicio">
        <div className="intro-copy">
          <p className="eyebrow">BILLAR · RESERVAS · OPERACIÓN</p>
          <h1>Tu próxima partida empieza aquí.</h1>
          <p>Consulta mesas disponibles y reserva tu tiempo de juego en tu billar favorito.</p>
          <a className="primary-link" href="#disponibilidad">Ver mesas disponibles <span aria-hidden="true">↓</span></a>
        </div>
        <div className="intro-board" aria-label="Ilustración de bolas de billar">
          <div className="cue-line" />
          <div className="ball ball-eight">8</div><div className="ball ball-one">1</div><div className="ball ball-three">3</div>
          <span className="board-caption">PARTIDAS EN JUEGO</span>
        </div>
      </section>

      <section className="availability section" id="disponibilidad">
        <div className="section-heading">
          <div><p className="eyebrow">RESERVAS</p><h2>Mesas en vivo</h2></div>
          <span className="live-indicator"><i /> Actualiza cada 30 segundos</span>
        </div>
        <p className="section-note">{availabilityMessage}</p>
        <div className="table-list">
          {availability.map((item) => (
            <article className="table-row" key={item.mesa_id}>
              <div><strong>{item.mesa}</strong><span>{item.sucursal}</span></div>
              <span className={item.disponible ? 'status available' : 'status busy'}>
                {item.disponible ? 'Disponible' : 'Ocupada o reservada'}
              </span>
            </article>
          ))}
          {availability.length === 0 && <div className="empty-state">La disponibilidad de los locales se mostrará aquí.</div>}
        </div>
      </section>

      <section className="business section" id="negocios">
        <div><p className="eyebrow">PORTAL DEL NEGOCIO</p><h2>Gestión del local</h2><p>Inicia sesión con la cuenta de tu negocio para acceder a las herramientas de gestión.</p></div>
        <form className="login-form" onSubmit={signIn}>
          <label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Iniciar sesión'}</button>
          {loginMessage && <p role="status">{loginMessage}</p>}
        </form>
      </section>

      <footer id="descarga"><span>CUADROCLUB</span><span>Aplicación de gestión para Windows próximamente</span></footer>
    </main>
  );
}

export default App;
