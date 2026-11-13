import { Request, Response, NextFunction } from 'express';
import { exec, queryOne } from '../database';

// Sesion de 30 dias que se RENUEVA mientras se usa. Antes eran 7 dias fijos desde el login: el admin se deslogueaba solo
// cada semana aunque usara la app a diario.
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  driver_id: string | null;
  shift_active: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Compartido con el middleware de Socket.io en index.ts -- antes el handshake
// de socket.io no verificaba nada en absoluto, asi que cualquiera podia
// conectarse y unirse a la sala de CUALQUIER driver (driver:subscribe) sin
// ninguna sesion valida.
export async function resolveSessionUser(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const session = await queryOne<Omit<AuthUser, 'shift_active'> & { active: number; shift_active: number }>(`
    SELECT s.user_id, u.id, u.name, u.email, u.phone, u.role, u.driver_id, u.active, u.shift_active
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `, [token]);
  if (!session || !session.active) return null;
  return {
    id: session.id as string, name: session.name as string, email: session.email as string,
    phone: (session.phone as string) || '', role: session.role as string, driver_id: session.driver_id as string | null,
    shift_active: !!session.shift_active,
  };
}

// Writing last_activity_at on literally every authenticated request (the
// driver portal alone fires half a dozen in parallel on open) hammered
// SQLite with concurrent UPDATEs and caused real intermittent failures
// elsewhere (confirmed live 2026-11-01: drivers getting logged out, because
// DriverAuthContext treats ANY /auth/me failure -- including an unrelated
// transient DB lock -- as an invalid session). The 2-day idle-shift check
// only needs this timestamp to land at least once within any 2-day window,
// not on every request, so throttle it in-memory per user instead of
// writing every single time.
const lastActivityWrite = new Map<string, number>();
const ACTIVITY_WRITE_THROTTLE_MS = 5 * 60 * 1000; // once per 5 min per user is plenty

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }

  try {
    const user = await resolveSessionUser(token);
    if (!user) { res.status(401).json({ error: 'Invalid or expired session' }); return; }
    req.user = user;
    const now = Date.now();
    const last = lastActivityWrite.get(user.id) ?? 0;
    if (now - last > ACTIVITY_WRITE_THROTTLE_MS) {
      lastActivityWrite.set(user.id, now);
      // Fire-and-forget -- a slow/failed write here must never block the
      // actual request.
      exec("UPDATE users SET last_activity_at = datetime('now') WHERE id = ?", [user.id]).catch(() => {});
      // Sesion deslizante: cada vez que se usa (como maximo cada 5 min) se vuelve a dar el plazo completo.
      exec('UPDATE sessions SET expires_at = ? WHERE token = ?', [new Date(now + SESSION_TTL_MS).toISOString(), token]).catch(() => {});
    }
    next();
  } catch {
    res.status(500).json({ error: 'Auth error' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
