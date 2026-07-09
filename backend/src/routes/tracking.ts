import { Router, Request, Response } from 'express';
import { query, queryOne } from '../database';

const router = Router();

router.get('/live', async (_req: Request, res: Response) => {
  try {
    const drivers = await query(`
      SELECT d.id, d.name, d.status, d.current_lat, d.current_lng, d.current_address,
             d.avatar, d.truck_id, d.rating, d.gps_active,
             d.equipment_type, d.total_deliveries, d.truck_make, d.truck_number,
             t.plate_number, t.make, t.model, t.type as truck_type,
             o.id as order_id, o.order_number, o.delivery_address,
             o.status as order_status, o.estimated_delivery
      FROM drivers d
      LEFT JOIN trucks t ON d.truck_id = t.id
      LEFT JOIN orders o ON o.driver_id = d.id AND o.status IN ('assigned','picked_up','in_transit')
      WHERE d.gps_active = 1
    `);
    res.json(drivers);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/driver/:id/history', async (req: Request, res: Response) => {
  try {
    const { hours = 24 } = req.query;
    const points = await query(
      `SELECT lat, lng, speed, heading, timestamp FROM tracking WHERE driver_id = ? AND timestamp >= datetime('now', '-${Number(hours)} hours') ORDER BY timestamp ASC`,
      [req.params.id]
    );
    res.json(points);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/order/:id', async (req: Request, res: Response) => {
  try {
    const order = await queryOne(`
      SELECT o.*, d.name as driver_name, d.phone as driver_phone,
             d.current_lat, d.current_lng, d.status as driver_status,
             t.plate_number, t.make, t.model
      FROM orders o LEFT JOIN drivers d ON o.driver_id = d.id LEFT JOIN trucks t ON o.truck_id = t.id
      WHERE o.id = ?
    `, [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const [history, trackingPoints] = await Promise.all([
      query('SELECT status, timestamp, notes, lat, lng FROM order_history WHERE order_id = ? ORDER BY timestamp ASC', [req.params.id]),
      query('SELECT lat, lng, speed, timestamp FROM tracking WHERE order_id = ? ORDER BY timestamp DESC LIMIT 100', [req.params.id]),
    ]);
    res.json({ order, history, trackingPoints });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
