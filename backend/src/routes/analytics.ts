import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.get('/dashboard', (_req: Request, res: Response) => {
  const db = getDb();

  const ordersByStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM orders GROUP BY status
  `).all();

  const dailyRevenue = db.prepare(`
    SELECT date(created_at) as date, SUM(price) as revenue, COUNT(*) as orders
    FROM orders
    WHERE created_at >= date('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all();

  const topDrivers = db.prepare(`
    SELECT d.name, d.rating, d.total_deliveries, d.on_time_rate, d.avatar,
           COUNT(o.id) as recent_deliveries,
           SUM(o.price) as revenue
    FROM drivers d
    LEFT JOIN orders o ON o.driver_id = d.id AND o.status = 'delivered'
      AND o.delivered_at >= date('now', '-30 days')
    GROUP BY d.id
    ORDER BY d.total_deliveries DESC
    LIMIT 5
  `).all();

  const deliveryByHour = db.prepare(`
    SELECT strftime('%H', delivered_at) as hour, COUNT(*) as count
    FROM orders WHERE delivered_at IS NOT NULL
    GROUP BY hour ORDER BY hour ASC
  `).all();

  const ordersByPriority = db.prepare(`
    SELECT priority, COUNT(*) as count FROM orders GROUP BY priority
  `).all();

  const recentActivity = db.prepare(`
    SELECT oh.status, oh.timestamp, oh.notes, o.order_number, o.customer_name, d.name as driver_name
    FROM order_history oh
    JOIN orders o ON oh.order_id = o.id
    LEFT JOIN drivers d ON o.driver_id = d.id
    ORDER BY oh.timestamp DESC LIMIT 10
  `).all();

  const kpis = {
    total_revenue: (db.prepare("SELECT COALESCE(SUM(price),0) as r FROM orders WHERE status='delivered'").get() as { r: number }).r,
    monthly_revenue: (db.prepare(`
      SELECT COALESCE(SUM(price),0) as r FROM orders
      WHERE status='delivered' AND created_at >= date('now', 'start of month')
    `).get() as { r: number }).r,
    avg_order_value: (db.prepare("SELECT COALESCE(AVG(price),0) as a FROM orders WHERE status='delivered'").get() as { a: number }).a,
    on_time_rate: (db.prepare(`
      SELECT COALESCE(AVG(CASE WHEN delivered_at <= estimated_delivery THEN 100.0 ELSE 0 END),0) as r
      FROM orders WHERE status='delivered' AND estimated_delivery IS NOT NULL
    `).get() as { r: number }).r,
    avg_delivery_hours: (db.prepare(`
      SELECT AVG((julianday(delivered_at) - julianday(picked_up_at)) * 24) as avg
      FROM orders WHERE delivered_at IS NOT NULL AND picked_up_at IS NOT NULL
    `).get() as { avg: number | null }).avg || 0,
    customer_satisfaction: 4.7,
  };

  res.json({ ordersByStatus, dailyRevenue, topDrivers, deliveryByHour, ordersByPriority, recentActivity, kpis });
});

router.get('/reports/orders', (req: Request, res: Response) => {
  const db = getDb();
  const { start_date, end_date, group_by = 'day' } = req.query;

  let dateFormat = '%Y-%m-%d';
  if (group_by === 'week') dateFormat = '%Y-W%W';
  if (group_by === 'month') dateFormat = '%Y-%m';

  let whereClause = "WHERE status != 'cancelled'";
  const params: unknown[] = [];

  if (start_date) { whereClause += ' AND date(created_at) >= ?'; params.push(start_date); }
  if (end_date) { whereClause += ' AND date(created_at) <= ?'; params.push(end_date); }

  const data = db.prepare(`
    SELECT strftime('${dateFormat}', created_at) as period,
           COUNT(*) as total_orders,
           SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered,
           SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) as cancelled,
           SUM(price) as revenue,
           AVG(distance_km) as avg_distance
    FROM orders ${whereClause}
    GROUP BY period ORDER BY period ASC
  `).all(...params);

  res.json(data);
});

router.get('/reports/drivers', (_req: Request, res: Response) => {
  const db = getDb();

  const performance = db.prepare(`
    SELECT d.name, d.rating, d.total_deliveries, d.on_time_rate, d.status,
           COUNT(o.id) as orders_this_month,
           COALESCE(SUM(o.price), 0) as revenue_this_month,
           COALESCE(AVG((julianday(o.delivered_at) - julianday(o.picked_up_at)) * 60), 0) as avg_delivery_minutes
    FROM drivers d
    LEFT JOIN orders o ON o.driver_id = d.id
      AND o.status = 'delivered'
      AND o.created_at >= date('now', 'start of month')
    GROUP BY d.id
    ORDER BY d.total_deliveries DESC
  `).all();

  res.json(performance);
});

router.get('/reports/fleet', (_req: Request, res: Response) => {
  const db = getDb();

  const fleet = db.prepare(`
    SELECT t.*,
           COUNT(o.id) as total_trips,
           COALESCE(SUM(o.distance_km), 0) as total_km,
           COALESCE(SUM(o.price), 0) as revenue_generated,
           d.name as current_driver
    FROM trucks t
    LEFT JOIN orders o ON o.truck_id = t.id AND o.status = 'delivered'
    LEFT JOIN drivers d ON d.truck_id = t.id
    GROUP BY t.id
    ORDER BY t.plate_number ASC
  `).all();

  res.json(fleet);
});

export default router;
