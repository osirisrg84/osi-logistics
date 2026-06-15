import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../database';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
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

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }

  try {
    const session = await queryOne<AuthUser & { active: number }>(`
      SELECT s.user_id, u.id, u.name, u.email, u.role, u.driver_id, u.active
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `, [token]);

    if (!session || !session.active) { res.status(401).json({ error: 'Invalid or expired session' }); return; }

    req.user = { id: session.id as string, name: session.name as string, email: session.email as string, role: session.role as string, driver_id: session.driver_id as string | null };
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
