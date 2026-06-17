import { Router, Request, Response } from 'express';
import { scryptSync, randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { exec, query, queryOne } from '../database';
import { requireRole } from '../middleware/auth';

const router = Router();
router.use(requireRole('admin'));

router.get('/users', async (_req: Request, res: Response) => {
  try {
    res.json(await query(`
      SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
             d.name as driver_name, d.status as driver_status, d.avatar as driver_avatar
      FROM users u
      LEFT JOIN drivers d ON u.driver_id = d.id
      ORDER BY u.created_at DESC
    `));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/users', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, driver_id = null } = req.body;
    if (!name || !email || !password || !role)
      return res.status(400).json({ error: 'Name, email, password and role are required' });

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    const id = uuidv4();

    await exec('INSERT INTO users (id, name, email, password_hash, salt, role, driver_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, email.toLowerCase(), hash, salt, role, driver_id]);

    res.status(201).json(await queryOne('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?', [id]));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/users/:id', async (req: Request, res: Response) => {
  try {
    const { name, email, role, active, password } = req.body;
    const user = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (role && role !== 'admin' && user.role === 'admin') {
      const cnt = await queryOne<{c:number}>("SELECT COUNT(*) as c FROM users WHERE role='admin' AND active=1");
      if ((cnt?.c ?? 0) <= 1) return res.status(400).json({ error: 'Cannot change role of the last admin' });
    }

    const updates: Record<string, unknown> = {};
    if (name     !== undefined) updates.name     = name;
    if (email    !== undefined) updates.email    = email.toLowerCase();
    if (role     !== undefined) updates.role     = role;
    if (active   !== undefined) updates.active   = active ? 1 : 0;
    if (password) {
      const salt = randomBytes(16).toString('hex');
      updates.password_hash = scryptSync(password, salt, 64).toString('hex');
      updates.salt = salt;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });

    const fields = Object.keys(updates).map(f => `${f} = ?`).join(', ');
    await exec(`UPDATE users SET ${fields} WHERE id = ?`, [...Object.values(updates), req.params.id]);
    res.json(await queryOne('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?', [req.params.id]));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const user = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.role === 'admin') {
      const cnt = await queryOne<{c:number}>("SELECT COUNT(*) as c FROM users WHERE role='admin' AND active=1");
      if ((cnt?.c ?? 0) <= 1) return res.status(400).json({ error: 'Cannot delete the last admin account' });
    }

    await exec('DELETE FROM sessions WHERE user_id = ?', [req.params.id]);
    await exec('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/pending', async (_req: Request, res: Response) => {
  try {
    res.json(await query(`
      SELECT u.id, u.name, u.email, u.role, u.phone, u.created_at, u.city,
             u.years_experience, u.equipment_experience, u.languages, u.availability,
             d.name as driver_name, d.license_number, d.equipment_type
      FROM users u
      LEFT JOIN drivers d ON u.driver_id = d.id
      WHERE u.approval_status = 'pending'
      ORDER BY u.created_at ASC
    `));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/users/:id/approve', async (req: Request, res: Response) => {
  try {
    const user = await queryOne<Record<string, unknown>>('SELECT id, name, role FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await exec("UPDATE users SET active = 1, approval_status = 'approved' WHERE id = ?", [req.params.id]);
    await exec("INSERT INTO notifications (id, type, title, message, read) VALUES (?, 'system', 'Cuenta Aprobada', ?, 0)",
      [uuidv4(), `La cuenta de ${user.name} (${user.role}) fue aprobada y está activa.`]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/users/:id/reject', async (req: Request, res: Response) => {
  try {
    const user = await queryOne<Record<string, unknown>>('SELECT id, name FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await exec("UPDATE users SET active = 0, approval_status = 'rejected' WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/dispatchers', async (_req: Request, res: Response) => {
  try {
    res.json(await query(`
      SELECT u.id, u.name, u.email, u.phone, u.ssn, u.active, u.created_at,
             u.equipment_experience, u.dispatcher_code,
             u.shift_active, u.shift_changed_at,
             u.date_of_birth, u.city, u.years_experience, u.availability,
             u.previous_companies, u.languages,
             COUNT(DISTINCT c.order_id)                                                        AS total_orders,
             COALESCE(SUM(c.dispatcher_pay), 0)                                                AS total_earned,
             COALESCE(SUM(CASE WHEN c.status='pending' THEN c.dispatcher_pay ELSE 0 END), 0)  AS pending,
             COALESCE(SUM(CASE WHEN c.status='settled' THEN c.dispatcher_pay ELSE 0 END), 0)  AS settled,
             COUNT(DISTINCT CASE WHEN o.status IN ('assigned','picked_up','in_transit') THEN o.id END) AS active_orders
      FROM users u
      LEFT JOIN commissions c ON u.id = c.dispatcher_user_id
      LEFT JOIN orders o ON u.id = o.dispatcher_user_id
      WHERE u.role = 'dispatcher'
      GROUP BY u.id
      ORDER BY total_earned DESC
    `));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/dispatchers/:id', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, ssn, active, password } = req.body;
    const user = await queryOne("SELECT id FROM users WHERE id = ? AND role='dispatcher'", [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Dispatcher not found' });

    const updates: Record<string, unknown> = {};
    if (name   !== undefined) updates.name   = name;
    if (email  !== undefined) updates.email  = email.toLowerCase();
    if (phone  !== undefined) updates.phone  = phone;
    if (ssn    !== undefined) updates.ssn    = ssn;
    if (active !== undefined) updates.active = active ? 1 : 0;
    if (password) {
      const salt = randomBytes(16).toString('hex');
      updates.password_hash = scryptSync(password, salt, 64).toString('hex');
      updates.salt = salt;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });

    const fields = Object.keys(updates).map(f => `${f} = ?`).join(', ');
    await exec(`UPDATE users SET ${fields} WHERE id = ?`, [...Object.values(updates), req.params.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Verifications ────────────────────────────────────────────────────────────

const DRIVER_CHECKS = [
  { name: 'identity',           label: 'Verificación de Identidad' },
  { name: 'license',            label: 'Licencia de Conducir' },
  { name: 'mvr',                label: 'MVR – Historial de Manejo' },
  { name: 'insurance',          label: 'Seguro / COI' },
  { name: 'criminal_background',label: 'Background Criminal' },
  { name: 'drug_test',          label: 'Prueba de Drogas' },
  { name: 'equipment',          label: 'Verificación de Equipo' },
];

const DISPATCHER_CHECKS = [
  { name: 'identity',           label: 'Verificación de Identidad' },
  { name: 'background',         label: 'Background Check' },
  { name: 'employment_history', label: 'Historial Laboral' },
  { name: 'references',         label: 'Referencias' },
  { name: 'experience',         label: 'Verificación de Experiencia' },
];

async function ensureVerifications(entityType: string, entityId: string): Promise<void> {
  const checks = entityType === 'driver' ? DRIVER_CHECKS : DISPATCHER_CHECKS;
  for (const c of checks) {
    const existing = await queryOne(
      'SELECT id FROM verifications WHERE entity_type = ? AND entity_id = ? AND check_name = ?',
      [entityType, entityId, c.name]
    );
    if (!existing) {
      await exec(
        'INSERT INTO verifications (id, entity_type, entity_id, check_name) VALUES (?, ?, ?, ?)',
        [uuidv4(), entityType, entityId, c.name]
      );
    }
  }
}

router.get('/verifications', async (_req: Request, res: Response) => {
  try {
    // Drivers with accounts
    const drivers = await query<Record<string, unknown>>(`
      SELECT d.id, d.name, d.email, d.phone, d.license_number, d.license_expiry,
             d.equipment_type, d.company_name, d.mc_number, d.coi_filename,
             d.coi_expiry, d.hire_date, d.avatar, d.driver_code
      FROM drivers d
      INNER JOIN users u ON u.driver_id = d.id AND u.active = 1
      ORDER BY d.name ASC
    `);
    for (const d of drivers) await ensureVerifications('driver', d.id as string);

    // Dispatchers
    const dispatchers = await query<Record<string, unknown>>(`
      SELECT u.id, u.name, u.email, u.phone, u.city, u.years_experience,
             u.previous_companies, u.languages, u.availability,
             u.equipment_experience, u.date_of_birth, u.dispatcher_code
      FROM users u
      WHERE u.role = 'dispatcher' AND u.active = 1
      ORDER BY u.name ASC
    `);
    for (const d of dispatchers) await ensureVerifications('dispatcher', d.id as string);

    const allChecks = await query(`
      SELECT * FROM verifications ORDER BY entity_type, entity_id, check_name
    `);

    res.json({ drivers, dispatchers, checks: allChecks });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/verifications/:entityType/:entityId/:checkName', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId, checkName } = req.params;
    const { status, notes, checked_by } = req.body;

    const token = req.headers.authorization?.replace('Bearer ', '');
    let adminName = checked_by || 'Admin';
    if (token) {
      const session = await queryOne<{ name: string }>(`
        SELECT u.name FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
      `, [token]);
      if (session) adminName = session.name;
    }

    await exec(`
      UPDATE verifications
      SET status = ?, notes = ?, checked_by = ?, checked_at = datetime('now')
      WHERE entity_type = ? AND entity_id = ? AND check_name = ?
    `, [status, notes ?? '', adminName, entityType, entityId, checkName]);

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [total_users, admins, dispatchers, drivers_with_account, active_sessions, recent_logins] = await Promise.all([
      queryOne<{c:number}>('SELECT COUNT(*) as c FROM users'),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM users WHERE role='admin' AND active=1"),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM users WHERE role='dispatcher' AND active=1"),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM users WHERE role='driver' AND active=1"),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM sessions WHERE expires_at > datetime('now')"),
      query(`SELECT u.name, u.email, u.role, s.created_at FROM sessions s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 5`),
    ]);
    res.json({
      total_users:          total_users?.c          ?? 0,
      admins:               admins?.c               ?? 0,
      dispatchers:          dispatchers?.c           ?? 0,
      drivers_with_account: drivers_with_account?.c ?? 0,
      active_sessions:      active_sessions?.c       ?? 0,
      recent_logins,
    });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
