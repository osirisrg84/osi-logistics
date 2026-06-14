import { useState, useEffect } from 'react';
import {
  Headphones, Users, PhoneCall, MessageSquare, Heart,
  Briefcase, Shield, BookOpen, AlertTriangle, ChevronRight,
  StickyNote, Plus, X, Pin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function DispatcherHub() {
  const { user } = useAuth();
  const { dark } = useTheme();
  const isAdmin = user?.role === 'admin';
  const accent = isAdmin ? '#a855f7' : '#f97316';
  const accentSoft = isAdmin ? 'rgba(168,85,247,0.12)' : 'rgba(249,115,22,0.12)';
  const accentBorder = isAdmin ? 'rgba(168,85,247,0.3)' : 'rgba(249,115,22,0.3)';

  // ── Music ──────────────────────────────────────────────
  const [musicOn, setMusicOn] = useState(() => {
    try { return localStorage.getItem('osi_music_on') === '1'; } catch { return false; }
  });

  useEffect(() => {
    localStorage.setItem('osi_music_on', musicOn ? '1' : '0');
  }, [musicOn]);

  // ── Notas ──────────────────────────────────────────────
  const [notes, setNotes] = useState<Array<{id: string; text: string; time: string}>>(() => {
    try { return JSON.parse(localStorage.getItem('osi_dispatch_notes') || '[]'); } catch { return []; }
  });
  const [noteInput, setNoteInput] = useState('');

  useEffect(() => {
    localStorage.setItem('osi_dispatch_notes', JSON.stringify(notes));
  }, [notes]);

  function addNote() {
    if (!noteInput.trim()) return;
    setNotes(prev => [{
      id: Date.now().toString(),
      text: noteInput.trim(),
      time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
    }, ...prev]);
    setNoteInput('');
  }

  // ── Hub sections ───────────────────────────────────────
  const [section, setSection] = useState<'community' | 'support'>('community');

  // ── Community ──────────────────────────────────────────
  const [posts, setPosts] = useState([
    {
      id: 'p1', avatar: 'MG', name: 'Maria Garcia', role: 'Dispatcher', time: '30m',
      msg: '¡Nuevo record hoy! 15 cargas coordinadas sin un solo delay. El equipo OSI siempre al 100% 🚛💨 #OSILogistics',
      likes: 9, liked: false,
    },
    {
      id: 'p2', avatar: 'JL', name: 'Jose Lopez', role: 'Admin', time: '2h',
      msg: 'Reminder: todos los drivers deben actualizar su paperwork antes del lunes. Envíen docs al dispatch@osilogistics.com 📋',
      likes: 5, liked: false,
    },
    {
      id: 'p3', avatar: 'AR', name: 'Ana Reyes', role: 'Dispatcher', time: '3h',
      msg: 'Shoutout al driver Carlos R. — 5 cargas hoy, cero incidentes. Así se trabaja 🌟 Que sigan los buenos resultados',
      likes: 12, liked: false,
    },
    {
      id: 'p4', avatar: 'DM', name: 'Diego Martinez', role: 'Dispatcher', time: '5h',
      msg: 'Tip: siempre confirmen el ETA con el warehouse 30 min antes. Ahorran tiempo en dock y mejoran nuestras métricas 💡',
      likes: 7, liked: false,
    },
  ]);
  const [postText, setPostText] = useState('');

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'D';

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-4">

      {/* ── Music Toggle Card ─────────────────────────────── */}
      <div className={`rounded-2xl overflow-hidden shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>
        <div
          className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none active:opacity-80 transition-opacity"
          style={{ borderBottom: musicOn ? '1px solid rgba(168,85,247,0.18)' : 'none' }}
          onClick={() => setMusicOn(v => !v)}
        >
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
               style={{ background: musicOn ? 'rgba(168,85,247,0.15)' : dark ? 'rgba(51,65,85,0.6)' : '#f1f5f9' }}>
            <Headphones className="w-5 h-5" style={{ color: musicOn ? '#c084fc' : '#94a3b8' }} />
          </div>

          {/* Label */}
          <div className="flex-1">
            <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Trap & Reggae Romantico</p>
            <p className="text-[11px] leading-tight" style={{ color: musicOn ? '#c084fc' : '#94a3b8' }}>
              {musicOn ? '🎵 OSI Dispatch Music — activo' : 'Música para la jornada de trabajo'}
            </p>
          </div>

          {/* Toggle pill */}
          <div className="relative flex-shrink-0 rounded-full transition-all duration-300"
               style={{
                 width: 48, height: 26,
                 background: musicOn ? 'linear-gradient(90deg,#a855f7,#7c3aed)' : dark ? 'rgba(51,65,85,0.9)' : '#e2e8f0',
                 boxShadow: musicOn ? '0 0 12px rgba(168,85,247,0.5)' : 'none',
               }}>
            <div className="absolute rounded-full bg-white shadow-md"
                 style={{ width: 20, height: 20, top: 3, left: musicOn ? 25 : 3, transition: 'left 0.25s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
          </div>
        </div>

        {/* Spotify embed */}
        {musicOn && (
          <div style={{ padding: '10px 12px 12px', background: dark ? 'rgba(168,85,247,0.05)' : 'rgba(168,85,247,0.03)' }}>
            <iframe
              src="https://open.spotify.com/embed/playlist/37i9dQZF1DWY7IeIP1cdjF?utm_source=generator&theme=0"
              width="100%" height="80"
              style={{ border: 'none', borderRadius: 12, display: 'block' }}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>
        )}
      </div>

      {/* ── Notas Importantes ─────────────────────────────── */}
      <div className={`rounded-2xl overflow-hidden shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accentSoft }}>
            <StickyNote className="w-5 h-5" style={{ color: accent }} />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Notas Importantes</p>
            <p className="text-[11px]" style={{ color: '#94a3b8' }}>Apuntes rápidos del turno</p>
          </div>
          {notes.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: accentSoft, color: accent }}>
              {notes.length}
            </span>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2 px-4 py-3" style={{ borderBottom: notes.length > 0 ? `1px solid ${dark ? 'rgba(255,255,255,0.04)' : '#f8fafc'}` : 'none' }}>
          <input
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
            placeholder="Apuntar algo importante..."
            maxLength={200}
            className={`flex-1 text-sm px-3 py-2 rounded-xl outline-none border-0 ${dark ? 'bg-slate-700 text-slate-200 placeholder:text-slate-500' : 'bg-gray-50 text-gray-800 placeholder:text-gray-400'}`}
          />
          <button
            onClick={addNote}
            disabled={!noteInput.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-40"
            style={{ background: `linear-gradient(135deg,${accent},${isAdmin ? '#7c3aed' : '#ea580c'})` }}
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Notes list */}
        {notes.length > 0 && (
          <div className="p-3 space-y-2 max-h-56 overflow-y-auto">
            {notes.map((note, i) => (
              <div key={note.id}
                className="flex items-start gap-2.5 p-3 rounded-xl"
                style={{
                  background: dark
                    ? i % 2 === 0 ? 'rgba(251,191,36,0.07)' : 'rgba(249,115,22,0.06)'
                    : i % 2 === 0 ? 'rgba(251,191,36,0.07)' : 'rgba(249,115,22,0.05)',
                  border: `1px solid ${dark ? 'rgba(251,191,36,0.12)' : 'rgba(251,191,36,0.14)'}`,
                }}>
                <Pin className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-400" />
                <p className={`flex-1 text-sm leading-snug ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{note.text}</p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-slate-500">{note.time}</span>
                  <button
                    onClick={() => setNotes(prev => prev.filter(n => n.id !== note.id))}
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${dark ? 'hover:bg-white/10 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-400'}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section Tabs ─────────────────────────────────── */}
      <div className="flex gap-2">
        {([
          { id: 'community' as const, icon: Users,     label: 'Comunidad' },
          { id: 'support'   as const, icon: PhoneCall, label: 'Support' },
        ]).map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={section === s.id ? {
              background: `linear-gradient(135deg, ${accent}, ${isAdmin ? '#7c3aed' : '#ea580c'})`,
              color: '#fff',
              boxShadow: `0 4px 14px ${isAdmin ? 'rgba(168,85,247,0.3)' : 'rgba(249,115,22,0.3)'}`,
            } : {
              background: dark ? 'rgba(51,65,85,0.5)' : '#f8fafc',
              color: dark ? '#94a3b8' : '#64748b',
              border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
            }}>
            <s.icon className="w-4 h-4" />
            {s.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/*  COMUNIDAD                                        */}
      {/* ══════════════════════════════════════════════════ */}
      {section === 'community' && (
        <div className="space-y-3">

          {/* Post composer */}
          <div className={`rounded-2xl p-4 shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>
            <div className="flex gap-3">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm text-white"
                   style={{ background: `linear-gradient(135deg, ${accent}, ${isAdmin ? '#7c3aed' : '#ea580c'})` }}>
                {initials}
              </div>
              <div className="flex-1">
                <textarea
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  placeholder="Comparte una actualización con el equipo OSI..."
                  className={`w-full text-sm rounded-xl p-3 resize-none border-0 outline-none ${dark ? 'bg-slate-700 text-slate-200 placeholder:text-slate-500' : 'bg-gray-50 text-gray-800 placeholder:text-gray-400'}`}
                  rows={2}
                  maxLength={280}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className={`text-[10px] ${dark ? 'text-slate-600' : 'text-gray-300'}`}>{postText.length}/280</span>
                  <button
                    disabled={!postText.trim()}
                    onClick={() => {
                      if (!postText.trim()) return;
                      setPosts(prev => [{
                        id: Date.now().toString(),
                        avatar: initials,
                        name: user?.name || 'Dispatcher',
                        role: isAdmin ? 'Admin' : 'Dispatcher',
                        time: 'ahora',
                        msg: postText.trim(),
                        likes: 0,
                        liked: false,
                      }, ...prev]);
                      setPostText('');
                    }}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white active:scale-95 disabled:opacity-40 transition-all"
                    style={{ background: `linear-gradient(135deg,${accent},${isAdmin ? '#7c3aed' : '#ea580c'})` }}>
                    Publicar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Posts feed */}
          {posts.map(post => (
            <div key={post.id}
                 className={`rounded-2xl p-4 shadow-sm transition-shadow hover:shadow-md ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>

              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm text-white"
                     style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
                  {post.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>{post.name}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: post.role === 'Admin' ? 'rgba(168,85,247,0.15)' : 'rgba(249,115,22,0.12)', color: post.role === 'Admin' ? '#c084fc' : '#fb923c' }}>
                      {post.role}
                    </span>
                  </div>
                  <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{post.time} · OSI Team</p>
                </div>
              </div>

              {/* Body */}
              <p className={`text-sm leading-relaxed mb-3 ${dark ? 'text-slate-300' : 'text-gray-700'}`}>{post.msg}</p>

              {/* Actions */}
              <div className={`flex items-center gap-4 pt-2.5 border-t ${dark ? 'border-slate-700/60' : 'border-gray-50'}`}>
                <button
                  onClick={() => setPosts(prev => prev.map(p =>
                    p.id === post.id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
                  ))}
                  className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${post.liked ? 'text-red-500' : dark ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-400'}`}>
                  <Heart className="w-3.5 h-3.5" style={{ fill: post.liked ? 'currentColor' : 'none' }} />
                  {post.likes}
                </button>
                <button className={`flex items-center gap-1.5 text-xs transition-colors ${dark ? 'text-slate-500 hover:text-blue-400' : 'text-gray-400 hover:text-blue-500'}`}>
                  <MessageSquare className="w-3.5 h-3.5" />
                  Responder
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/*  SUPPORT                                          */}
      {/* ══════════════════════════════════════════════════ */}
      {section === 'support' && (
        <div className="space-y-3">

          {/* OSI Contacts */}
          <div className={`rounded-2xl p-5 shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: accentSoft }}>
                <PhoneCall className="w-4 h-4" style={{ color: accent }} />
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Contactos OSI Logistics</p>
                <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Líneas directas 24/7</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {([
                { label: 'Operations Manager',     phone: '+1 (786) 333-1000', desc: 'Decisiones operacionales urgentes',   color: '#22c55e' },
                { label: 'Driver Support Line',    phone: '+1 (786) 333-4444', desc: 'Issues con drivers · Status de ruta', color: '#3b82f6' },
                { label: 'Fleet Maintenance',      phone: '+1 (786) 333-6600', desc: 'Averías y mantenimiento de unidades', color: '#f59e0b' },
                { label: 'Emergencias 24/7',       phone: '+1 (786) 333-9911', desc: 'Accidentes · Incidentes críticos',     color: '#ef4444' },
              ]).map(c => (
                <a
                  key={c.phone}
                  href={`tel:+${c.phone.replace(/\D/g, '')}`}
                  className={`flex items-center justify-between p-3 rounded-xl group transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                  style={{ border: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <div>
                      <p className={`text-sm font-semibold group-hover:text-blue-500 transition-colors ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{c.label}</p>
                      <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{c.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold" style={{ color: accent }}>{c.phone}</span>
                    <PhoneCall className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Key Policies */}
          <div className={`rounded-2xl p-5 shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(59,130,246,0.12)' }}>
                <Shield className="w-4 h-4 text-blue-500" />
              </div>
              <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Policies & Compliance</p>
            </div>
            <div className="space-y-2">
              {([
                { icon: BookOpen,      label: 'Manual de Operaciones OSI',      desc: 'Procedimientos y políticas internas' },
                { icon: AlertTriangle, label: 'Reportar Incidente',             desc: 'Accidentes · Robos · Daños a carga' },
                { icon: Briefcase,     label: 'Asignación de Loads',            desc: 'Criterios de asignación dispatcher' },
                { icon: Shield,        label: 'Compliance & Regulatory',        desc: 'DOT · FMCSA · Licencias activas' },
              ]).map(r => (
                <button
                  key={r.label}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors group ${dark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                  style={{ border: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: dark ? 'rgba(59,130,246,0.12)' : '#eff6ff' }}>
                    <r.icon className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${dark ? 'text-slate-200' : 'text-gray-800'} group-hover:text-blue-500 transition-colors`}>{r.label}</p>
                    <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{r.desc}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${dark ? 'text-slate-600' : 'text-gray-300'} group-hover:text-blue-400 transition-colors`} />
                </button>
              ))}
            </div>
          </div>

          {/* Quick email */}
          <div className={`rounded-2xl p-5 shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${dark ? 'text-slate-400' : 'text-gray-400'}`}>Emails directos</p>
            <div className="space-y-2">
              {([
                { label: 'Dispatch Operations', email: 'dispatch@osilogistics.com' },
                { label: 'Billing / Payments',  email: 'billing@osilogistics.com'  },
                { label: 'HR / Recursos',        email: 'hr@osilogistics.com'       },
              ]).map(e => (
                <a
                  key={e.email}
                  href={`mailto:${e.email}`}
                  className={`flex items-center justify-between p-3 rounded-xl transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                  style={{ border: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}` }}>
                  <p className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-gray-700'}`}>{e.label}</p>
                  <p className="text-xs font-mono" style={{ color: accent }}>{e.email}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
