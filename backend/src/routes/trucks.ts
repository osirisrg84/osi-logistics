import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { status, search } = req.query;

  let query = `
    SELECT t.*,
           d.name as driver_name, d.id as assigned_driver_id,
           (SELECT COUNT(*) FROM orders WHERE truck_id = t.id AND status NOT IN ('delivered','cancelled')) as active_orders
    FROM trucks t
    LEFT JOIN drivers d ON d.truck_id = t.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (search) {
    query += ' AND (t.plate_number LIKE ? OR t.make LIKE ? OR t.model LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY t.plate_number ASC';
  const trucks = db.prepare(query).all(...params);
  res.json(trucks);
});

router.get('/stats', (_req: Request, res: Response) => {
  const db = getDb();
  const stats = {
    total: (db.prepare('SELECT COUNT(*) as c FROM trucks').get() as { c: number }).c,
    active: (db.prepare("SELECT COUNT(*) as c FROM trucks WHERE status = 'active'").get() as { c: number }).c,
    maintenance: (db.prepare("SELECT COUNT(*) as c FROM trucks WHERE status = 'maintenance'").get() as { c: number }).c,
    inactive: (db.prepare("SELECT COUNT(*) as c FROM trucks WHERE status = 'inactive'").get() as { c: number }).c,
    avg_fuel: (db.prepare('SELECT AVG(fuel_level) as avg FROM trucks WHERE status = "active"').get() as { avg: number }).avg,
    total_mileage: (db.prepare('SELECT SUM(mileage) as total FROM trucks').get() as { total: number }).total,
    maintenance_due: (db.prepare(`
      SELECT COUNT(*) as c FROM trucks WHERE date(next_maintenance) <= date('now', '+30 days')
    `).get() as { c: number }).c,
  };
  res.json(stats);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const truck = db.prepare(`
    SELECT t.*, d.name as driver_name, d.id as driver_id, d.phone as driver_phone
    FROM trucks t
    LEFT JOIN drivers d ON d.truck_id = t.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!truck) return res.status(404).json({ error: 'Truck not found' });

  const orders = db.prepare(`
    SELECT id, order_number, customer_name, status, created_at, delivered_at
    FROM orders WHERE truck_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(req.params.id);

  res.json({ truck, orders });
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const {
    plate_number, make, model, year, type = 'Box Truck',
    capacity_kg = 5000, capacity_m3 = 20, status = 'active',
    mileage = 0, fuel_level = 100, last_maintenance, next_maintenance,
    vin = '', color = 'White',
  } = req.body;

  db.prepare(`
    INSERT INTO trucks (id, plate_number, make, model, year, type, capacity_kg, capacity_m3,
      status, mileage, fuel_level, last_maintenance, next_maintenance, vin, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, plate_number, make, model, year, type, capacity_kg, capacity_m3,
    status, mileage, fuel_level, last_maintenance, next_maintenance, vin, color);

  db.prepare(`
    INSERT INTO notifications (id, type, title, message, read)
    VALUES (?, 'truck', 'New Truck Added', ?, 0)
  `).run(uuidv4(), `${year} ${make} ${model} (${plate_number}) has been added to the fleet.`);

  const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(id);
  res.status(201).json(truck);
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(req.params.id);
  if (!truck) return res.status(404).json({ error: 'Truck not found' });

  const updates = req.body;
  const fields = Object.keys(updates).filter(k => !['id', 'created_at'].includes(k));
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f]);
  db.prepare(`UPDATE trucks SET ${setClause} WHERE id = ?`).run(...values, req.params.id);

  const updated = db.prepare('SELECT * FROM trucks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!truck) return res.status(404).json({ error: 'Truck not found' });

  const activeOrders = db.prepare(`
    SELECT COUNT(*) as c FROM orders WHERE truck_id = ? AND status NOT IN ('delivered','cancelled')
  `).get(req.params.id) as { c: number };

  if (activeOrders.c > 0) {
    return res.status(400).json({ error: 'Cannot delete truck with active orders' });
  }

  db.prepare('UPDATE drivers SET truck_id = NULL WHERE truck_id = ?').run(req.params.id);
  db.prepare('DELETE FROM trucks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
