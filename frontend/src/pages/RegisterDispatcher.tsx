import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList, Eye, EyeOff, AlertCircle, CheckCircle2,
  ArrowLeft, User, Phone, Mail, Lock, MapPin, Briefcase,
  Plus, X, Globe, Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

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

const LANGUAGES = ['English', 'Spanish', 'Portuguese', 'French', 'Creole'];
const AVAILABILITY_OPTIONS = [
  { value: 'full-time',  label: 'Full-time' },
  { value: 'part-time',  label: 'Part-time' },
  { value: 'contract',   label: 'Contract'  },
  { value: 'on-call',    label: 'On-call'   },
];

export default function RegisterDispatcher() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', date_of_birth: '', phone: '', email: '',
    city: '', password: '', confirm: '',
    years_experience: '', availability: 'full-time',
  });
  const [companies, setCompanies] = useState<string[]>(['']);
  const [languages, setLanguages] = useState<string[]>(['English']);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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

  const addCompany = () => setCompanies(c => [...c, '']);
  const removeCompany = (i: number) => setCompanies(c => c.filter((_, idx) => idx !== i));
  const updateCompany = (i: number, val: string) =>
    setCompanies(c => c.map((v, idx) => (idx === i ? val : v)));

  const toggleLanguage = (lang: string) =>
    setLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const previous_companies = companies.filter(c => c.trim()).join(', ');
      await authApi.register({
        name:               form.name,
        email:              form.email,
        password:           form.password,
        role:               'dispatcher',
        phone:              form.phone,
        date_of_birth:      form.date_of_birth,
        city:               form.city,
        years_experience:   parseInt(form.years_experience) || 0,
        previous_companies,
        languages:          languages.join(', '),
        availability:       form.availability,
      });
      await login(form.email, form.password);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-start px-4 py-8">
      <div className="w-full max-w-lg">

        <Link to="/dispatcher" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dispatcher Login
        </Link>

        {/* Header */}
        <div className="text-center mb-7">
          <div className="w-16 h-16 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-orange-500/30">
            <ClipboardList className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Dispatcher Registration</h1>
          <p className="text-slate-400 text-sm mt-1">OSI Logistics · Create your operations account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {error && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-2xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {/* Personal Info */}
          <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Personal Info</h2>
            </div>

            <Field label="Full Name" required>
              <input className="input" type="text" placeholder="Jane Smith"
                value={form.name} onChange={set('name')} required autoFocus />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of Birth" required>
                <input className="input" type="date"
                  value={form.date_of_birth} onChange={set('date_of_birth')} required />
              </Field>
              <Field label="City / Location">
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-8" type="text" placeholder="Miami, FL"
                    value={form.city} onChange={set('city')} />
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" required>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-8" type="tel" placeholder="(305) 555-0000"
                    value={form.phone} onChange={set('phone')} required />
                </div>
              </Field>
              <Field label="Email" required>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-8" type="email" placeholder="dispatcher@company.com"
                    value={form.email} onChange={set('email')} required />
                </div>
              </Field>
            </div>
          </div>

          {/* Professional Background */}
          <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Professional Background</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Years of Experience" required>
                <input className="input" type="number" min="0" max="50" placeholder="e.g. 5"
                  value={form.years_experience} onChange={set('years_experience')} required />
              </Field>
              <Field label="Availability">
                <select className="input" value={form.availability} onChange={set('availability')}>
                  {AVAILABILITY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Previous Companies */}
            <Field label="Previous Companies">
              <div className="space-y-2">
                {companies.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="input flex-1"
                      type="text"
                      placeholder={`Company ${i + 1}`}
                      value={c}
                      onChange={e => updateCompany(i, e.target.value)}
                    />
                    {companies.length > 1 && (
                      <button type="button" onClick={() => removeCompany(i)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {companies.length < 5 && (
                  <button type="button" onClick={addCompany}
                    className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 font-semibold transition-colors mt-1">
                    <Plus className="w-3.5 h-3.5" /> Add company
                  </button>
                )}
              </div>
            </Field>

            {/* Languages */}
            <Field label="Languages">
              <div className="flex flex-wrap gap-2 mt-0.5">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      languages.includes(lang)
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-orange-300'
                    }`}
                  >
                    <Globe className="w-3 h-3" /> {lang}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* Account Security */}
          <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Account Security</h2>
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

            {/* Access preview */}
            <div className="bg-orange-50 rounded-xl p-3.5 border border-orange-100">
              <p className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> You will have access to:
              </p>
              <div className="grid grid-cols-2 gap-1">
                {['Dashboard & KPIs', 'Order Management', 'Live Fleet Tracking', 'Driver Assignments', 'Fleet Management', 'Analytics & Reports'].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-xs text-orange-700">
                    <CheckCircle2 className="w-3 h-3 text-orange-500 flex-shrink-0" /> {f}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base shadow-xl shadow-orange-500/20">
            {loading
              ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account...</>
              : <><ClipboardList className="w-4 h-4" /> Create Dispatcher Account</>
            }
          </button>

          <p className="text-xs text-center text-slate-500 pb-4">
            Already have an account?{' '}
            <Link to="/dispatcher" className="text-orange-400 hover:text-orange-300 font-medium">Sign in here</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
