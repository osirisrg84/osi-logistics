import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { exec, query, queryOne } from '../database';
import { appEvents } from '../events';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    let sql = `
      SELECT d.*,
             t.plate_number, t.make, t.model, t.type as truck_type,
             (SELECT COUNT(*) FROM orders WHERE driver_id = d.id AND status IN ('assigned','picked_up','in_transit')) as active_orders
      FROM drivers d
      LEFT JOIN trucks t ON d.truck_id = t.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (status) { sql += ' AND d.status = ?'; params.push(status); }
    if (search) {
      sql += ' AND (d.name LIKE ? OR d.phone LIKE ? OR d.license_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY d.name ASC';
    res.json(await query(sql, params));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [total, available, busy, on_break, offline, avg, top] = await Promise.all([
      queryOne<{c:number}>('SELECT COUNT(*) as c FROM drivers'),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM drivers WHERE status = 'available'"),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM drivers WHERE status = 'busy'"),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM drivers WHERE status = 'on_break'"),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM drivers WHERE status = 'offline'"),
      queryOne<{avg:number}>('SELECT AVG(rating) as avg FROM drivers'),
      queryOne('SELECT name, total_deliveries, rating FROM drivers ORDER BY total_deliveries DESC LIMIT 1'),
    ]);
    res.json({
      total: total?.c ?? 0, available: available?.c ?? 0, busy: busy?.c ?? 0,
      on_break: on_break?.c ?? 0, offline: offline?.c ?? 0,
      avg_rating: avg?.avg ?? 0, top_driver: top,
    });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const driver = await queryOne(`
      SELECT d.*, t.plate_number, t.make, t.model, t.type as truck_type, t.fuel_level,
             u.payout_method, u.payout_details
      FROM drivers d
      LEFT JOIN trucks t ON d.truck_id = t.id
      LEFT JOIN users u ON u.driver_id = d.id
      WHERE d.id = ?
    `, [req.params.id]);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const [recentOrders, trackingHistory] = await Promise.all([
      query('SELECT id, order_number, customer_name, status, delivery_address, created_at, delivered_at FROM orders WHERE driver_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]),
      query('SELECT * FROM tracking WHERE driver_id = ? ORDER BY timestamp DESC LIMIT 20', [req.params.id]),
    ]);
    res.json({ driver, recentOrders, trackingHistory });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const id = uuidv4();
    const {
      name, phone, email, license_number, license_expiry,
      hire_date, current_lat = 25.7617, current_lng = -80.1918,
      current_address = 'Miami, FL', equipment_type = 'Dry Van',
      company_name = 'OSI Logistics LLC', mc_number = '', authority_since = '',
    } = req.body;
    const initials = name.split(' ').map((n: string) => n[0]).join('');
    const code = String(Math.floor(10000000 + Math.random() * 90000000));

    await exec(`INSERT INTO drivers (id, name, phone, email, license_number, license_expiry,
      status, current_lat, current_lng, current_address, avatar, hire_date,
      equipment_type, company_name, mc_number, authority_since, driver_code)
      VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, phone, email, license_number, license_expiry,
       current_lat, current_lng, current_address, initials, hire_date,
       equipment_type, company_name, mc_number, authority_since, code]);

    await exec("INSERT INTO notifications (id, type, title, message, read, related_id) VALUES (?, 'driver', 'New Driver Added', ?, 0, ?)",
      [uuidv4(), `${name} has been added to the driver roster.`, id]);

    res.status(201).json(await queryOne('SELECT * FROM drivers WHERE id = ?', [id]));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const driver = await queryOne('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const updates = req.body;
    const fields = Object.keys(updates).filter(k => !['id', 'created_at'].includes(k));
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    await exec(`UPDATE drivers SET ${setClause} WHERE id = ?`,
      [...fields.map(f => updates[f] ?? null), req.params.id]);

    const updated = await queryOne<Record<string, unknown>>('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
    if (updates.status && updated) {
      appEvents.emit('driver:status_changed', {
        id: req.params.id, name: updated.name, status: updated.status,
        lat: updated.current_lat, lng: updated.current_lng, avatar: updated.avatar,
      });
    }
    res.json(updated);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/location', async (req: Request, res: Response) => {
  try {
    const { lat, lng, speed = 0, heading = 0, address = '' } = req.body;
    await exec('UPDATE drivers SET current_lat = ?, current_lng = ?, current_address = ? WHERE id = ?',
      [lat, lng, address, req.params.id]);
    const driver = await queryOne<Record<string, unknown>>('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    await exec('INSERT INTO tracking (id, driver_id, order_id, lat, lng, speed, heading) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.params.id, (driver.current_order_id as string) || null, lat, lng, speed, heading]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const driver = await queryOne('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    const active = await queryOne<{c:number}>(`SELECT COUNT(*) as c FROM orders WHERE driver_id = ? AND status NOT IN ('delivered','cancelled')`, [req.params.id]);
    if ((active?.c ?? 0) > 0) return res.status(400).json({ error: 'Cannot delete driver with active orders' });
    await exec('DELETE FROM tracking WHERE driver_id = ?', [req.params.id]);
    await exec('DELETE FROM drivers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/:id/favorites', async (req: Request, res: Response) => {
  try {
    res.json(await query('SELECT * FROM driver_favorites WHERE driver_id = ? ORDER BY created_at ASC', [req.params.id]));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/favorites', async (req: Request, res: Response) => {
  try {
    const { name, address, type = 'other' } = req.body;
    if (!name || !address) return res.status(400).json({ error: 'name and address required' });
    const count = await queryOne<{c:number}>('SELECT COUNT(*) as c FROM driver_favorites WHERE driver_id = ?', [req.params.id]);
    if ((count?.c ?? 0) >= 5) return res.status(400).json({ error: 'Maximum 5 favorites per driver' });
    const id = uuidv4();
    await exec('INSERT INTO driver_favorites (id, driver_id, name, address, type) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.id, name, address, type]);
    res.status(201).json(await queryOne('SELECT * FROM driver_favorites WHERE id = ?', [id]));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/:id/favorites/:favId', async (req: Request, res: Response) => {
  try {
    const fav = await queryOne('SELECT id FROM driver_favorites WHERE id = ? AND driver_id = ?', [req.params.favId, req.params.id]);
    if (!fav) return res.status(404).json({ error: 'Favorite not found' });
    await exec('DELETE FROM driver_favorites WHERE id = ?', [req.params.favId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
