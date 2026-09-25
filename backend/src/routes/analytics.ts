import { Router, Request, Response } from 'express';
import { query, queryOne } from '../database';

const router = Router();

const isDemo = (email?: string) => (email ?? '').endsWith('@osilogistics.com');
const DEMO_ORDER_FILTER = `(o.order_number LIKE 'OSI-H%' OR o.dispatcher_user_id IN (SELECT id FROM users WHERE email LIKE '%@osilogistics.com'))`;
const REAL_ORDER_FILTER = `o.order_number NOT LIKE 'OSI-H%' AND (o.dispatcher_user_id IS NULL OR o.dispatcher_user_id NOT IN (SELECT id FROM users WHERE email LIKE '%@osilogistics.com'))`;
const DEMO_DRIVER_FILTER = `d.email LIKE '%@osilogistics.com'`;
const REAL_DRIVER_FILTER = `d.email NOT LIKE '%@osilogistics.com'`;

const getOrderFilter = (email?: string, role?: string, userId?: string): string => {
  if (role === 'admin') return REAL_ORDER_FILTER;
  if (isDemo(email)) return DEMO_ORDER_FILTER;
  return userId ? `${REAL_ORDER_FILTER} AND o.dispatcher_user_id = '${userId}'` : `${REAL_ORDER_FILTER} AND 1=0`;
};

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const demo = req.user?.role !== 'admin' && isDemo(req.user?.email);
    const of = getOrderFilter(req.user?.email, req.user?.role, (req.user as { id?: string })?.id);
    const df = demo ? DEMO_DRIVER_FILTER : REAL_DRIVER_FILTER;
    const [ordersByStatus, dailyRevenue, topDrivers, deliveryByHour, ordersByPriority, recentActivity,
           totalRevRow, monthRevRow, avgValRow, onTimeRow, avgHrRow] = await Promise.all([
      query(`SELECT o.status, COUNT(*) as count FROM orders o WHERE ${of} GROUP BY o.status`),
      query(`SELECT date(COALESCE(o.delivered_at, o.created_at)) as date, SUM(CASE WHEN o.status='delivered' THEN o.price ELSE 0 END) as revenue, COUNT(*) as orders FROM orders o WHERE COALESCE(o.delivered_at, o.created_at) >= date('now', '-30 days') AND ${of} GROUP BY date(COALESCE(o.delivered_at, o.created_at)) ORDER BY date ASC`),
      query(`SELECT d.name, d.rating, d.total_deliveries, d.on_time_rate, d.avatar,
               COUNT(o.id) as recent_deliveries, SUM(o.price) as revenue
             FROM drivers d LEFT JOIN orders o ON o.driver_id = d.id AND o.status = 'delivered'
               AND o.delivered_at >= date('now', '-30 days')
             WHERE ${df}
             GROUP BY d.id ORDER BY d.total_deliveries DESC LIMIT 5`),
      query(`SELECT strftime('%H', o.delivered_at) as hour, COUNT(*) as count FROM orders o WHERE o.delivered_at IS NOT NULL AND ${of} GROUP BY hour ORDER BY hour ASC`),
      query(`SELECT o.priority, COUNT(*) as count FROM orders o WHERE ${of} GROUP BY o.priority`),
      query(`SELECT oh.status, oh.timestamp, oh.notes, o.order_number, o.customer_name, d.name as driver_name
             FROM order_history oh JOIN orders o ON oh.order_id = o.id LEFT JOIN drivers d ON o.driver_id = d.id
             WHERE ${of}
             ORDER BY oh.timestamp DESC LIMIT 10`),
      queryOne<{r:number}>(`SELECT COALESCE(SUM(o.price),0) as r FROM orders o WHERE o.status='delivered' AND ${of}`),
      queryOne<{r:number}>(`SELECT COALESCE(SUM(o.price),0) as r FROM orders o WHERE o.status='delivered' AND o.delivered_at >= date('now', 'start of month') AND ${of}`),
      queryOne<{a:number}>(`SELECT COALESCE(AVG(o.price),0) as a FROM orders o WHERE o.status='delivered' AND ${of}`),
      queryOne<{r:number}>(`SELECT COALESCE(AVG(CASE WHEN o.delivered_at <= o.estimated_delivery THEN 100.0 ELSE 0 END),0) as r FROM orders o WHERE o.status='delivered' AND o.estimated_delivery IS NOT NULL AND ${of}`),
      queryOne<{avg:number|null}>(`SELECT AVG((julianday(o.delivered_at) - julianday(o.picked_up_at)) * 24) as avg FROM orders o WHERE o.delivered_at IS NOT NULL AND o.picked_up_at IS NOT NULL AND ${of}`),
    ]);

    res.json({
      ordersByStatus, dailyRevenue, topDrivers, deliveryByHour, ordersByPriority, recentActivity,
      kpis: {
        total_revenue: totalRevRow?.r ?? 0,
        monthly_revenue: monthRevRow?.r ?? 0,
        avg_order_value: avgValRow?.a ?? 0,
        on_time_rate: onTimeRow?.r ?? 0,
        avg_delivery_hours: avgHrRow?.avg ?? 0,
        customer_satisfaction: 4.7,
      },
    });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/reports/orders', async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;
    let dateFormat = '%Y-%m-%d';
    if (group_by === 'week') dateFormat = '%Y-W%W';
    if (group_by === 'month') dateFormat = '%Y-%m';

    let where = "WHERE status != 'cancelled'";
    const params: unknown[] = [];
    if (start_date) { where += ' AND date(created_at) >= ?'; params.push(start_date); }
    if (end_date)   { where += ' AND date(created_at) <= ?'; params.push(end_date); }

    const data = await query(`
      SELECT strftime('${dateFormat}', created_at) as period,
             COUNT(*) as total_orders,
             SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered,
             SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) as cancelled,
             SUM(price) as revenue, AVG(distance_km) as avg_distance
      FROM orders ${where} GROUP BY period ORDER BY period ASC
    `, params);
    res.json(data);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/reports/drivers', async (_req: Request, res: Response) => {
  try {
    const data = await query(`
      SELECT d.name, d.rating, d.total_deliveries, d.on_time_rate, d.status,
             COUNT(o.id) as orders_this_month,
             COALESCE(SUM(o.price), 0) as revenue_this_month,
             COALESCE(AVG((julianday(o.delivered_at) - julianday(o.picked_up_at)) * 60), 0) as avg_delivery_minutes
      FROM drivers d LEFT JOIN orders o ON o.driver_id = d.id AND o.status = 'delivered'
        AND o.created_at >= date('now', 'start of month')
      GROUP BY d.id ORDER BY d.total_deliveries DESC
    `);
    res.json(data);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/reports/fleet', async (_req: Request, res: Response) => {
  try {
    const data = await query(`
      SELECT t.*, COUNT(o.id) as total_trips,
             COALESCE(SUM(o.distance_km), 0) as total_km,
             COALESCE(SUM(o.price), 0) as revenue_generated,
             d.name as current_driver
      FROM trucks t LEFT JOIN orders o ON o.truck_id = t.id AND o.status = 'delivered'
      LEFT JOIN drivers d ON d.truck_id = t.id
      GROUP BY t.id ORDER BY t.plate_number ASC
    `);
    res.json(data);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
