import { useState, useEffect } from 'react';
import {
  Star, Award, Package, TrendingUp, Clock, CheckCircle,
  Phone, Mail, Lock, Edit3, User, Calendar,
  DollarSign, BarChart3, MapPin, Briefcase, Globe, Save, X,
} from 'lucide-react';
import { billingApi, userApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface ProfileData {
  phone?: string;
  email?: string;
  dispatcher_code?: string;
  shift_active?: number;
  years_experience?: number;
  payout_method?: string;
  languages?: string;
  availability?: string;
  city?: string;
  date_of_birth?: string;
  previous_companies?: string;
  equipment_experience?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
}

interface CommissionRow {
  id: string;
  order_number: string;
  dispatcher_pay: number;
  order_price: number;
  status: 'pending' | 'settled';
  delivery_date: string | null;
}

export default function DispatcherProfilePage() {
  const { user } = useAuth();
  const { dark } = useTheme();
  const isAdmin = user?.role === 'admin';
  const accent = isAdmin ? '#a855f7' : '#f97316';
  const accentGrad = isAdmin
    ? 'linear-gradient(135deg,#a855f7,#7c3aed)'
    : 'linear-gradient(135deg,#f97316,#ea580c)';

  const [profile, setProfile]   = useState<ProfileData>({});
  const [commRows, setCommRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const EQUIP_TYPES = ['Dry Van', 'Reefer', 'Power Only', 'Flatbed', 'Tanker', 'Van', 'Box Truck', 'Hotshot'];
  const [editingContact, setEditingContact] = useState(false);
  const [savingContact,  setSavingContact]  = useState(false);
  const [contactForm, setContactForm] = useState({ phone: '' });

  const [editingPersonal, setEditingPersonal] = useState(false);
  const [savingPersonal,  setSavingPersonal]  = useState(false);
  const [personalForm, setPersonalForm] = useState({ city: '', date_of_birth: '' });

  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [profileForm, setProfileForm] = useState({
    availability: 'full-time', languages: '', years_experience: '', equipment_experience: '',
  });

  // Verification
  const [verifying, setVerifying]   = useState<'email' | 'phone' | null>(null);
  const [codeInput, setCodeInput]   = useState('');
  const [codeSent,  setCodeSent]    = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifyMsg, setVerifyMsg]   = useState('');

  const handleSendCode = async (type: 'email' | 'phone') => {
    setSendingCode(true); setVerifyMsg('');
    try {
      await userApi.sendVerification(type);
      setCodeSent(true);
      setVerifyMsg('Código enviado — revisa tu correo');
    } catch { setVerifyMsg('Error al enviar el código'); }
    finally { setSendingCode(false); }
  };

  const handleVerifyCode = async () => {
    if (!verifying) return;
    setVerifyingCode(true); setVerifyMsg('');
    try {
      await userApi.verifyCode(verifying, codeInput);
      setProfile(prev => ({ ...prev, [`${verifying}_verified`]: true }));
      setVerifying(null); setCodeInput(''); setCodeSent(false);
      setVerifyMsg('');
    } catch { setVerifyMsg('Código incorrecto o expirado'); }
    finally { setVerifyingCode(false); }
  };

  const cancelVerify = () => { setVerifying(null); setCodeInput(''); setCodeSent(false); setVerifyMsg(''); };

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      userApi.getProfile().catch(() => ({ data: {} })),
      billingApi.getRecords({ dispatcher_user_id: user.id }).catch(() => ({ data: [] })),
    ]).then(([profileRes, commRes]) => {
      const p = profileRes.data || {};
      setProfile(p);
      setContactForm({ phone: p.phone || '' });
      setPersonalForm({
        city:          p.city          || '',
        date_of_birth: p.date_of_birth || '',
      });
      setProfileForm({
        availability:         p.availability         || 'full-time',
        languages:            p.languages            || '',
        years_experience:     p.years_experience != null ? String(p.years_experience) : '',
        equipment_experience: p.equipment_experience || '',
      });
      setCommRows(Array.isArray(commRes.data) ? commRes.data : []);
    }).finally(() => setLoading(false));
  }, [user?.id]);

  const saveContact = async () => {
    setSavingContact(true);
    try {
      await userApi.updateProfile({ phone: contactForm.phone });
      setProfile(prev => ({ ...prev, phone: contactForm.phone }));
      setEditingContact(false);
    } finally { setSavingContact(false); }
  };

  const savePersonal = async () => {
    setSavingPersonal(true);
    try {
      await userApi.updateProfile({ city: personalForm.city, date_of_birth: personalForm.date_of_birth });
      setProfile(prev => ({ ...prev, city: personalForm.city, date_of_birth: personalForm.date_of_birth }));
      setEditingPersonal(false);
    } finally { setSavingPersonal(false); }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await userApi.updateProfile({
        availability:         profileForm.availability,
        languages:            profileForm.languages,
        years_experience:     profileForm.years_experience ? Number(profileForm.years_experience) : 0,
        equipment_experience: profileForm.equipment_experience,
      });
      setProfile(prev => ({
        ...prev,
        availability:         profileForm.availability,
        languages:            profileForm.languages,
        years_experience:     profileForm.years_experience ? Number(profileForm.years_experience) : 0,
        equipment_experience: profileForm.equipment_experience,
      }));
      setEditingProfile(false);
    } finally { setSavingProfile(false); }
  };

  // ── Computed stats ──────────────────────────────────────
  const totalLoads    = commRows.length;
  const totalEarned   = commRows.filter(r => r.status === 'settled').reduce((s, r) => s + r.dispatcher_pay, 0);
  const pendingEarned = commRows.filter(r => r.status === 'pending').reduce((s, r) => s + r.dispatcher_pay, 0);

  const now = new Date();
  const monthLoads = commRows.filter(r => {
    if (!r.delivery_date) return false;
    const d = new Date(r.delivery_date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // Rating out of 5 — grows with experience
  const rating = Math.min(5.0, 3.5 + Math.min(totalLoads, 100) * 0.015).toFixed(1);

  // ── Profile completion ──────────────────────────────────
  const profileItems = [
    { label: 'Teléfono',             done: !!profile.phone },
    { label: 'Método de Pago',       done: !!profile.payout_method },
    { label: 'Ciudad actual',               done: !!profile.city },
    { label: 'Fecha de nacimiento',  done: !!profile.date_of_birth },
    { label: 'Idiomas',              done: !!profile.languages },
    { label: 'Años de experiencia',  done: !!profile.years_experience },
    { label: 'Disponibilidad',       done: !!profile.availability },
    { label: 'Exp. con equipos',      done: !!profile.equipment_experience },
  ];
  const score = profileItems.filter(i => i.done).length;

  // ── Achievements ────────────────────────────────────────
  const ACHIEVEMENTS = [
    { icon: '✅', label: 'Perfil Completo',      desc: 'Todas las secciones del perfil llenas',  unlocked: score >= 5,        current: score,                   target: 5  },
    { icon: '🚀', label: 'Primera Carga',        desc: 'Despacha tu primera orden',              unlocked: totalLoads >= 1,   current: Math.min(totalLoads, 1), target: 1  },
    { icon: '📦', label: 'Arrancando',           desc: '10 cargas despachadas',                  unlocked: totalLoads >= 10,  current: Math.min(totalLoads,10), target: 10 },
    { icon: '💪', label: 'Dispatch Pro',         desc: '50 cargas despachadas',                  unlocked: totalLoads >= 50,  current: Math.min(totalLoads,50), target: 50 },
    { icon: '🏆', label: 'Elite Dispatcher',     desc: '100 cargas despachadas',                 unlocked: totalLoads >= 100, current: Math.min(totalLoads,100),target: 100},
    { icon: '⭐', label: 'Top Performer',        desc: 'Rating de 4.5 o superior',               unlocked: Number(rating) >= 4.5, current: Number(rating),      target: 4.5},
    { icon: '💰', label: 'Power Earner',         desc: '$1,000+ en comisiones acumuladas',        unlocked: totalEarned >= 1000, current: Math.min(totalEarned,1000), target: 1000 },
  ];
  const unlockedCount = ACHIEVEMENTS.filter(a => a.unlocked).length;

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'D';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-8">

      {/* ── Hero card ──────────────────────────────────────── */}
      <div className={`rounded-2xl overflow-hidden shadow-sm border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>

        {/* Dark banner */}
        <div className="relative h-20 overflow-hidden" style={{
          background: 'linear-gradient(135deg, #0a1628 0%, #0f2035 35%, #0c2a45 65%, #152a40 100%)',
        }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 70% 100% at 90% 50%, ${accent}38 0%, transparent 70%)` }} />
          <div className="absolute right-5 top-3 w-10 h-10 rounded-full border border-white/10" />
          <div className="absolute right-12 top-5 w-5 h-5 rounded-full border border-white/8" />
          <div className="absolute right-20 top-2 w-3 h-3 rounded-full" style={{ background: `${accent}18` }} />
          <div className="absolute right-4 bottom-2.5 text-[9px] font-bold tracking-[0.3em] text-white/30 uppercase select-none">
            OSI LOGISTICS · {isAdmin ? 'ADMIN' : 'DISPATCH'}
          </div>
        </div>

        {/* Avatar + ID */}
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-9 mb-3">
            <div className="relative">
              <div className="w-[68px] h-[68px] rounded-[18px] flex items-center justify-center text-white font-extrabold select-none"
                   style={{
                     fontSize: 22, letterSpacing: '-0.5px',
                     background: accentGrad,
                     boxShadow: `0 8px 24px ${accent}70, 0 2px 6px rgba(0,0,0,0.18)`,
                     border: '3px solid white',
                   }}>
                {initials}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 ${dark ? 'border-slate-800' : 'border-white'} shadow-sm ${profile.shift_active ? 'bg-green-400 pulse-dot' : 'bg-slate-400'}`} />
            </div>
            {profile.dispatcher_code && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full mb-1 tracking-widest border"
                    style={{ color: accent, background: `${accent}12`, borderColor: `${accent}40` }}>
                ID #{profile.dispatcher_code}
              </span>
            )}
          </div>

          {/* Name */}
          <p className={`font-extrabold text-lg leading-tight mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>{user?.name}</p>

          {/* Contact */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${dark ? 'bg-blue-500/15' : 'bg-blue-50'}`}>
                <Mail className="w-2.5 h-2.5 text-blue-500" />
              </div>
              <p className="text-xs text-blue-500 font-medium">{user?.email}</p>
            </div>
            {profile.phone && (
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${dark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                  <Phone className="w-2.5 h-2.5 text-gray-500 dark:text-slate-400" />
                </div>
                <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{profile.phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className={`border-t mx-4 mb-1 ${dark ? 'border-slate-700' : 'border-gray-100'}`} />
        <div className="grid grid-cols-2 gap-3 p-4">
          {[
            { label: 'Total Loads', value: String(totalLoads),                    icon: Package,    color: 'text-blue-500',   bg: dark ? 'bg-blue-500/10'   : 'bg-blue-50'   },
            { label: 'Este mes',    value: String(monthLoads),                    icon: TrendingUp, color: 'text-green-500',  bg: dark ? 'bg-green-500/10'  : 'bg-green-50'  },
            { label: 'Rating',      value: `★ ${rating}`,                         icon: Star,       color: 'text-amber-500',  bg: dark ? 'bg-amber-500/10'  : 'bg-amber-50'  },
            { label: 'Logros',      value: `${unlockedCount}/${ACHIEVEMENTS.length}`, icon: Award,  color: 'text-purple-500', bg: dark ? 'bg-purple-500/10' : 'bg-purple-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-xl p-3 ${dark ? 'bg-slate-700/60' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className={`w-5 h-5 rounded-md ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-3 h-3 ${color}`} />
                </div>
                <p className={`text-[11px] font-medium ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{label}</p>
              </div>
              <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Profile completion ─────────────────────────────── */}
      <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: `${accent}18` }}>
            <Edit3 className="w-4 h-4" style={{ color: accent }} />
          </div>
          <div className="flex-1">
            <h3 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Completar perfil</h3>
            <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{score} / {profileItems.length} secciones completas</p>
          </div>
          <span className="text-sm font-black" style={{ color: accent }}>{Math.round((score / profileItems.length) * 100)}%</span>
        </div>
        <div className={`h-1.5 rounded-full mb-3 ${dark ? 'bg-slate-700' : 'bg-gray-100'}`}>
          <div className="h-full rounded-full transition-all"
               style={{ width: `${(score / profileItems.length) * 100}%`, background: accentGrad }} />
        </div>
        <div className="space-y-1.5">
          {profileItems.map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? '' : dark ? 'bg-slate-700' : 'bg-gray-100'}`}
                   style={item.done ? { background: accentGrad } : {}}>
                {item.done && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              <span className={`text-xs ${item.done ? dark ? 'text-slate-300' : 'text-gray-700' : dark ? 'text-slate-500' : 'text-gray-400'}`}>
                {item.label}
              </span>
              {!item.done && (
                <span className={`ml-auto text-[10px] font-medium ${dark ? 'text-slate-600' : 'text-gray-300'}`}>Pendiente</span>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => setEditingContact(true)}
           className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl w-full transition-colors"
           style={{ background: `${accent}15`, color: accent }}>
          <Edit3 className="w-3 h-3" /> Editar información
        </button>
      </div>

      {/* ── Contact info ───────────────────────────────────── */}
      <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(16,185,129,0.12)' }}>
              <User className="w-4 h-4 text-emerald-500" />
            </div>
            <h3 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Información de contacto</h3>
          </div>
          {!editingContact ? (
            <button onClick={() => setEditingContact(true)}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
              <Edit3 className="w-3.5 h-3.5" /> Editar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditingContact(false)}
                className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
              <button onClick={saveContact} disabled={savingContact}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ background: 'rgba(16,185,129,1)' }}>
                {savingContact ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar
              </button>
            </div>
          )}
        </div>

        {editingContact ? (
          <div className="space-y-3">
            <div>
              <label className={`block text-[10px] font-semibold mb-1 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Teléfono</label>
              <input type="tel" placeholder="(305) 555-0000" value={contactForm.phone}
                onChange={e => setContactForm({ phone: e.target.value })}
                className={`w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-emerald-400/40 ${dark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Email row */}
            <div className={`flex items-center gap-3 p-2.5 rounded-xl ${dark ? 'bg-slate-700/40' : 'bg-gray-50'}`}>
              <Mail className="w-4 h-4 flex-shrink-0 text-slate-400" />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${dark ? 'text-white' : 'text-gray-800'}`}>{user?.email}</p>
                <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Email</p>
              </div>
              {profile.email_verified
                ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500"><CheckCircle className="w-3.5 h-3.5" /> Verificado</span>
                : <button onClick={() => { setVerifying('email'); setCodeSent(false); setCodeInput(''); setVerifyMsg(''); }}
                    className="text-[10px] font-bold text-orange-500 hover:text-orange-600 whitespace-nowrap">Verificar →</button>
              }
            </div>
            {/* Phone row */}
            {profile.phone && (
              <div className={`flex items-center gap-3 p-2.5 rounded-xl ${dark ? 'bg-slate-700/40' : 'bg-gray-50'}`}>
                <Phone className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{profile.phone}</p>
                  <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Teléfono</p>
                </div>
                {profile.phone_verified
                  ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500"><CheckCircle className="w-3.5 h-3.5" /> Verificado</span>
                  : <button onClick={() => { setVerifying('phone'); setCodeSent(false); setCodeInput(''); setVerifyMsg(''); }}
                      className="text-[10px] font-bold text-orange-500 hover:text-orange-600 whitespace-nowrap">Verificar →</button>
                }
              </div>
            )}
            {!profile.phone && (
              <button onClick={() => setEditingContact(true)}
                className={`w-full mt-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${dark ? 'border-slate-600 text-slate-400 hover:bg-slate-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                + Agregar teléfono
              </button>
            )}

            {/* Verification panel */}
            {verifying && (
              <div className={`mt-2 p-3 rounded-xl border ${dark ? 'bg-slate-700/60 border-slate-600' : 'bg-orange-50 border-orange-100'}`}>
                <p className={`text-xs font-semibold mb-2 ${dark ? 'text-white' : 'text-gray-800'}`}>
                  Verificar {verifying === 'email' ? 'correo electrónico' : 'teléfono'}
                </p>
                {!codeSent ? (
                  <button onClick={() => handleSendCode(verifying)} disabled={sendingCode}
                    className="w-full py-2 rounded-lg text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {sendingCode ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : null}
                    Enviar código de 6 dígitos
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-emerald-600 font-medium">✓ {verifyMsg || 'Código enviado'}</p>
                    <input
                      type="text" inputMode="numeric" maxLength={6}
                      placeholder="000000"
                      value={codeInput}
                      onChange={e => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className={`w-full px-3 py-2 rounded-lg text-center text-lg font-bold tracking-widest border outline-none focus:ring-2 focus:ring-orange-400/40 ${dark ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                    />
                    <button onClick={handleVerifyCode} disabled={verifyingCode || codeInput.length < 6}
                      className="w-full py-2 rounded-lg text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {verifyingCode ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : null}
                      Confirmar código
                    </button>
                  </div>
                )}
                {verifyMsg && <p className={`text-[11px] mt-1.5 font-medium ${verifyMsg.includes('Error') || verifyMsg.includes('ncorrecto') ? 'text-red-500' : 'text-emerald-600'}`}>{verifyMsg}</p>}
                <button onClick={cancelVerify} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Cancelar</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Información personal ───────────────────────────── */}
      <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(59,130,246,0.12)' }}>
              <User className="w-4 h-4 text-blue-500" />
            </div>
            <h3 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Información personal</h3>
          </div>
          {!editingPersonal ? (
            <button onClick={() => setEditingPersonal(true)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors">
              <Edit3 className="w-3.5 h-3.5" /> Editar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditingPersonal(false)}
                className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
              <button onClick={savePersonal} disabled={savingPersonal}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ background: '#3b82f6' }}>
                {savingPersonal ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar
              </button>
            </div>
          )}
        </div>
        {editingPersonal ? (
          <div className="space-y-3">
            <div>
              <label className={`block text-[10px] font-semibold mb-1 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Ciudad actual</label>
              <input type="text" placeholder="Miami, FL" value={personalForm.city}
                onChange={e => setPersonalForm(f => ({ ...f, city: e.target.value }))}
                className={`w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-blue-400/40 ${dark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
            </div>
            <div>
              <label className={`block text-[10px] font-semibold mb-1 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Fecha de nacimiento</label>
              <input type="date" value={personalForm.date_of_birth}
                onChange={e => setPersonalForm(f => ({ ...f, date_of_birth: e.target.value }))}
                className={`w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-blue-400/40 ${dark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {([
              { icon: MapPin,   label: profile.city || '—',          sub: 'Ciudad actual' },
              { icon: Calendar, label: profile.date_of_birth || '—', sub: 'Fecha de nacimiento' },
            ] as { icon: React.ComponentType<{ className?: string }>; label: string; sub: string }[]).filter(row => row.label && row.label !== '—').map(row => (
              <div key={row.sub} className={`flex items-center gap-3 p-2.5 rounded-xl ${dark ? 'bg-slate-700/40' : 'bg-gray-50'}`}>
                <row.icon className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <div>
                  <p className={`text-xs font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{row.label}</p>
                  <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{row.sub}</p>
                </div>
              </div>
            ))}
            {!profile.city && !profile.date_of_birth && (
              <button onClick={() => setEditingPersonal(true)}
                className={`w-full mt-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${dark ? 'border-slate-600 text-slate-400 hover:bg-slate-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                + Agregar información personal
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Perfil profesional ─────────────────────────────── */}
      <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(249,115,22,0.12)' }}>
              <Briefcase className="w-4 h-4 text-orange-500" />
            </div>
            <h3 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Perfil profesional</h3>
          </div>
          {!editingProfile ? (
            <button onClick={() => setEditingProfile(true)}
              className="flex items-center gap-1 text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors">
              <Edit3 className="w-3.5 h-3.5" /> Editar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditingProfile(false)}
                className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
              <button onClick={saveProfile} disabled={savingProfile}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ background: '#f97316' }}>
                {savingProfile ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar
              </button>
            </div>
          )}
        </div>

        {editingProfile ? (
          <div className="space-y-3">
            {([
              { label: 'Idiomas',             key: 'languages',        placeholder: 'English, Spanish', type: 'text'   },
              { label: 'Años de experiencia', key: 'years_experience', placeholder: '5',                type: 'number' },
            ] as { label: string; key: string; placeholder: string; type: string }[]).map(({ label, key, placeholder, type }) => (
              <div key={key}>
                <label className={`block text-[10px] font-semibold mb-1 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{label}</label>
                <input type={type} placeholder={placeholder}
                  value={profileForm[key as keyof typeof profileForm]}
                  onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-orange-400/40 ${dark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
              </div>
            ))}
            <div>
              <label className={`block text-[10px] font-semibold mb-1 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Disponibilidad</label>
              <select value={profileForm.availability}
                onChange={e => setProfileForm(f => ({ ...f, availability: e.target.value }))}
                className={`w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-orange-400/40 ${dark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                {['full-time', 'part-time', 'contract', 'on-call'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-[10px] font-semibold mb-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Experiencia con equipos</label>
              <div className="flex flex-wrap gap-1.5">
                {EQUIP_TYPES.map(eq => {
                  const selected = profileForm.equipment_experience.split(',').map(s => s.trim()).filter(Boolean).includes(eq);
                  return (
                    <button key={eq} type="button"
                      onClick={() => {
                        const current = profileForm.equipment_experience.split(',').map(s => s.trim()).filter(Boolean);
                        const updated = selected ? current.filter(e => e !== eq) : [...current, eq];
                        setProfileForm(f => ({ ...f, equipment_experience: updated.join(', ') }));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${selected ? 'bg-orange-500 text-white' : dark ? 'bg-slate-600 text-slate-300 hover:bg-slate-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {eq}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {([
              { icon: Clock,     label: profile.availability || '—',                sub: 'Disponibilidad' },
              { icon: Briefcase, label: profile.years_experience ? `${profile.years_experience} años` : '—', sub: 'Experiencia' },
              { icon: Globe,     label: profile.languages || '—',                   sub: 'Idiomas' },
            ] as { icon: React.ComponentType<{ className?: string }>; label: string; sub: string }[]).filter(row => row.label && row.label !== '—').map(row => (
              <div key={row.sub} className={`flex items-center gap-3 p-2.5 rounded-xl ${dark ? 'bg-slate-700/40' : 'bg-gray-50'}`}>
                <row.icon className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <div>
                  <p className={`text-xs font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{row.label}</p>
                  <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{row.sub}</p>
                </div>
              </div>
            ))}
            {profile.equipment_experience && (
              <div className={`p-2.5 rounded-xl ${dark ? 'bg-slate-700/40' : 'bg-gray-50'}`}>
                <p className={`text-[10px] font-semibold mb-1.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Experiencia con equipos</p>
                <div className="flex flex-wrap gap-1">
                  {profile.equipment_experience.split(',').map(s => s.trim()).filter(Boolean).map(eq => (
                    <span key={eq} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400">{eq}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Performance stats ──────────────────────────────── */}
      <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: 'rgba(59,130,246,0.12)' }}>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <h3 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Performance</h3>
        </div>
        <div className="space-y-2.5">
          {[
            { icon: Package,    label: 'Cargas totales despachadas', value: totalLoads,  unit: 'loads',               color: accent },
            { icon: Calendar,   label: 'Cargas este mes',            value: monthLoads,  unit: 'loads',               color: '#3b82f6' },
            { icon: TrendingUp, label: 'Rating actual',              value: rating,      unit: '/ 5.0',               color: '#f59e0b' },
            { icon: Award,      label: 'Logros desbloqueados',       value: unlockedCount, unit: `/ ${ACHIEVEMENTS.length}`, color: '#22c55e' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                   style={{ background: `${s.color}18` }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div className="flex-1">
                <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{s.label}</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-sm font-black ${dark ? 'text-white' : 'text-gray-900'}`}>{s.value}</span>
                <span className={`text-[10px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{s.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Earnings summary ───────────────────────────────── */}
      <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: isAdmin ? 'rgba(168,85,247,0.12)' : 'rgba(249,115,22,0.12)' }}>
            <DollarSign className="w-4 h-4" style={{ color: accent }} />
          </div>
          <h3 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Comisiones</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Cobrado',   value: `$${totalEarned.toFixed(2)}`,   color: '#22c55e' },
            { label: 'Pendiente', value: `$${pendingEarned.toFixed(2)}`, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-3 ${dark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
              <p className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</p>
              <p className={`text-lg font-black mt-0.5 ${dark ? 'text-white' : 'text-gray-900'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Achievements ───────────────────────────────────── */}
      <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(251,191,36,0.12)' }}>
              <Award className="w-4 h-4 text-yellow-500" />
            </div>
            <h3 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Logros</h3>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
            {unlockedCount} / {ACHIEVEMENTS.length}
          </span>
        </div>
        <div className={`h-1.5 rounded-full mb-4 mt-2 ${dark ? 'bg-slate-700' : 'bg-gray-100'}`}>
          <div className="h-full rounded-full transition-all"
               style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%`, background: accentGrad }} />
        </div>
        <div className="space-y-2">
          {ACHIEVEMENTS.map(a => (
            <div key={a.label}
                 className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                   a.unlocked
                     ? dark ? 'bg-slate-700/60' : 'bg-gray-50'
                     : dark ? 'bg-slate-800/40 opacity-60' : 'bg-gray-50/50 opacity-60'
                 }`}>
              <div className="text-2xl w-9 h-9 flex items-center justify-center flex-shrink-0">
                {a.unlocked ? a.icon : <Lock className="w-4 h-4 text-gray-400 dark:text-slate-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>{a.label}</p>
                  {a.unlocked && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: `${accent}20`, color: accent }}>
                      UNLOCKED
                    </span>
                  )}
                </div>
                <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{a.desc}</p>
                {!a.unlocked && (
                  <div className="mt-1.5">
                    <div className={`h-1 rounded-full ${dark ? 'bg-slate-600' : 'bg-gray-200'}`}>
                      <div className="h-full rounded-full transition-all"
                           style={{ width: `${Math.min((a.current / a.target) * 100, 100)}%`, background: accentGrad }} />
                    </div>
                    <p className={`text-[9px] mt-0.5 ${dark ? 'text-slate-600' : 'text-gray-300'}`}>
                      {typeof a.current === 'number' && a.current % 1 !== 0 ? a.current.toFixed(1) : a.current} / {a.target}
                    </p>
                  </div>
                )}
              </div>
              {a.unlocked && <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
