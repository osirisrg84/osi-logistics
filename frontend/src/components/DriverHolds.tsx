import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer, Hand, Plus, X, Phone } from 'lucide-react';
import { driversApi } from '../services/api';
import { getSocket } from '../services/socket';

// HOLD de drivers: un dispatcher reserva a un driver disponible mientras le trabaja una carga (20 min, ampliable +10 / +20).
// Mientras dura, los demas dispatchers lo ven reservado (con su cuenta regresiva) y no pueden ofrecerle cargas.
// Al vencer, o si el driver deja de estar disponible, se libera solo.

export interface HoldInfo { by: string | null; by_name: string | null; started_at: string | null; expires_at: string; mine: boolean }
export interface MyHold { driver_id: string; name: string; phone: string; equipment_type: string | null; status: string; hold: HoldInfo }

const msLeft = (iso: string, now: number) => Math.max(0, new Date(iso).getTime() - now);
export function fmtCountdown(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Reloj de 1 segundo (compartido por quien lo use). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return now;
}

/** Escucha los cambios de hold en vivo (socket) y llama a `onChange`. */
export function useHoldEvents(onChange: () => void) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const socket = getSocket();
    socket.emit('subscribe_dispatchers');
    const handler = () => cb.current();
    socket.on('driver_hold_changed', handler);
    return () => { socket.off('driver_hold_changed', handler); };
  }, []);
}

/** Mis holds activos para el Dashboard. */
export function useMyHolds() {
  const [holds, setHolds] = useState<MyHold[]>([]);
  const load = useCallback(() => {
    driversApi.myHolds().then(({ data }) => setHolds(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const poll = setInterval(load, 20_000); // respaldo por si falla el tiempo real
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(poll); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);
  useHoldEvents(load);
  return { holds, reload: load };
}

type ErrData = { error?: string; by_name?: string };
function holdErrorKey(e: unknown): { key: string; by?: string } {
  const d = (e as { response?: { data?: ErrData } })?.response?.data;
  switch (d?.error) {
    case 'held_by_other': return { key: 'holds.errHeldByOther', by: d.by_name };
    case 'not_available': return { key: 'holds.errNotAvailable' };
    case 'must_go_on_shift': return { key: 'holds.errShift' };
    case 'no_active_hold': return { key: 'holds.errExpired' };
    default: return { key: 'holds.errGeneric' };
  }
}

/** Acciones: reservar / ampliar / liberar (devuelve mensajes ya traducidos para un aviso). */
export function useHoldActions(onDone: () => void, notify: (msg: string) => void) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (id: string, fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(id);
    try { await fn(); if (okMsg) notify(okMsg); }
    catch (e) { const k = holdErrorKey(e); notify(t(k.key, { name: k.by })); }
    finally { setBusy(null); onDone(); }
  };
  return {
    busy,
    hold: (id: string) => run(id, () => driversApi.hold(id), t('holds.started')),
    extend: (id: string, minutes: 10 | 20) => run(id, async () => {
      const { data } = await driversApi.extendHold(id, minutes);
      if (data?.capped) notify(t('holds.capped'));
    }),
    release: (id: string) => run(id, () => driversApi.releaseHold(id), t('holds.released')),
  };
}

/** Tarjeta del Dashboard: mis drivers en hold con su cuenta regresiva. Solo aparece si hay alguno. */
export function HoldsPanel() {
  const { t } = useTranslation();
  const { holds, reload } = useMyHolds();
  const now = useNow();
  const [msg, setMsg] = useState<string | null>(null);
  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };
  const act = useHoldActions(reload, notify);

  // al vencer una cuenta regresiva, se vuelve a pedir la lista (el servidor ya lo libero)
  const expiredKey = holds.filter((h) => msLeft(h.hold.expires_at, now) === 0).map((h) => h.driver_id).join(',');
  useEffect(() => { if (expiredKey) { const id = setTimeout(reload, 1500); return () => clearTimeout(id); } }, [expiredKey, reload]);

  const live = holds.filter((h) => msLeft(h.hold.expires_at, now) > 0);
  if (live.length === 0 && !msg) return null;

  return (
    <div className="rounded-2xl border border-amber-300/60 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center"><Hand className="w-4 h-4 text-amber-600 dark:text-amber-400" /></div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">{t('holds.panelTitle', { count: live.length })}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{t('holds.panelHint')}</p>
        </div>
      </div>
      {msg && <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-300">{msg}</p>}
      <div className="space-y-2">
        {live.map((h) => {
          const left = msLeft(h.hold.expires_at, now);
          const started = h.hold.started_at ? new Date(h.hold.started_at).getTime() : now - 20 * 60_000;
          const total = Math.max(new Date(h.hold.expires_at).getTime() - started, 60_000);
          const pct = Math.min(100, Math.max(0, (left / total) * 100));
          const urgent = left < 2 * 60_000, warn = left < 5 * 60_000;
          const tone = urgent ? 'text-red-600 dark:text-red-400' : warn ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
          const bar = urgent ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-emerald-500';
          return (
            <div key={h.driver_id} className="rounded-xl bg-white/80 dark:bg-slate-800/70 border border-amber-200/70 dark:border-white/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{h.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                    {h.equipment_type && <span>{h.equipment_type}</span>}
                    <span className="inline-flex items-center gap-0.5"><Phone className="w-3 h-3" />{h.phone}</span>
                  </p>
                </div>
                <div className={`flex items-center gap-1 font-mono text-xl font-extrabold tabular-nums ${tone} ${urgent ? 'animate-pulse' : ''}`} aria-label={t('holds.timeLeft')}>
                  <Timer className="w-4 h-4" />{fmtCountdown(left)}
                </div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div className={`h-full ${bar} transition-all duration-1000`} style={{ width: `${pct}%` }} /></div>
              <div className="mt-2.5 flex items-center gap-2">
                <button disabled={act.busy === h.driver_id} onClick={() => act.extend(h.driver_id, 10)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 active:scale-95 transition disabled:opacity-50"><Plus className="w-3 h-3" />10 min</button>
                <button disabled={act.busy === h.driver_id} onClick={() => act.extend(h.driver_id, 20)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 active:scale-95 transition disabled:opacity-50"><Plus className="w-3 h-3" />20 min</button>
                <button disabled={act.busy === h.driver_id} onClick={() => act.release(h.driver_id)} className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300/80 active:scale-95 transition disabled:opacity-50"><X className="w-3 h-3" />{t('holds.release')}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Controles dentro de la tarjeta de cada driver (lista de Drivers). */
export function DriverHoldControls({ driverId, driverStatus, hold, onChanged, notify }: { driverId: string; driverStatus: string; hold?: HoldInfo | null; onChanged: () => void; notify: (m: string) => void }) {
  const { t } = useTranslation();
  const now = useNow();
  const act = useHoldActions(onChanged, notify);
  const left = hold ? msLeft(hold.expires_at, now) : 0;
  // al llegar a 0 se refresca la lista para que el driver vuelva a aparecer disponible
  const expired = !!hold && left === 0;
  useEffect(() => { if (expired) { const id = setTimeout(onChanged, 1500); return () => clearTimeout(id); } }, [expired, onChanged]);

  if (hold && left > 0) {
    if (hold.mine) {
      return (
        <div className="mt-3 rounded-lg border border-amber-300/70 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1"><Hand className="w-3.5 h-3.5" />{t('holds.yourHold')}</span>
            <span className={`font-mono text-sm font-extrabold tabular-nums ${left < 2 * 60_000 ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-amber-700 dark:text-amber-300'}`}>{fmtCountdown(left)}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <button disabled={act.busy === driverId} onClick={() => act.extend(driverId, 10)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 active:scale-95 disabled:opacity-50">+10</button>
            <button disabled={act.busy === driverId} onClick={() => act.extend(driverId, 20)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 active:scale-95 disabled:opacity-50">+20</button>
            <button disabled={act.busy === driverId} onClick={() => act.release(driverId)} className="ml-auto px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 active:scale-95 disabled:opacity-50">{t('holds.release')}</button>
          </div>
        </div>
      );
    }
    return (
      <div className="mt-3 rounded-lg border border-slate-300/60 dark:border-white/10 bg-slate-100/70 dark:bg-slate-800/60 p-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1"><Hand className="w-3.5 h-3.5 text-slate-400" />{t('holds.heldBy', { name: hold.by_name || '—' })}</span>
        <span className="font-mono text-sm font-bold tabular-nums text-slate-600 dark:text-slate-300">{fmtCountdown(left)}</span>
      </div>
    );
  }
  if (driverStatus !== 'available') return null;
  return (
    <button disabled={act.busy === driverId} onClick={() => act.hold(driverId)} className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/40 hover:bg-amber-500/25 active:scale-[0.98] transition disabled:opacity-50">
      <Hand className="w-3.5 h-3.5" />{t('holds.holdBtn')}
    </button>
  );
}
