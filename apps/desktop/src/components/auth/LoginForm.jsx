import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../lib/supabase.js';

const tenantId = import.meta.env.VITE_TENANT_ID;

function LoginForm() {
  const { signInWithPassword, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setLoading(true);
    try {
      const { user } = await signInWithPassword({ email: email.trim(), password });
      if (!tenantId || !supabase) throw new Error('Falta configurar el tenant.');

      const { data: membership, error: membershipError } = await supabase
        .from('usuario_billar')
        .select('role_id')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('activo', true)
        .maybeSingle();
      if (membershipError || !membership) throw new Error('Cuenta sin membresía activa.');

      const { data: role, error: roleError } = await supabase
        .from('roles')
        .select('codigo')
        .eq('id', membership.role_id)
        .single();
      if (roleError || !['dueno', 'cajero'].includes(role.codigo)) {
        throw new Error('Cuenta sin permisos operativos.');
      }
    } catch {
      await signOut();
      setErrorMessage('No se pudo iniciar sesión. Revisa el correo y la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
      <form onSubmit={handleSubmit} className="grid w-full max-w-sm gap-4 border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Billar Gestión</p>
          <h1 className="mt-2 text-2xl font-extrabold">Inicio de sesión</h1>
          <p className="mt-1 text-sm text-slate-400">Acceso para personal autorizado.</p>
        </div>
        <label className="grid gap-1 text-xs font-medium text-slate-300">
          Correo electrónico
          <input
            required
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-emerald-400"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-300">
          Contraseña
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-emerald-400"
          />
        </label>
        {errorMessage && <p role="alert" className="text-sm text-rose-300">{errorMessage}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-emerald-400 px-4 py-3 text-sm font-extrabold text-slate-950 hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>
    </main>
  );
}

export default LoginForm;
