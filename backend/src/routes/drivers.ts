import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { appEvents } from '../events';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { status, search } = req.query;

  let query = `
    SELECT d.*,
           t.plate_number, t.make, t.model, t.type as truck_type,
           (SELECT COUNT(*) FROM orders WHERE driver_id = d.id AND status IN ('assigned','picked_up','in_transit')) as active_orders
    FROM drivers d
    LEFT JOIN trucks t ON d.truck_id = t.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (status) { query += ' AND d.status = ?'; params.push(status); }
  if (search) {
    query += ' AND (d.name LIKE ? OR d.phone LIKE ? OR d.license_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY d.name ASC';
  const drivers = db.prepare(query).all(...params);
  res.json(drivers);
});

router.get('/stats', (_req: Request, res: Response) => {
  const db = getDb();
  const stats = {
    total: (db.prepare('SELECT COUNT(*) as c FROM drivers').get() as { c: number }).c,
    available: (db.prepare("SELECT COUNT(*) as c FROM drivers WHERE status = 'available'").get() as { c: number }).c,
    busy: (db.prepare("SELECT COUNT(*) as c FROM drivers WHERE status = 'busy'").get() as { c: number }).c,
    on_break: (db.prepare("SELECT COUNT(*) as c FROM drivers WHERE status = 'on_break'").get() as { c: number }).c,
    offline: (db.prepare("SELECT COUNT(*) as c FROM drivers WHERE status = 'offline'").get() as { c: number }).c,
    avg_rating: (db.prepare('SELECT AVG(rating) as avg FROM drivers').get() as { avg: number }).avg,
    top_driver: db.prepare(`
      SELECT name, total_deliveries, rating FROM drivers ORDER BY total_deliveries DESC LIMIT 1
    `).get(),
  };
  res.json(stats);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const driver = db.prepare(`
    SELECT d.*, t.plate_number, t.make, t.model, t.type as truck_type, t.fuel_level
    FROM drivers d
    LEFT JOIN trucks t ON d.truck_id = t.id
    WHERE d.id = ?
  `).get(req.params.id);

  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  const recentOrders = db.prepare(`
    SELECT id, order_number, customer_name, status, delivery_address, created_at, delivered_at
    FROM orders WHERE driver_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(req.params.id);

  const trackingHistory = db.prepare(`
    SELECT * FROM tracking WHERE driver_id = ? ORDER BY timestamp DESC LIMIT 20
  `).all(req.params.id);

  res.json({ driver, recentOrders, trackingHistory });
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const {
    name, phone, email, license_number, license_expiry,
    hire_date, current_lat = 25.7617, current_lng = -80.1918,
    current_address = 'Miami, FL',
    equipment_type = 'Dry Van',
    company_name = 'OSI Logistics LLC',
    mc_number = '',
    authority_since = '',
  } = req.body;

  const initials = name.split(' ').map((n: string) => n[0]).join('');

  db.prepare(`
    INSERT INTO drivers (id, name, phone, email, license_number, license_expiry,
      status, current_lat, current_lng, current_address, avatar, hire_date,
      equipment_type, company_name, mc_number, authority_since)
    VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, phone, email, license_number, license_expiry, current_lat, current_lng, current_address, initials, hire_date, equipment_type, company_name, mc_number, authority_since);

  db.prepare(`
    INSERT INTO notifications (id, type, title, message, read, related_id)
    VALUES (?, 'driver', 'New Driver Added', ?, 0, ?)
  `).run(uuidv4(), `${name} has been added to the driver roster.`, id);

  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
  res.status(201).json(driver);
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  const updates = req.body;
  const fields = Object.keys(updates).filter(k => !['id', 'created_at'].includes(k));
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f]);
  db.prepare(`UPDATE drivers SET ${setClause} WHERE id = ?`).run(...values, req.params.id);

  const updated = db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id) as Record<string, unknown>;

  // Emit status change event so Socket.io can broadcast to dispatchers
  if (updates.status) {
    appEvents.emit('driver:status_changed', {
      id: req.params.id,
      name: updated.name,
      status: updated.status,
      lat: updated.current_lat,
      lng: updated.current_lng,
      avatar: updated.avatar,
    });
  }

  res.json(updated);
});

router.post('/:id/location', (req: Request, res: Response) => {
  const db = getDb();
  const { lat, lng, speed = 0, heading = 0, address = '' } = req.body;

  db.prepare(`
    UPDATE drivers SET current_lat = ?, current_lng = ?, current_address = ? WHERE id = ?
  `).run(lat, lng, address, req.params.id);

  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  db.prepare(`
    INSERT INTO tracking (id, driver_id, order_id, lat, lng, speed, heading)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), req.params.id, driver.current_order_id || null, lat, lng, speed, heading);

  res.json({ success: true });
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  const activeOrders = db.prepare(`
    SELECT COUNT(*) as c FROM orders WHERE driver_id = ? AND status NOT IN ('delivered','cancelled')
  `).get(req.params.id) as { c: number };

  if (activeOrders.c > 0) {
    return res.status(400).json({ error: 'Cannot delete driver with active orders' });
  }

  db.prepare('DELETE FROM tracking WHERE driver_id = ?').run(req.params.id);
  db.prepare('DELETE FROM drivers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Favorites ─────────────────────────────────────────────────────────────

router.get('/:id/favorites', (req: Request, res: Response) => {
  const db = getDb();
  const favs = db.prepare(
    'SELECT * FROM driver_favorites WHERE driver_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);
  res.json(favs);
});

router.post('/:id/favorites', (req: Request, res: Response) => {
  const db = getDb();
  const { name, address, type = 'other' } = req.body;
  if (!name || !address) return res.status(400).json({ error: 'name and address required' });

  const count = (db.prepare(
    'SELECT COUNT(*) as c FROM driver_favorites WHERE driver_id = ?'
  ).get(req.params.id) as { c: number }).c;
  if (count >= 5) return res.status(400).json({ error: 'Maximum 5 favorites per driver' });

  const id = uuidv4();
  db.prepare(
    'INSERT INTO driver_favorites (id, driver_id, name, address, type) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.params.id, name, address, type);

  const fav = db.prepare('SELECT * FROM driver_favorites WHERE id = ?').get(id);
  res.status(201).json(fav);
});

router.delete('/:id/favorites/:favId', (req: Request, res: Response) => {
  const db = getDb();
  const fav = db.prepare(
    'SELECT id FROM driver_favorites WHERE id = ? AND driver_id = ?'
  ).get(req.params.favId, req.params.id);
  if (!fav) return res.status(404).json({ error: 'Favorite not found' });

  db.prepare('DELETE FROM driver_favorites WHERE id = ?').run(req.params.favId);
  res.json({ success: true });
});

export default router;
