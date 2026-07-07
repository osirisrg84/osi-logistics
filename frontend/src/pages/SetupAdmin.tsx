import { useState, FormEvent } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import api from '../services/api';

export default function SetupAdmin() {
  const [form, setForm] = useState({ secret: '', name: '', email: '', password: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await api.post('/auth/setup-admin', form);
      setMsg(res.data.created ? 'Admin creado ✓' : 'Admin actualizado ✓');
      setStatus('ok');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setMsg(e?.response?.data?.error || 'Error');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-3">
            <ShieldCheck className="w-7 h-7 text-purple-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Crear Admin</h1>
          <p className="text-xs text-gray-400 mt-1">OSI Logistics · Setup</p>
        </div>

        {status === 'ok' ? (
          <div className="text-center">
            <p className="text-green-600 font-bold text-lg mb-4">{msg}</p>
            <p className="text-sm text-gray-500 mb-6">Ya puedes iniciar sesión con tus credenciales en <span className="font-semibold">/admin</span></p>
            <a href="/admin" className="block w-full bg-purple-600 text-white font-bold py-3 rounded-2xl text-sm hover:bg-purple-700 transition-colors text-center">
              Ir a Admin Login →
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {[
              { label: 'Secret Key',       key: 'secret',   type: 'password', placeholder: 'Clave configurada en Render' },
              { label: 'Nombre completo',  key: 'name',     type: 'text',     placeholder: 'Osiris Reyes' },
              { label: 'Email',            key: 'email',    type: 'email',    placeholder: 'tu@email.com' },
              { label: 'Contraseña',       key: 'password', type: 'password', placeholder: 'Mínimo 8 caracteres' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                <input type={type} placeholder={placeholder} required
                  value={form[key as keyof typeof form]}
                  onChange={set(key as keyof typeof form)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border border-gray-200 outline-none focus:ring-2 focus:ring-purple-400/40 bg-gray-50" />
              </div>
            ))}

            {status === 'error' && (
              <p className="text-xs text-red-500 font-medium">{msg}</p>
            )}

            <button type="submit" disabled={status === 'loading'}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-sm transition-colors flex items-center justify-center gap-2 mt-2">
              {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Crear cuenta admin
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
