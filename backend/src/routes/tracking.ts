import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.get('/live', (_req: Request, res: Response) => {
  const db = getDb();
  const drivers = db.prepare(`
    SELECT d.id, d.name, d.status, d.current_lat, d.current_lng, d.current_address,
           d.avatar, d.truck_id, d.rating,
           t.plate_number, t.make, t.model, t.type as truck_type,
           o.id as order_id, o.order_number, o.delivery_address,
           o.status as order_status, o.estimated_delivery
    FROM drivers d
    LEFT JOIN trucks t ON d.truck_id = t.id
    LEFT JOIN orders o ON o.driver_id = d.id AND o.status IN ('assigned','picked_up','in_transit')
    WHERE d.status != 'offline'
  `).all();
  res.json(drivers);
});

router.get('/driver/:id/history', (req: Request, res: Response) => {
  const db = getDb();
  const { hours = 24 } = req.query;
  const points = db.prepare(`
    SELECT lat, lng, speed, heading, timestamp FROM tracking
    WHERE driver_id = ? AND timestamp >= datetime('now', '-${Number(hours)} hours')
    ORDER BY timestamp ASC
  `).all(req.params.id);
  res.json(points);
});

router.get('/order/:id', (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare(`
    SELECT o.*,
           d.name as driver_name, d.phone as driver_phone,
           d.current_lat, d.current_lng, d.status as driver_status,
           t.plate_number, t.make, t.model
    FROM orders o
    LEFT JOIN drivers d ON o.driver_id = d.id
    LEFT JOIN trucks t ON o.truck_id = t.id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const history = db.prepare(`
    SELECT status, timestamp, notes, lat, lng
    FROM order_history WHERE order_id = ? ORDER BY timestamp ASC
  `).all(req.params.id);

  const trackingPoints = db.prepare(`
    SELECT lat, lng, speed, timestamp FROM tracking
    WHERE order_id = ? ORDER BY timestamp DESC LIMIT 100
  `).all(req.params.id);

  res.json({ order, history, trackingPoints });
});

export default router;
