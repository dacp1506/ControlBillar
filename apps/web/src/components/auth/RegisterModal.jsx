import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

const initialForm = { fullName: '', email: '', phone: '', password: '' };

function RegisterModal({ isOpen, onClose, onRegistered }) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !loading) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback(null);
    if (!supabase) {
      setFeedback({ type: 'error', text: 'El servicio de registro no está configurado.' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            full_name: form.fullName.trim(),
            phone: form.phone.trim(),
          },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;

      const message = data.session
        ? 'Tu cuenta se creó correctamente. Ya puedes continuar.'
        : 'Te enviamos un correo para confirmar tu cuenta antes de iniciar sesión.';
      setFeedback({ type: 'success', text: message });
      setForm(initialForm);
      onRegistered?.(data);
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'No se pudo crear la cuenta. Inténtalo nuevamente.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-title"
        className="my-auto w-full max-w-lg border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl sm:p-8"
      >
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lime-300">Comunidad CuadroClub</p>
            <h2 id="register-title" className="mt-2 font-[Space_Grotesk] text-2xl font-bold">Crear cuenta</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Regístrate para continuar con tus reservas.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar registro"
            className="grid size-9 shrink-0 place-items-center border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-300">
            Nombre completo
            <input
              name="fullName"
              autoComplete="name"
              required
              maxLength={120}
              value={form.fullName}
              onChange={updateField}
              className="w-full border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-lime-300"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-300">
            Correo electrónico
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={updateField}
              className="w-full border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-lime-300"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-300">
            Teléfono
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              maxLength={30}
              value={form.phone}
              onChange={updateField}
              className="w-full border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-lime-300"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-300">
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={updateField}
              className="w-full border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-lime-300"
            />
            <span className="font-normal text-slate-500">Mínimo 8 caracteres.</span>
          </label>

          {feedback && (
            <p role={feedback.type === 'error' ? 'alert' : 'status'} className={`border px-3 py-2.5 text-sm ${feedback.type === 'error' ? 'border-rose-400/30 bg-rose-400/10 text-rose-200' : 'border-lime-300/30 bg-lime-300/10 text-lime-100'}`}>
              {feedback.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 bg-lime-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-lime-200 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? 'Creando cuenta…' : 'Registrarme'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default RegisterModal;
