import { Router, Request, Response } from 'express';
import { scryptSync, randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { requireRole } from '../middleware/auth';

const router = Router();

// All admin routes require admin role
router.use(requireRole('admin'));

router.get('/users', (_req: Request, res: Response) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
           d.name as driver_name, d.status as driver_status, d.avatar as driver_avatar
    FROM users u
    LEFT JOIN drivers d ON u.driver_id = d.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

router.post('/users', (req: Request, res: Response) => {
  const db = getDb();
  const { name, email, password, role, driver_id = null } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password and role are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  const id = uuidv4();

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, salt, role, driver_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, email.toLowerCase(), hash, salt, role, driver_id);

  const user = db.prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?').get(id);
  res.status(201).json(user);
});

router.put('/users/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { name, email, role, active, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Prevent removing the last admin
  if (role && role !== 'admin' && user.role === 'admin') {
    const adminCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1").get() as { c: number }).c;
    if (adminCount <= 1) return res.status(400).json({ error: 'Cannot change role of the last admin' });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email.toLowerCase();
  if (role !== undefined) updates.role = role;
  if (active !== undefined) updates.active = active ? 1 : 0;
  if (password) {
    const salt = randomBytes(16).toString('hex');
    updates.password_hash = scryptSync(password, salt, 64).toString('hex');
    updates.salt = salt;
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const fields = Object.keys(updates).map(f => `${f} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run(...Object.values(updates), req.params.id);

  const updated = db.prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/users/:id', (req: Request, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role === 'admin') {
    const adminCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1").get() as { c: number }).c;
    if (adminCount <= 1) return res.status(400).json({ error: 'Cannot delete the last admin account' });
  }

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/dispatchers', (_req: Request, res: Response) => {
  const db = getDb();
  const dispatchers = db.prepare(`
    SELECT u.id, u.name, u.email, u.active, u.created_at,
           COUNT(DISTINCT c.order_id)                                                        AS total_orders,
           COALESCE(SUM(c.dispatcher_pay), 0)                                                AS total_earned,
           COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.dispatcher_pay ELSE 0 END), 0) AS pending,
           COALESCE(SUM(CASE WHEN c.status = 'settled' THEN c.dispatcher_pay ELSE 0 END), 0) AS settled,
           COUNT(DISTINCT CASE WHEN o.status IN ('assigned','picked_up','in_transit') THEN o.id END) AS active_orders
    FROM users u
    LEFT JOIN commissions c ON u.id = c.dispatcher_user_id
    LEFT JOIN orders o ON u.id = o.dispatcher_user_id
    WHERE u.role = 'dispatcher'
    GROUP BY u.id
    ORDER BY total_earned DESC
  `).all();
  res.json(dispatchers);
});

router.get('/stats', (_req: Request, res: Response) => {
  const db = getDb();
  const stats = {
    total_users: (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c,
    admins: (db.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin' AND active=1").get() as { c: number }).c,
    dispatchers: (db.prepare("SELECT COUNT(*) as c FROM users WHERE role='dispatcher' AND active=1").get() as { c: number }).c,
    drivers_with_account: (db.prepare("SELECT COUNT(*) as c FROM users WHERE role='driver' AND active=1").get() as { c: number }).c,
    active_sessions: (db.prepare("SELECT COUNT(*) as c FROM sessions WHERE expires_at > datetime('now')").get() as { c: number }).c,
    recent_logins: db.prepare(`
      SELECT u.name, u.email, u.role, s.created_at
      FROM sessions s JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC LIMIT 5
    `).all(),
  };
  res.json(stats);
});

export default router;
