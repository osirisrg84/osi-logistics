import { useState, useEffect } from 'react';
import {
  Star, Award, Package, TrendingUp, Clock, CheckCircle,
  Phone, Mail, Shield, Lock, Edit3, User, Calendar,
  DollarSign, BarChart3,
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

  useEffect(() => {
    Promise.all([
      userApi.getProfile().catch(() => ({ data: {} })),
      billingApi.getByDispatcher().catch(() => ({ data: [] })),
    ]).then(([profileRes, commRes]) => {
      setProfile(profileRes.data || {});
      setCommRows(Array.isArray(commRes.data) ? commRes.data : []);
    }).finally(() => setLoading(false));
  }, []);

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
    { label: 'Teléfono',          done: !!profile.phone },
    { label: 'Código Dispatcher', done: !!profile.dispatcher_code },
    { label: 'Método de Pago',    done: !!profile.payout_method },
    { label: 'Años experiencia',  done: !!profile.years_experience },
    { label: 'Idiomas',           done: !!profile.languages },
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
      <div className="rounded-2xl overflow-hidden shadow-lg"
           style={{ background: 'linear-gradient(to bottom, #132640, #0a1628)' }}>

        {/* Identity card */}
        <div className="p-4">
          <div className="flex items-center gap-4 rounded-2xl px-4 py-3.5 bg-white/[0.06] border border-white/10">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg"
                   style={{ background: accentGrad }}>
                <span className="text-white drop-shadow-sm">{initials}</span>
              </div>
              <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0f1e35] ${profile.shift_active ? 'bg-green-400 pulse-dot' : 'bg-slate-500'}`} />
            </div>

            {/* Name & role */}
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-white leading-tight truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {profile.availability || (isAdmin ? 'Full-time Admin' : 'Full-time Dispatcher')}
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold mt-1.5 px-2 py-0.5 rounded-full"
                    style={{ background: `${accent}20`, color: accent }}>
                <span className={`w-1.5 h-1.5 rounded-full ${profile.shift_active ? 'bg-green-400 pulse-dot' : 'bg-slate-500'}`} />
                {isAdmin ? '👑 Admin' : '🎧 Dispatcher'}
              </span>
            </div>

            {/* Rating badge */}
            <div className="flex flex-col items-center rounded-2xl px-3 py-2 flex-shrink-0 bg-amber-500/10 border border-amber-500/20">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="text-sm font-bold text-white mt-0.5">{rating}</span>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-4 pb-5">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Total Loads', value: String(totalLoads) },
              { label: 'Este mes',    value: String(monthLoads) },
              { label: 'Logros',      value: `${unlockedCount}/${ACHIEVEMENTS.length}` },
            ].map(s => (
              <div key={s.label} className="rounded-2xl px-2 py-4 text-center bg-white/[0.06] border border-white/10">
                <p className="text-2xl font-bold" style={{ color: accent }}>{s.value}</p>
                <p className="text-xs mt-0.5 text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
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
        <a href="/settings"
           className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl w-full transition-colors"
           style={{ background: `${accent}15`, color: accent }}>
          <Edit3 className="w-3 h-3" /> Editar en Settings
        </a>
      </div>

      {/* ── Contact info ───────────────────────────────────── */}
      <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: 'rgba(16,185,129,0.12)' }}>
            <User className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Información de contacto</h3>
        </div>
        <div className="space-y-2">
          {[
            { icon: Mail,   label: user?.email || '—',          sub: 'Email' },
            { icon: Phone,  label: profile.phone || 'Sin teléfono', sub: 'Teléfono' },
            { icon: Shield, label: profile.dispatcher_code ? `#${profile.dispatcher_code}` : 'Sin código', sub: 'Código Dispatcher' },
            { icon: Clock,  label: profile.availability || 'Full-time', sub: 'Disponibilidad' },
          ].map(row => (
            <div key={row.sub} className={`flex items-center gap-3 p-2.5 rounded-xl ${dark ? 'bg-slate-700/40' : 'bg-gray-50'}`}>
              <row.icon className="w-4 h-4 flex-shrink-0 text-slate-400" />
              <div>
                <p className={`text-xs font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{row.label}</p>
                <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{row.sub}</p>
              </div>
            </div>
          ))}
        </div>
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
