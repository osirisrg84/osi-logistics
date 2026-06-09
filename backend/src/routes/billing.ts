import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';

const router = Router();

// Summary totals
router.get('/summary', (_req: Request, res: Response) => {
  const db = getDb();
  const g = (sql: string) => (db.prepare(sql).get() as Record<string, number>);

  res.json({
    total_orders:         g("SELECT COUNT(*) as v FROM commissions").v,
    total_driver_charges: g("SELECT COALESCE(SUM(driver_charge),0) as v FROM commissions").v,
    total_dispatcher_pay: g("SELECT COALESCE(SUM(dispatcher_pay),0) as v FROM commissions").v,
    total_net_osi:        g("SELECT COALESCE(SUM(net_osi),0) as v FROM commissions").v,
    pending_driver:       g("SELECT COALESCE(SUM(driver_charge),0) as v FROM commissions WHERE status='pending'").v,
    settled_driver:       g("SELECT COALESCE(SUM(driver_charge),0) as v FROM commissions WHERE status='settled'").v,
    pending_count:        g("SELECT COUNT(*) as v FROM commissions WHERE status='pending'").v,
    settled_count:        g("SELECT COUNT(*) as v FROM commissions WHERE status='settled'").v,
  });
});

// All commission records (paginated, filterable)
router.get('/records', (req: Request, res: Response) => {
  const db = getDb();
  const { driver_id, dispatcher_user_id, status, limit = 100, offset = 0 } = req.query;
  let q = 'SELECT * FROM commissions WHERE 1=1';
  const p: unknown[] = [];
  if (driver_id)         { q += ' AND driver_id = ?';         p.push(driver_id); }
  if (dispatcher_user_id){ q += ' AND dispatcher_user_id = ?'; p.push(dispatcher_user_id); }
  if (status)            { q += ' AND status = ?';             p.push(status); }
  q += ' ORDER BY delivery_date DESC, created_at DESC LIMIT ? OFFSET ?';
  p.push(Number(limit), Number(offset));
  res.json(db.prepare(q).all(...p));
});

// Per-driver summary
router.get('/by-driver', (_req: Request, res: Response) => {
  const db = getDb();
  res.json(db.prepare(`
    SELECT driver_id, driver_name,
           COUNT(*) as total_orders,
           ROUND(SUM(order_price),2) as total_revenue,
           ROUND(SUM(driver_charge),2) as total_charged,
           ROUND(SUM(CASE WHEN status='settled' THEN driver_charge ELSE 0 END),2) as settled,
           ROUND(SUM(CASE WHEN status='pending' THEN driver_charge ELSE 0 END),2) as pending
    FROM commissions
    GROUP BY driver_id, driver_name
    ORDER BY total_charged DESC
  `).all());
});

// Per-dispatcher summary
router.get('/by-dispatcher', (_req: Request, res: Response) => {
  const db = getDb();
  res.json(db.prepare(`
    SELECT dispatcher_user_id,
           COALESCE(dispatcher_name, 'Sin asignar') as dispatcher_name,
           COUNT(*) as total_orders,
           ROUND(SUM(order_price),2) as total_order_value,
           ROUND(SUM(dispatcher_pay),2) as total_earned,
           ROUND(SUM(CASE WHEN status='settled' THEN dispatcher_pay ELSE 0 END),2) as settled,
           ROUND(SUM(CASE WHEN status='pending' THEN dispatcher_pay ELSE 0 END),2) as pending
    FROM commissions
    GROUP BY dispatcher_user_id, dispatcher_name
    ORDER BY total_earned DESC
  `).all());
});

// Settle a single commission
router.put('/:id/settle', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT id FROM commissions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Commission not found' });
  db.prepare("UPDATE commissions SET status='settled', settled_at=? WHERE id=?")
    .run(new Date().toISOString(), req.params.id);
  res.json({ success: true });
});

// Settle all pending for a driver
router.put('/driver/:driverId/settle-all', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare("UPDATE commissions SET status='settled', settled_at=? WHERE driver_id=? AND status='pending'")
    .run(new Date().toISOString(), req.params.driverId);
  res.json({ success: true });
});

export default router;
