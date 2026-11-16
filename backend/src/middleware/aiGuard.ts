import { Request, Response, NextFunction } from 'express';

// Limites para TODAS las rutas que gastan la clave de IA (Sofia del sitio, Maya del registro, Rachel/Valeria de las apps).
// En memoria (una instancia): es una primera barrera. El tope DURO real es el limite de gasto mensual de la cuenta de Anthropic.
// Tres niveles: por ventana corta (por persona), por dia (por persona) y global por dia (para todo el endpoint).

export interface AiRule {
  name: string;
  windowMs: number;
  maxPerWindow: number;
  maxPerDay: number;
  globalPerDay: number;
  /** clave de la persona: por defecto, la IP real; en rutas con sesion, el usuario */
  keyOf?: (req: Request) => string;
  /** mensaje amable que ve el usuario al llegar al limite */
  busyReply?: string;
}

const windows = new Map<string, number[]>();
const days = new Map<string, { day: string; n: number }>();
const globals = new Map<string, { day: string; n: number }>();
const today = () => new Date().toISOString().slice(0, 10);

// IP real detras del proxy de Render/Cloudflare; no se fia de la primera entrada de X-Forwarded-For (la puede inventar el cliente).
export function clientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf) return cf.trim();
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real) return real.trim();
  const xff = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff.length ? xff[xff.length - 1] : req.ip || 'unknown';
}

function bump(map: Map<string, { day: string; n: number }>, key: string): void {
  const d = today();
  const cur = map.get(key);
  map.set(key, cur && cur.day === d ? { day: d, n: cur.n + 1 } : { day: d, n: 1 });
}

export function aiGuard(rule: AiRule) {
  const busy = rule.busyReply ?? 'Hay muchas consultas en este momento. Intenta de nuevo en unos minutos, o escríbenos a admin@osilogistics.com / llama al +1 (305) 335-8114.';
  return (req: Request, res: Response, next: NextFunction) => {
    const who = `${rule.name}|${rule.keyOf ? rule.keyOf(req) : clientIp(req)}`;
    const now = Date.now();
    const recent = (windows.get(who) ?? []).filter((t) => now - t < rule.windowMs);

    const gKey = `${rule.name}|*`;
    const g = globals.get(gKey);
    const gToday = g && g.day === today() ? g.n : 0;
    const p = days.get(who);
    const pToday = p && p.day === today() ? p.n : 0;

    if (recent.length >= rule.maxPerWindow || pToday >= rule.maxPerDay || gToday >= rule.globalPerDay) {
      res.setHeader('Retry-After', '300');
      return res.status(429).json({ error: 'rate_limited', reply: busy });
    }
    recent.push(now);
    windows.set(who, recent);
    bump(days, who);
    bump(globals, gKey);
    // limpieza ocasional para que los mapas no crezcan sin fin
    if (windows.size > 5000) {
      for (const [k, v] of windows) if (!v.some((t) => now - t < rule.windowMs)) windows.delete(k);
    }
    if (days.size > 20000) {
      const d = today();
      for (const [k, v] of days) if (v.day !== d) days.delete(k);
    }
    next();
  };
}

/** Recorta y limpia el historial que manda el navegador: maximo `keep` mensajes, cada uno limitado, empezando por "user". */
export function cleanHistory(history: unknown, keep = 6, maxChars = 600): Array<{ role: 'user' | 'assistant'; content: string }> {
  const arr = (Array.isArray(history) ? history : [])
    .filter((m): m is { role: 'user' | 'assistant'; content: string } => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-keep)
    .map((m) => ({ role: m.role, content: m.content.slice(0, maxChars) }));
  while (arr.length && arr[0].role !== 'user') arr.shift();
  return arr;
}
