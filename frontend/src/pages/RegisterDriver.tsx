import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Truck, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft, User, Phone, Mail, Lock, Building2, Calendar, Hash } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const EQUIPMENT_TYPES = ['Dry Van', 'Reefer', 'Flatbed', 'Box Truck', 'Power Only', 'Hotshot', 'Tanker'];

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function RegisterDriver() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', phone: '', email: '', password: '', confirm: '',
    license_number: '', license_expiry: '',
    equipment_type: 'Dry Van', mc_number: '', company_name: '', authority_since: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [declared, setDeclared] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const strength = (() => {
    const p = form.password;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register-driver', {
        name:           form.name,
        email:          form.email,
        password:       form.password,
        phone:          form.phone,
        license_number: form.license_number,
        license_expiry: form.license_expiry,
        equipment_type: form.equipment_type,
        mc_number:      form.mc_number,
        company_name:   form.company_name,
        authority_since: form.authority_since,
      });
      // Store session returned by register
      localStorage.setItem('osi_token', data.token);
      localStorage.setItem('osi_user', JSON.stringify(data.user));
      if (data.driverProfile) localStorage.setItem('osi_driver_profile', JSON.stringify(data.driverProfile));
      // Log in to sync auth context
      await login(form.email, form.password);
      navigate('/driver', { replace: true });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-start px-4 py-8">
      <div className="w-full max-w-lg">

        <Link to="/driver/login" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al inicio de sesión
        </Link>

        {/* Header */}
        <div className="text-center mb-7">
          <div className="w-16 h-16 bg-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-blue-500/30">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Driver Registration</h1>
          <p className="text-slate-400 text-sm mt-1">OSI Logistics · Crea tu cuenta de conductor</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {error && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-2xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {/* Personal info */}
          <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Personal Info</h2>
            </div>

            <Field label="Nombre Completo" required>
              <input className="input" type="text" placeholder="Diego Fuentes"
                value={form.name} onChange={set('name')} required autoFocus />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" required>
                <input className="input" type="tel" placeholder="(305) 555-0000"
                  value={form.phone} onChange={set('phone')} required />
              </Field>
              <Field label="Email" required>
                <input className="input" type="email" placeholder="driver@company.com"
                  value={form.email} onChange={set('email')} required />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Password" required>
                <div className="relative">
                  <input className="input pr-9" type={showPw ? 'text' : 'password'}
                    placeholder="Min. 8 characters" value={form.password}
                    onChange={set('password')} required />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password && (
                  <div className="flex gap-1 mt-1.5">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strength
                          ? strength >= 4 ? 'bg-green-500' : strength >= 3 ? 'bg-blue-400' : strength >= 2 ? 'bg-yellow-400' : 'bg-red-400'
                          : 'bg-gray-100'
                      }`} />
                    ))}
                  </div>
                )}
              </Field>
              <Field label="Confirm Password" required>
                <div className="relative">
                  <input className="input pr-9" type={showPw ? 'text' : 'password'}
                    placeholder="Repeat password" value={form.confirm}
                    onChange={set('confirm')} required />
                  {form.confirm && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {form.password === form.confirm
                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : <AlertCircle className="w-4 h-4 text-red-400" />}
                    </div>
                  )}
                </div>
              </Field>
            </div>
          </div>

          {/* CDL */}
          <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Hash className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">CDL / License</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="CDL License #" required>
                <input className="input" type="text" placeholder="FL-CDL-000000"
                  value={form.license_number} onChange={set('license_number')} required />
              </Field>
              <Field label="License Expiry" required>
                <input className="input" type="date"
                  value={form.license_expiry} onChange={set('license_expiry')} required />
              </Field>
            </div>

          </div>

          {/* Company / Equipment */}
          <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-green-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Company / Equipment</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de Equipo">
                <select className="input" value={form.equipment_type} onChange={set('equipment_type')}>
                  {EQUIPMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="MC# / Póliza Comercial">
                <input className="input" type="text" placeholder="MC-000000"
                  value={form.mc_number} onChange={set('mc_number')} />
              </Field>
            </div>

            <Field label="Company Name">
              <input className="input" type="text" placeholder="OSI Logistics LLC"
                value={form.company_name} onChange={set('company_name')} />
            </Field>

            <Field label="Autoridad MC desde">
              <input className="input" type="date"
                value={form.authority_since} onChange={set('authority_since')} />
            </Field>
          </div>

          {/* Declaration */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                className="sr-only"
                checked={declared}
                onChange={e => setDeclared(e.target.checked)}
              />
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                declared
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-slate-400 bg-transparent group-hover:border-blue-400'
              }`}>
                {declared && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Declaro que la información suministrada en este registro es <span className="text-slate-300 font-medium">veraz, completa y actualizada</span>. Autorizo la validación de los datos proporcionados con el fin de verificar su autenticidad y garantizar el correcto uso de los servicios ofrecidos por OSI Logistics.
            </p>
          </label>

          {/* Submit */}
          <button type="submit" disabled={loading || !declared}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base shadow-xl shadow-blue-500/20">
            {loading
              ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account...</>
              : <><Lock className="w-4 h-4" /> Create Driver Account</>
            }
          </button>

          <p className="text-xs text-center text-slate-500 pb-4">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/driver/login" className="text-blue-400 hover:text-blue-300 font-medium">Inicia sesión aquí</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
