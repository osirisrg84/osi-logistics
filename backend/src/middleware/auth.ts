import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../database';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  driver_id: string | null;
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
  const session = await queryOne<AuthUser & { active: number }>(`
    SELECT s.user_id, u.id, u.name, u.email, u.phone, u.role, u.driver_id, u.active
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `, [token]);
  if (!session || !session.active) return null;
  return { id: session.id as string, name: session.name as string, email: session.email as string, phone: (session.phone as string) || '', role: session.role as string, driver_id: session.driver_id as string | null };
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }

  try {
    const user = await resolveSessionUser(token);
    if (!user) { res.status(401).json({ error: 'Invalid or expired session' }); return; }
    req.user = user;
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
