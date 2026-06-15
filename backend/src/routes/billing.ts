import { Router, Request, Response } from 'express';
import { exec, query, queryOne } from '../database';

const router = Router();

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const [total_orders, total_driver_charges, total_dispatcher_pay, total_net_osi,
           pending_driver, settled_driver, pending_count, settled_count] = await Promise.all([
      queryOne<{v:number}>('SELECT COUNT(*) as v FROM commissions'),
      queryOne<{v:number}>('SELECT COALESCE(SUM(driver_charge),0) as v FROM commissions'),
      queryOne<{v:number}>('SELECT COALESCE(SUM(dispatcher_pay),0) as v FROM commissions'),
      queryOne<{v:number}>('SELECT COALESCE(SUM(net_osi),0) as v FROM commissions'),
      queryOne<{v:number}>("SELECT COALESCE(SUM(driver_charge),0) as v FROM commissions WHERE status='pending'"),
      queryOne<{v:number}>("SELECT COALESCE(SUM(driver_charge),0) as v FROM commissions WHERE status='settled'"),
      queryOne<{v:number}>("SELECT COUNT(*) as v FROM commissions WHERE status='pending'"),
      queryOne<{v:number}>("SELECT COUNT(*) as v FROM commissions WHERE status='settled'"),
    ]);
    res.json({
      total_orders:         total_orders?.v         ?? 0,
      total_driver_charges: total_driver_charges?.v ?? 0,
      total_dispatcher_pay: total_dispatcher_pay?.v ?? 0,
      total_net_osi:        total_net_osi?.v        ?? 0,
      pending_driver:       pending_driver?.v        ?? 0,
      settled_driver:       settled_driver?.v        ?? 0,
      pending_count:        pending_count?.v         ?? 0,
      settled_count:        settled_count?.v         ?? 0,
    });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/records', async (req: Request, res: Response) => {
  try {
    const { driver_id, dispatcher_user_id, status, limit = 100, offset = 0 } = req.query;
    let q = 'SELECT * FROM commissions WHERE 1=1';
    const p: unknown[] = [];
    if (driver_id)          { q += ' AND driver_id = ?';          p.push(driver_id); }
    if (dispatcher_user_id) { q += ' AND dispatcher_user_id = ?'; p.push(dispatcher_user_id); }
    if (status)             { q += ' AND status = ?';              p.push(status); }
    q += ' ORDER BY delivery_date DESC, created_at DESC LIMIT ? OFFSET ?';
    p.push(Number(limit), Number(offset));
    res.json(await query(q, p));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/by-driver', async (_req: Request, res: Response) => {
  try {
    res.json(await query(`
      SELECT driver_id, driver_name,
             COUNT(*) as total_orders,
             ROUND(SUM(order_price),2) as total_revenue,
             ROUND(SUM(driver_charge),2) as total_charged,
             ROUND(SUM(CASE WHEN status='settled' THEN driver_charge ELSE 0 END),2) as settled,
             ROUND(SUM(CASE WHEN status='pending' THEN driver_charge ELSE 0 END),2) as pending
      FROM commissions
      GROUP BY driver_id, driver_name
      ORDER BY total_charged DESC
    `));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/by-dispatcher', async (_req: Request, res: Response) => {
  try {
    res.json(await query(`
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
    `));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/:id/settle', async (req: Request, res: Response) => {
  try {
    const row = await queryOne('SELECT id FROM commissions WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Commission not found' });
    await exec("UPDATE commissions SET status='settled', settled_at=? WHERE id=?",
      [new Date().toISOString(), req.params.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/driver/:driverId/settle-all', async (req: Request, res: Response) => {
  try {
    await exec("UPDATE commissions SET status='settled', settled_at=? WHERE driver_id=? AND status='pending'",
      [new Date().toISOString(), req.params.driverId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
