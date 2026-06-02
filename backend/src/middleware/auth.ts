import { Request, Response, NextFunction } from 'express';
import { getDb } from '../database';

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

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const db = getDb();
  const session = db.prepare(`
    SELECT s.user_id, u.id, u.name, u.email, u.role, u.driver_id, u.active
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token) as (AuthUser & { active: number }) | undefined;

  if (!session || !session.active) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.user = {
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
    driver_id: session.driver_id,
  };

  next();
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
