import { useEffect, useState } from 'react';
import OwnerDashboard from './OwnerDashboard.jsx';
import RegisterModal from './components/auth/RegisterModal.jsx';
import QrOrderingPortal from './QrOrderingPortal.jsx';
import { supabase } from './lib/supabase.js';

const { VITE_PUBLIC_BILLAR_SLUG } = import.meta.env;

function localDateTime(hoursFromNow) {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 30) * 30, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function App() {
  const [availability, setAvailability] = useState([]);
  const [availabilityMessage, setAvailabilityMessage] = useState('Configura Supabase y el slug del billar para consultar disponibilidad.');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ownerUser, setOwnerUser] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [reservationTable, setReservationTable] = useState(null);
  const [reservationMessage, setReservationMessage] = useState('');
  const [reservationBusy, setReservationBusy] = useState(false);
  const [reservationStart, setReservationStart] = useState(() => localDateTime(1));
  const [reservationEnd, setReservationEnd] = useState(() => localDateTime(2));
  const [reservationName, setReservationName] = useState('');
  const [reservationEmail, setReservationEmail] = useState('');
  const qrToken = new URLSearchParams(window.location.search).get('mesa');

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
    else if (data.session && data.user) setOwnerUser(data.user);
    else setLoginMessage('Revisa tu correo y confirma la cuenta antes de iniciar sesión.');
  }

  async function submitReservation(event) {
    event.preventDefault();
    if (!supabase || !reservationTable || !VITE_PUBLIC_BILLAR_SLUG) {
      setReservationMessage('No se pudo determinar el negocio o la mesa.');
      return;
    }
    setReservationBusy(true);
    setReservationMessage('');
    const { error } = await supabase.rpc('crear_reserva_publica', {
      p_slug: VITE_PUBLIC_BILLAR_SLUG,
      p_mesa: reservationTable.mesa_id,
      p_inicio: new Date(reservationStart).toISOString(),
      p_fin: new Date(reservationEnd).toISOString(),
      p_nombre: reservationName.trim(),
      p_email: reservationEmail.trim(),
    });
    setReservationBusy(false);
    if (error) setReservationMessage(error.message || 'No se pudo solicitar la reserva. Verifica el horario.');
    else {
      setReservationMessage('Reserva solicitada. El local la revisará y se pondrá en contacto contigo.');
      setReservationTable(null);
      setReservationName('');
      setReservationEmail('');
      setAvailability((current) => current.map((item) => item.mesa_id === reservationTable.mesa_id ? { ...item, disponible: false } : item));
    }
  }

  if (qrToken) return <QrOrderingPortal token={qrToken} />;
  if (ownerUser) {
    return <OwnerDashboard user={ownerUser} onSignOut={() => { setOwnerUser(null); setLoginMessage('Sesión cerrada.'); }} />;
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#inicio"><span className="brand-mark">8</span><span>CUADRO<span className="brand-light">CLUB</span></span></a>
        <nav><a href="#disponibilidad">Disponibilidad</a><a href="#negocios">Acceso negocios</a></nav>
        <button type="button" className="border border-[#637168] px-3 py-2 text-xs font-bold text-[#f0f3ef] transition hover:border-[#c0ed5d] hover:text-[#c0ed5d]" onClick={() => setRegisterOpen(true)}>Crear cuenta</button>
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
              {item.disponible && <button type="button" className="reservation-button" onClick={() => {
                setReservationTable(item);
                setReservationMessage('');
              }}>Solicitar reserva</button>}
            </article>
          ))}
          {availability.length === 0 && <div className="empty-state">La disponibilidad de los locales se mostrará aquí.</div>}
        </div>
        {reservationTable && <form className="reservation-form" onSubmit={submitReservation}>
          <div><p className="eyebrow">SOLICITUD DE RESERVA</p><h3>{reservationTable.mesa} · {reservationTable.sucursal}</h3></div>
          <label>Nombre<input required minLength="2" maxLength="120" value={reservationName} onChange={(event) => setReservationName(event.target.value)} /></label>
          <label>Correo electrónico<input type="email" required maxLength="254" value={reservationEmail} onChange={(event) => setReservationEmail(event.target.value)} /></label>
          <label>Desde<input type="datetime-local" required value={reservationStart} onChange={(event) => setReservationStart(event.target.value)} /></label>
          <label>Hasta<input type="datetime-local" required value={reservationEnd} onChange={(event) => setReservationEnd(event.target.value)} /></label>
          <div className="reservation-actions"><button type="button" className="cancel-reservation" onClick={() => setReservationTable(null)}>Cancelar</button><button type="submit" disabled={reservationBusy}>{reservationBusy ? 'Enviando…' : 'Enviar solicitud'}</button></div>
          {reservationMessage && <p role="status">{reservationMessage}</p>}
        </form>}
        {!reservationTable && reservationMessage && <p className="section-note" role="status">{reservationMessage}</p>}
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
      <RegisterModal isOpen={registerOpen} onClose={() => setRegisterOpen(false)} />
    </main>
  );
}

export default App;
