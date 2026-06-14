import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, MapPin, Users, BarChart3, MoreHorizontal, X, Truck, Layers, Headphones, StickyNote, Plus, Pin, Zap } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getSocket } from '../services/socket';
import api from '../services/api';

const BACKEND = import.meta.env.PROD
  ? 'https://osi-logistics-backend.onrender.com'
  : 'http://localhost:3001';

const BOTTOM_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home'    },
  { to: '/orders',    icon: Package,         label: 'Orders'  },
  { to: '/tracking',  icon: MapPin,          label: 'Tracking'},
  { to: '/drivers',   icon: Users,           label: 'Drivers' },
  { to: '/hub',       icon: Layers,          label: 'Hub'     },
];

interface DriverToast {
  id: string;
  name: string;
  status: string;
}

function DriverOnlineToast({ toast, onClose }: { toast: DriverToast; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="flex items-center gap-3 bg-slate-900 border border-green-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl min-w-[260px] max-w-xs animate-slide-in">
      <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
        <Truck className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-green-400">Driver Online</p>
        <p className="text-sm font-bold text-white truncate">{toast.name}</p>
        <p className="text-xs text-slate-400">Está disponible y listo</p>
      </div>
      <button onClick={onClose} className="text-slate-500 hover:text-slate-300 flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

async function registerPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const { data } = await api.get('/push/vapid-public-key');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.key),
    });
    await api.post('/push/subscribe', sub.toJSON());
  } catch {
    // Push not supported or denied — silent fail
  }
}

function DispatcherTopStrip() {
  const { user } = useAuth();
  const { dark } = useTheme();
  if (user?.role !== 'dispatcher') return null;

  const [musicOn, setMusicOn] = useState(() => {
    try { return localStorage.getItem('osi_music_on') === '1'; } catch { return false; }
  });
  const [notesOpen, setNotesOpen] = useState(false);
  const [dispActive, setDispActive] = useState(() => {
    try { return localStorage.getItem('osi_disp_active') === '1'; } catch { return false; }
  });
  const [notes, setNotes] = useState<Array<{id: string; text: string; time: string}>>(() => {
    try { return JSON.parse(localStorage.getItem('osi_dispatch_notes') || '[]'); } catch { return []; }
  });
  const [noteInput, setNoteInput] = useState('');

  useEffect(() => { localStorage.setItem('osi_music_on', musicOn ? '1' : '0'); }, [musicOn]);
  useEffect(() => { localStorage.setItem('osi_disp_active', dispActive ? '1' : '0'); }, [dispActive]);
  useEffect(() => { localStorage.setItem('osi_dispatch_notes', JSON.stringify(notes)); }, [notes]);

  function addNote() {
    if (!noteInput.trim()) return;
    setNotes(prev => [{ id: Date.now().toString(), text: noteInput.trim(), time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) }, ...prev]);
    setNoteInput('');
  }

  const sw = (on: boolean, grad: string, glow: string, bg: string) => ({
    background: on ? bg : dark ? 'rgba(15,23,42,0.9)' : 'rgba(241,245,249,0.9)',
    border: `1px solid ${on ? glow : dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
    boxShadow: on ? `0 0 8px ${glow}` : 'none',
  });

  const toggle = (on: boolean, grad: string, glow: string) => ({
    width: 24, height: 13,
    background: on ? grad : dark ? 'rgba(51,65,85,0.9)' : '#e2e8f0',
    boxShadow: on ? `0 0 6px ${glow}` : 'none',
    transition: 'background 0.25s',
  });

  return (
    <div className={`border-b ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
      <div className="px-3 py-2 max-w-lg mx-auto space-y-2">

        {/* 3-switch row */}
        <div className="flex gap-1.5">

          {/* Activo */}
          <button onClick={() => setDispActive(v => !v)}
            className="flex-1 flex items-center gap-1 px-1.5 py-2.5 rounded-xl select-none active:scale-[0.97] transition-all"
            style={sw(dispActive, 'linear-gradient(90deg,#22c55e,#16a34a)', 'rgba(34,197,94,0.35)', 'rgba(34,197,94,0.13)')}>
            <Zap className={`w-3 h-3 flex-shrink-0 ${dispActive ? 'text-green-400' : 'text-slate-400'}`} />
            <div className="flex-1 text-left">
              <p className={`text-[9px] font-bold leading-none ${dark ? 'text-white' : 'text-gray-900'}`}>Activo</p>
              <p className="text-[8px] leading-none mt-0.5" style={{ color: dispActive ? '#4ade80' : '#94a3b8' }}>{dispActive ? 'En turno' : 'Libre'}</p>
            </div>
            <div className="relative flex-shrink-0 rounded-full" style={toggle(dispActive, 'linear-gradient(90deg,#22c55e,#16a34a)', 'rgba(34,197,94,0.45)')}>
              <div className="absolute rounded-full bg-white" style={{ width: 9, height: 9, top: 2, left: dispActive ? 13 : 2, transition: 'left 0.22s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
            </div>
          </button>

          {/* Notas */}
          <button onClick={() => setNotesOpen(v => !v)}
            className="flex-1 flex items-center gap-1 px-1.5 py-2.5 rounded-xl select-none active:scale-[0.97] transition-all"
            style={sw(notesOpen, 'linear-gradient(90deg,#f59e0b,#d97706)', 'rgba(251,191,36,0.35)', 'rgba(251,191,36,0.13)')}>
            <StickyNote className={`w-3 h-3 flex-shrink-0 ${notesOpen ? 'text-amber-400' : 'text-slate-400'}`} />
            <div className="flex-1 text-left">
              <p className={`text-[9px] font-bold leading-none ${dark ? 'text-white' : 'text-gray-900'}`}>Notas</p>
              <p className="text-[8px] leading-none mt-0.5" style={{ color: notesOpen ? '#fbbf24' : '#94a3b8' }}>
                {notes.length > 0 ? `${notes.length} nota${notes.length !== 1 ? 's' : ''}` : 'Vacío'}
              </p>
            </div>
            <div className="relative flex-shrink-0 rounded-full" style={toggle(notesOpen, 'linear-gradient(90deg,#f59e0b,#d97706)', 'rgba(251,191,36,0.45)')}>
              <div className="absolute rounded-full bg-white" style={{ width: 9, height: 9, top: 2, left: notesOpen ? 13 : 2, transition: 'left 0.22s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
            </div>
          </button>

          {/* Music */}
          <button onClick={() => setMusicOn(v => !v)}
            className="flex-1 flex items-center gap-1 px-1.5 py-2.5 rounded-xl select-none active:scale-[0.97] transition-all"
            style={sw(musicOn, 'linear-gradient(90deg,#a855f7,#7c3aed)', 'rgba(168,85,247,0.35)', 'rgba(168,85,247,0.13)')}>
            <Headphones className={`w-3 h-3 flex-shrink-0 ${musicOn ? 'text-purple-400' : 'text-slate-400'}`} />
            <div className="flex-1 text-left">
              <p className={`text-[9px] font-bold leading-none ${dark ? 'text-white' : 'text-gray-900'}`}>Music</p>
              <p className="text-[8px] leading-none mt-0.5" style={{ color: musicOn ? '#c084fc' : '#94a3b8' }}>{musicOn ? '▶ Play' : 'Reggae'}</p>
            </div>
            <div className="relative flex-shrink-0 rounded-full" style={toggle(musicOn, 'linear-gradient(90deg,#a855f7,#7c3aed)', 'rgba(168,85,247,0.45)')}>
              <div className="absolute rounded-full bg-white" style={{ width: 9, height: 9, top: 2, left: musicOn ? 13 : 2, transition: 'left 0.22s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
            </div>
          </button>

        </div>

        {/* Spotify — stays mounted = música no se corta */}
        {musicOn && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(168,85,247,0.22)' }}>
            <iframe
              src="https://open.spotify.com/embed/playlist/37i9dQZF1DWY7IeIP1cdjF?utm_source=generator&theme=0"
              width="100%" height="80"
              style={{ border: 'none', display: 'block' }}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>
        )}

        {/* Notes panel */}
        {notesOpen && (
          <div className={`rounded-xl overflow-hidden ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex gap-2 px-3 py-2.5" style={{ borderBottom: notes.length > 0 ? `1px solid ${dark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}` : 'none' }}>
              <input
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
                placeholder="Apuntar algo importante..."
                maxLength={200}
                className={`flex-1 text-sm px-3 py-2 rounded-lg outline-none border-0 ${dark ? 'bg-slate-700 text-slate-200 placeholder:text-slate-500' : 'bg-white text-gray-800 placeholder:text-gray-400'}`}
              />
              <button onClick={addNote} disabled={!noteInput.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 active:scale-90 disabled:opacity-40 transition-all"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                <Plus className="w-4 h-4 text-white" />
              </button>
            </div>
            {notes.length > 0 && (
              <div className="px-3 pb-3 pt-2 space-y-1.5 max-h-40 overflow-y-auto">
                {notes.map((note, i) => (
                  <div key={note.id} className="flex items-start gap-2 p-2.5 rounded-lg"
                    style={{
                      background: dark ? (i % 2 === 0 ? 'rgba(251,191,36,0.07)' : 'rgba(249,115,22,0.06)') : (i % 2 === 0 ? 'rgba(251,191,36,0.07)' : 'rgba(249,115,22,0.05)'),
                      border: `1px solid ${dark ? 'rgba(251,191,36,0.12)' : 'rgba(251,191,36,0.15)'}`,
                    }}>
                    <Pin className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-400" />
                    <p className={`flex-1 text-xs leading-snug ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{note.text}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[9px] text-slate-500">{note.time}</span>
                      <button onClick={() => setNotes(prev => prev.filter(n => n.id !== note.id))}
                        className={`w-4 h-4 rounded-full flex items-center justify-center ${dark ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-400'}`}>
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function BottomNav({ onMoreClick }: { onMoreClick: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const activeColor = isAdmin ? 'text-purple-500' : 'text-orange-500';
  const activeBg   = isAdmin ? 'bg-purple-50 dark:bg-purple-900/30' : 'bg-orange-50 dark:bg-orange-900/30';

  const navItems = isAdmin
    ? BOTTOM_NAV
    : [
        { to: '/hub',       icon: Layers,          label: 'Hub'     },
        { to: '/orders',    icon: Package,         label: 'Orders'  },
        { to: '/tracking',  icon: MapPin,          label: 'Tracking'},
        { to: '/drivers',   icon: Users,           label: 'Drivers' },
        { to: '/dashboard', icon: LayoutDashboard, label: 'Stats'   },
      ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex items-stretch">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors
            ${isActive ? `${activeColor} ${activeBg}` : 'text-gray-400 dark:text-slate-500'}`
          }
        >
          <Icon className="w-5 h-5" />
          {label}
        </NavLink>
      ))}
      <button
        onClick={onMoreClick}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-gray-400 dark:text-slate-500"
        title="Más opciones"
      >
        <MoreHorizontal className="w-5 h-5" />
        More
      </button>
    </nav>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const flag = sessionStorage.getItem('open_sidebar');
    if (flag) { sessionStorage.removeItem('open_sidebar'); return true; }
    return false;
  });

  const [toasts, setToasts] = useState<DriverToast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('subscribe_dispatchers');

    socket.on('driver_status_changed', (event: { id: string; name: string; status: string }) => {
      if (event.status === 'available') {
        setToasts(prev => [...prev.slice(-3), { id: event.id + Date.now(), name: event.name, status: event.status }]);
      }
    });

    registerPush();

    return () => { socket.off('driver_status_changed'); };
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 transform transition-transform duration-200
        md:relative md:translate-x-0 md:flex md:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <DispatcherTopStrip />
        <main className="flex-1 overflow-y-auto p-3 md:p-6 pb-16 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom navigation — mobile only */}
      <BottomNav onMoreClick={() => setSidebarOpen(true)} />

      {/* Driver online toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 items-end">
          {toasts.map(t => (
            <DriverOnlineToast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
