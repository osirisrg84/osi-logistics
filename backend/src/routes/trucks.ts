import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { exec, query, queryOne } from '../database';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    let sql = `
      SELECT t.*, d.name as driver_name, d.id as assigned_driver_id,
             (SELECT COUNT(*) FROM orders WHERE truck_id = t.id AND status NOT IN ('delivered','cancelled')) as active_orders
      FROM trucks t LEFT JOIN drivers d ON d.truck_id = t.id WHERE 1=1
    `;
    const params: unknown[] = [];
    if (status) { sql += ' AND t.status = ?'; params.push(status); }
    if (search) {
      sql += ' AND (t.plate_number LIKE ? OR t.make LIKE ? OR t.model LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY t.plate_number ASC';
    res.json(await query(sql, params));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [total, active, maintenance, inactive, avgFuel, totalMileage, due] = await Promise.all([
      queryOne<{c:number}>('SELECT COUNT(*) as c FROM trucks'),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM trucks WHERE status = 'active'"),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM trucks WHERE status = 'maintenance'"),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM trucks WHERE status = 'inactive'"),
      queryOne<{avg:number}>('SELECT AVG(fuel_level) as avg FROM trucks WHERE status = "active"'),
      queryOne<{total:number}>('SELECT SUM(mileage) as total FROM trucks'),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM trucks WHERE date(next_maintenance) <= date('now', '+30 days')"),
    ]);
    res.json({
      total: total?.c ?? 0, active: active?.c ?? 0, maintenance: maintenance?.c ?? 0,
      inactive: inactive?.c ?? 0, avg_fuel: avgFuel?.avg ?? 0,
      total_mileage: totalMileage?.total ?? 0, maintenance_due: due?.c ?? 0,
    });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const truck = await queryOne(`
      SELECT t.*, d.name as driver_name, d.id as driver_id, d.phone as driver_phone
      FROM trucks t LEFT JOIN drivers d ON d.truck_id = t.id WHERE t.id = ?
    `, [req.params.id]);
    if (!truck) return res.status(404).json({ error: 'Truck not found' });
    const orders = await query('SELECT id, order_number, customer_name, status, created_at, delivered_at FROM orders WHERE truck_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);
    res.json({ truck, orders });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const id = uuidv4();
    const {
      plate_number, make, model, year, type = 'Box Truck',
      capacity_kg = 5000, capacity_m3 = 20, status = 'active',
      mileage = 0, fuel_level = 100, last_maintenance, next_maintenance,
      vin = '', color = 'White',
    } = req.body;
    await exec(`INSERT INTO trucks (id, plate_number, make, model, year, type, capacity_kg, capacity_m3,
      status, mileage, fuel_level, last_maintenance, next_maintenance, vin, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, plate_number, make, model, year, type, capacity_kg, capacity_m3, status, mileage, fuel_level, last_maintenance, next_maintenance, vin, color]);
    await exec("INSERT INTO notifications (id, type, title, message, read) VALUES (?, 'truck', 'New Truck Added', ?, 0)",
      [uuidv4(), `${year} ${make} ${model} (${plate_number}) has been added to the fleet.`]);
    res.status(201).json(await queryOne('SELECT * FROM trucks WHERE id = ?', [id]));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const truck = await queryOne('SELECT * FROM trucks WHERE id = ?', [req.params.id]);
    if (!truck) return res.status(404).json({ error: 'Truck not found' });
    const updates = req.body;
    const fields = Object.keys(updates).filter(k => !['id', 'created_at'].includes(k));
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    await exec(`UPDATE trucks SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`,
      [...fields.map(f => updates[f] ?? null), req.params.id]);
    res.json(await queryOne('SELECT * FROM trucks WHERE id = ?', [req.params.id]));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const truck = await queryOne('SELECT * FROM trucks WHERE id = ?', [req.params.id]);
    if (!truck) return res.status(404).json({ error: 'Truck not found' });
    const active = await queryOne<{c:number}>(`SELECT COUNT(*) as c FROM orders WHERE truck_id = ? AND status NOT IN ('delivered','cancelled')`, [req.params.id]);
    if ((active?.c ?? 0) > 0) return res.status(400).json({ error: 'Cannot delete truck with active orders' });
    await exec('UPDATE drivers SET truck_id = NULL WHERE truck_id = ?', [req.params.id]);
    await exec('DELETE FROM trucks WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
