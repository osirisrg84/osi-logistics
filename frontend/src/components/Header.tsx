import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, RefreshCw, X, Check, LogOut, ChevronDown, Shield, Truck, ClipboardList, Sun, Moon, Zap, StickyNote, Headphones, Plus, Pin } from 'lucide-react';
import osiLogo from '../assets/osi-logo.jpeg';
import { notificationsApi } from '../services/api';
import { Notification } from '../types';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { formatDistanceToNow } from 'date-fns';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/orders': 'Orders',
  '/tracking': 'Live Tracking',
  '/drivers': 'Drivers',
  '/fleet': 'Fleet',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/users': 'Users',
};

const NOTIF_COLORS: Record<string, string> = {
  order: 'bg-blue-100 text-blue-700',
  driver: 'bg-green-100 text-green-700',
  truck: 'bg-purple-100 text-purple-700',
  system: 'bg-gray-100 text-gray-700',
  alert: 'bg-red-100 text-red-700',
};

function playShiftOnSound() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(0.2, t + 0.25);
    master.gain.linearRampToValueAtTime(0, t + 1.4);
    master.connect(ctx.destination);

    const delay = ctx.createDelay(0.4);
    delay.delayTime.value = 0.3;
    const delayGain = ctx.createGain();
    delayGain.gain.value = 0.25;
    delay.connect(delayGain);
    delayGain.connect(delay);
    delayGain.connect(master);

    const notes = [196, 246.94, 293.66, 392]; // G3, B3, D4, G4 — ascendente, cálido
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const s = t + i * 0.09;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.45, s + 0.15);
      g.gain.linearRampToValueAtTime(0, s + 1.0);
      osc.connect(g);
      g.connect(master);
      g.connect(delay);
      osc.start(s);
      osc.stop(s + 1.2);
    });
  } catch { /* AudioContext unavailable */ }
}

function playShiftOffSound() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(0.18, t + 0.3);
    master.gain.linearRampToValueAtTime(0, t + 1.6);
    master.connect(ctx.destination);

    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.36;
    const delayGain = ctx.createGain();
    delayGain.gain.value = 0.3;
    delay.connect(delayGain);
    delayGain.connect(delay);
    delayGain.connect(master);

    const notes = [392, 329.63, 261.63, 196]; // G4, E4, C4, G3 — descendente, relajado
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const s = t + i * 0.12;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.4, s + 0.2);
      g.gain.linearRampToValueAtTime(0, s + 1.2);
      osc.connect(g);
      g.connect(master);
      g.connect(delay);
      osc.start(s);
      osc.stop(s + 1.4);
    });
  } catch { /* AudioContext unavailable */ }
}

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const title = PAGE_TITLES[location.pathname] || 'OSI Logistics';
  const isDispatcher = user?.role === 'dispatcher';

  // ── Dispatcher strip state (shared mobile + desktop) ──────
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem('osi_music_on') === '1'; } catch { return false; } });
  const [notesOpen, setNotesOpen] = useState(false);
  const [dispActive, setDispActive] = useState(() => { try { return localStorage.getItem('osi_disp_active') === '1'; } catch { return false; } });
  const [notes, setNotes] = useState<Array<{id: string; text: string; time: string}>>(() => { try { return JSON.parse(localStorage.getItem('osi_dispatch_notes') || '[]'); } catch { return []; } });
  const [noteInput, setNoteInput] = useState('');

  useEffect(() => { if (isDispatcher) localStorage.setItem('osi_music_on', musicOn ? '1' : '0'); }, [musicOn, isDispatcher]);
  useEffect(() => { if (isDispatcher) localStorage.setItem('osi_disp_active', dispActive ? '1' : '0'); }, [dispActive, isDispatcher]);
  useEffect(() => { if (isDispatcher) localStorage.setItem('osi_dispatch_notes', JSON.stringify(notes)); }, [notes, isDispatcher]);

  function addNote() {
    if (!noteInput.trim()) return;
    setNotes(prev => [{ id: Date.now().toString(), text: noteInput.trim(), time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) }, ...prev]);
    setNoteInput('');
  }

  const swStyle = (on: boolean, activeBg: string, activeBorder: string) => ({
    background: on ? activeBg : dark ? 'rgba(15,23,42,0.9)' : 'rgba(241,245,249,0.9)',
    border: `1px solid ${on ? activeBorder : dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
    boxShadow: on ? `0 0 8px ${activeBorder}` : 'none',
  });

  const toggleStyle = (on: boolean, grad: string, glow: string) => ({
    width: 24, height: 13,
    background: on ? grad : dark ? 'rgba(51,65,85,0.9)' : '#e2e8f0',
    boxShadow: on ? `0 0 6px ${glow}` : 'none',
    transition: 'background 0.25s',
  });

  const knobLeft = (on: boolean) => ({ width: 9, height: 9, top: 2, left: on ? 13 : 2, transition: 'left 0.22s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' });

  function SwitchPanels() {
    return (
      <>
        {musicOn && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(168,85,247,0.22)' }}>
            <iframe src="https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&theme=0"
              width="100%" height="80" style={{ border: 'none', display: 'block' }}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
          </div>
        )}
        {notesOpen && (
          <div className={`rounded-xl overflow-hidden ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex gap-2 px-3 py-2.5" style={{ borderBottom: notes.length > 0 ? `1px solid ${dark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}` : 'none' }}>
              <input value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
                placeholder="Apuntar algo importante..." maxLength={200}
                className={`flex-1 text-sm px-3 py-2 rounded-lg outline-none border-0 ${dark ? 'bg-slate-700 text-slate-200 placeholder:text-slate-500' : 'bg-white text-gray-800 placeholder:text-gray-400'}`} />
              <button onClick={addNote} disabled={!noteInput.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 active:scale-90 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                <Plus className="w-4 h-4 text-white" />
              </button>
            </div>
            {notes.length > 0 && (
              <div className="px-3 pb-3 pt-2 space-y-1.5 max-h-40 overflow-y-auto">
                {notes.map((note, i) => (
                  <div key={note.id} className="flex items-start gap-2 p-2.5 rounded-lg"
                    style={{ background: dark ? (i % 2 === 0 ? 'rgba(251,191,36,0.07)' : 'rgba(249,115,22,0.06)') : (i % 2 === 0 ? 'rgba(251,191,36,0.07)' : 'rgba(249,115,22,0.05)'), border: `1px solid ${dark ? 'rgba(251,191,36,0.12)' : 'rgba(251,191,36,0.15)'}` }}>
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
      </>
    );
  }

  const fetchNotifications = async () => {
    try {
      const { data } = await notificationsApi.getAll();
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const socket = getSocket();
    socket.on('notification', (notif: Notification) => {
      setNotifications(prev => [notif, ...prev].slice(0, 50));
      setUnread(prev => prev + 1);
    });
    return () => { socket.off('notification'); };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
      <div className="px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* OSI Logo — mobile only, tapping opens sidebar */}
        <button
          onClick={onMenuClick}
          className="md:hidden -ml-1 rounded-lg p-0.5 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
        >
          <img src={osiLogo} alt="OSI Logistics" className="h-9 w-auto object-contain rounded-md" />
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
            user?.role === 'admin'
              ? 'text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-500/20 dark:border-purple-500/30'
              : 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-500/20 dark:border-orange-500/30'
          }`}>
            {user?.role === 'admin' ? 'Admin Console' : 'Dispatch Center'}
          </span>
        </button>
        {/* Page title — desktop only */}
        <div className="hidden md:block">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* CENTER — dispatcher 3 switches, desktop only */}
      {isDispatcher && (
        <div className="hidden md:flex items-center gap-1.5 flex-1 mx-8 max-w-xs">
          {/* Activo */}
          <button onClick={() => setDispActive(v => { const nv = !v; nv ? playShiftOnSound() : playShiftOffSound(); return nv; })} className="flex-1 flex items-center gap-1 px-1.5 py-2 rounded-xl select-none active:scale-[0.97] transition-all" style={swStyle(dispActive,'rgba(34,197,94,0.13)','rgba(34,197,94,0.35)')}>
            <Zap className={`w-3 h-3 flex-shrink-0 ${dispActive ? 'text-green-400' : 'text-slate-400'}`} />
            <div className="flex-1 text-left"><p className={`text-[9px] font-bold leading-none ${dark ? 'text-white' : 'text-gray-900'}`}>Activo</p><p className="text-[8px] leading-none mt-0.5" style={{ color: dispActive ? '#4ade80' : '#94a3b8' }}>{dispActive ? 'En turno' : 'Libre'}</p></div>
            <div className="relative flex-shrink-0 rounded-full" style={toggleStyle(dispActive,'linear-gradient(90deg,#22c55e,#16a34a)','rgba(34,197,94,0.45)')}><div className="absolute rounded-full bg-white" style={knobLeft(dispActive)} /></div>
          </button>
          {/* Notas */}
          <button onClick={() => setNotesOpen(v => !v)} className="flex-1 flex items-center gap-1 px-1.5 py-2 rounded-xl select-none active:scale-[0.97] transition-all" style={swStyle(notesOpen,'rgba(251,191,36,0.13)','rgba(251,191,36,0.35)')}>
            <StickyNote className={`w-3 h-3 flex-shrink-0 ${notesOpen ? 'text-amber-400' : 'text-slate-400'}`} />
            <div className="flex-1 text-left"><p className={`text-[9px] font-bold leading-none ${dark ? 'text-white' : 'text-gray-900'}`}>Notas</p><p className="text-[8px] leading-none mt-0.5" style={{ color: notesOpen ? '#fbbf24' : '#94a3b8' }}>{notes.length > 0 ? `${notes.length} nota${notes.length !== 1 ? 's' : ''}` : 'Vacío'}</p></div>
            <div className="relative flex-shrink-0 rounded-full" style={toggleStyle(notesOpen,'linear-gradient(90deg,#f59e0b,#d97706)','rgba(251,191,36,0.45)')}><div className="absolute rounded-full bg-white" style={knobLeft(notesOpen)} /></div>
          </button>
          {/* Music */}
          <button onClick={() => setMusicOn(v => !v)} className="flex-1 flex items-center gap-1 px-1.5 py-2 rounded-xl select-none active:scale-[0.97] transition-all" style={swStyle(musicOn,'rgba(168,85,247,0.13)','rgba(168,85,247,0.35)')}>
            <Headphones className={`w-3 h-3 flex-shrink-0 ${musicOn ? 'text-purple-400' : 'text-slate-400'}`} />
            <div className="flex-1 text-left"><p className={`text-[9px] font-bold leading-none ${dark ? 'text-white' : 'text-gray-900'}`}>Music</p><p className="text-[8px] leading-none mt-0.5" style={{ color: musicOn ? '#c084fc' : '#94a3b8' }}>{musicOn ? '▶ Play' : 'Pop'}</p></div>
            <div className="relative flex-shrink-0 rounded-full" style={toggleStyle(musicOn,'linear-gradient(90deg,#a855f7,#7c3aed)','rgba(168,85,247,0.45)')}><div className="absolute rounded-full bg-white" style={knobLeft(musicOn)} /></div>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Search — hidden on small screens */}
        <div className="relative hidden lg:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders, drivers..."
            className="pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 w-52"
          />
        </div>

        {/* Refresh */}
        <button onClick={async () => { setLoading(true); await fetchNotifications(); setLoading(false); }}
          className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors hidden sm:block">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {dark
            ? <Sun className="w-4 h-4 text-yellow-400" />
            : <Moon className="w-4 h-4" />
          }
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-72 md:w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 slide-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm">Notifications</span>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotifs(false)}>
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-sm">No notifications</div>
                ) : notifications.map(n => (
                  <div key={n.id} className={`px-4 py-3 hover:bg-gray-50 ${!n.read ? 'bg-orange-50/30' : ''}`}>
                    <div className="flex items-start gap-3">
                      <span className={`badge mt-0.5 text-xs ${NOTIF_COLORS[n.type] || NOTIF_COLORS.system}`}>{n.type}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                          {!n.read && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
            <div className={`w-7 h-7 ${user?.role === 'admin' ? 'bg-purple-600' : 'bg-orange-500'} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 leading-none">{user?.name}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 capitalize mt-0.5">{user?.role}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 hidden md:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 slide-in py-1">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{user?.name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{user?.email}</p>
                <span className={`badge mt-1 capitalize ${user?.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'}`}>{user?.role}</span>
              </div>
              <button onClick={() => { setShowUserMenu(false); logout(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* MOBILE: switches + panels below header row */}
      {isDispatcher && (
        <div className="md:hidden border-t border-gray-100 dark:border-slate-800 px-3 py-2 space-y-2">
          <div className="flex gap-1.5">
            <button onClick={() => setDispActive(v => { const nv = !v; nv ? playShiftOnSound() : playShiftOffSound(); return nv; })} className="flex-1 flex items-center gap-1 px-1.5 py-2.5 rounded-xl select-none active:scale-[0.97] transition-all" style={swStyle(dispActive,'rgba(34,197,94,0.13)','rgba(34,197,94,0.35)')}>
              <Zap className={`w-3 h-3 flex-shrink-0 ${dispActive ? 'text-green-400' : 'text-slate-400'}`} />
              <div className="flex-1 text-left"><p className={`text-[9px] font-bold leading-none ${dark ? 'text-white' : 'text-gray-900'}`}>Activo</p><p className="text-[8px] leading-none mt-0.5" style={{ color: dispActive ? '#4ade80' : '#94a3b8' }}>{dispActive ? 'En turno' : 'Libre'}</p></div>
              <div className="relative flex-shrink-0 rounded-full" style={toggleStyle(dispActive,'linear-gradient(90deg,#22c55e,#16a34a)','rgba(34,197,94,0.45)')}><div className="absolute rounded-full bg-white" style={knobLeft(dispActive)} /></div>
            </button>
            <button onClick={() => setNotesOpen(v => !v)} className="flex-1 flex items-center gap-1 px-1.5 py-2.5 rounded-xl select-none active:scale-[0.97] transition-all" style={swStyle(notesOpen,'rgba(251,191,36,0.13)','rgba(251,191,36,0.35)')}>
              <StickyNote className={`w-3 h-3 flex-shrink-0 ${notesOpen ? 'text-amber-400' : 'text-slate-400'}`} />
              <div className="flex-1 text-left"><p className={`text-[9px] font-bold leading-none ${dark ? 'text-white' : 'text-gray-900'}`}>Notas</p><p className="text-[8px] leading-none mt-0.5" style={{ color: notesOpen ? '#fbbf24' : '#94a3b8' }}>{notes.length > 0 ? `${notes.length} nota${notes.length !== 1 ? 's' : ''}` : 'Vacío'}</p></div>
              <div className="relative flex-shrink-0 rounded-full" style={toggleStyle(notesOpen,'linear-gradient(90deg,#f59e0b,#d97706)','rgba(251,191,36,0.45)')}><div className="absolute rounded-full bg-white" style={knobLeft(notesOpen)} /></div>
            </button>
            <button onClick={() => setMusicOn(v => !v)} className="flex-1 flex items-center gap-1 px-1.5 py-2.5 rounded-xl select-none active:scale-[0.97] transition-all" style={swStyle(musicOn,'rgba(168,85,247,0.13)','rgba(168,85,247,0.35)')}>
              <Headphones className={`w-3 h-3 flex-shrink-0 ${musicOn ? 'text-purple-400' : 'text-slate-400'}`} />
              <div className="flex-1 text-left"><p className={`text-[9px] font-bold leading-none ${dark ? 'text-white' : 'text-gray-900'}`}>Music</p><p className="text-[8px] leading-none mt-0.5" style={{ color: musicOn ? '#c084fc' : '#94a3b8' }}>{musicOn ? '▶ Play' : 'Pop'}</p></div>
              <div className="relative flex-shrink-0 rounded-full" style={toggleStyle(musicOn,'linear-gradient(90deg,#a855f7,#7c3aed)','rgba(168,85,247,0.45)')}><div className="absolute rounded-full bg-white" style={knobLeft(musicOn)} /></div>
            </button>
          </div>
          {SwitchPanels()}
        </div>
      )}

      {/* DESKTOP: panels (Spotify + Notes) below header when active */}
      {isDispatcher && (musicOn || notesOpen) && (
        <div className="hidden md:block border-t border-gray-100 dark:border-slate-800 px-6 py-2 space-y-2">
          {SwitchPanels()}
        </div>
      )}
    </header>
  );
}

