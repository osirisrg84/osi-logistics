import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { exec, query, queryOne, createCommission } from '../database';
import { appEvents } from '../events';
import { sendOfferEmail, sendOfferAcceptedEmail, sendDeliveryEmail } from '../email';

type AuthRequest = Request & { user?: { id: string; name: string; role: string; driver_id?: string } };

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, priority, driver_id, search, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT o.*,
             d.name as driver_name, d.phone as driver_phone,
             t.plate_number, t.make, t.model, t.type as truck_type,
             od.name as offered_driver_name,
             u.name as dispatcher_name, u.id as dispatcher_id, u.dispatcher_code
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN trucks t ON o.truck_id = t.id
      LEFT JOIN drivers od ON o.offered_to_driver_id = od.id
      LEFT JOIN users u ON o.dispatcher_user_id = u.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (status)    { sql += ' AND o.status = ?'; params.push(status); }
    if (priority)  { sql += ' AND o.priority = ?'; params.push(priority); }
    if (driver_id) { sql += ' AND o.driver_id = ?'; params.push(driver_id); }
    if (search) {
      sql += ' AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.delivery_address LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [orders, total] = await Promise.all([
      query(sql, params),
      queryOne<{count:number}>('SELECT COUNT(*) as count FROM orders WHERE 1=1'),
    ]);
    res.json({ orders, total: total?.count ?? 0 });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [total, pending, assigned, in_transit, delivered, cancelled, today, revenue, avgRow] = await Promise.all([
      queryOne<{c:number}>('SELECT COUNT(*) as c FROM orders'),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'"),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM orders WHERE status = 'assigned'"),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM orders WHERE status IN ('picked_up','in_transit')"),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM orders WHERE status = 'delivered'"),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM orders WHERE status = 'cancelled'"),
      queryOne<{c:number}>("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now')"),
      queryOne<{r:number}>("SELECT COALESCE(SUM(price),0) as r FROM orders WHERE status = 'delivered'"),
      queryOne<{avg:number|null}>(`SELECT AVG((julianday(delivered_at) - julianday(picked_up_at)) * 24) as avg FROM orders WHERE delivered_at IS NOT NULL AND picked_up_at IS NOT NULL`),
    ]);
    res.json({
      total: total?.c ?? 0, pending: pending?.c ?? 0, assigned: assigned?.c ?? 0,
      in_transit: in_transit?.c ?? 0, delivered: delivered?.c ?? 0, cancelled: cancelled?.c ?? 0,
      today: today?.c ?? 0, revenue: revenue?.r ?? 0,
      avg_delivery_time: avgRow?.avg ?? 0,
    });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const order = await queryOne(`
      SELECT o.*,
             d.name as driver_name, d.phone as driver_phone, d.email as driver_email,
             t.plate_number, t.make, t.model, t.type as truck_type,
             od.name as offered_driver_name,
             u.name as dispatcher_name, u.id as dispatcher_id, u.dispatcher_code
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN trucks t ON o.truck_id = t.id
      LEFT JOIN drivers od ON o.offered_to_driver_id = od.id
      LEFT JOIN users u ON o.dispatcher_user_id = u.id
      WHERE o.id = ?
    `, [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const [history, tracking] = await Promise.all([
      query('SELECT * FROM order_history WHERE order_id = ? ORDER BY timestamp ASC', [req.params.id]),
      query('SELECT * FROM tracking WHERE order_id = ? ORDER BY timestamp DESC LIMIT 50', [req.params.id]),
    ]);
    res.json({ order, history, tracking });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const id = uuidv4();
    const countRow = await queryOne<{c:number}>('SELECT COUNT(*) as c FROM orders');
    const orderNumber = `OSI-${String(2024100 + (countRow?.c ?? 0) + 1).padStart(7, '0')}`;
    const {
      customer_name, customer_phone, customer_email = '',
      pickup_address, pickup_lat, pickup_lng, pickup_contact = '',
      delivery_address, delivery_lat, delivery_lng, delivery_contact = '',
      priority = 'normal', weight_kg = 0, volume_m3 = 0,
      description = '', notes = '', price = 0, distance_km = 0,
      estimated_delivery = null,
    } = req.body;

    await exec(`INSERT INTO orders (id, order_number, customer_name, customer_phone, customer_email,
      pickup_address, pickup_lat, pickup_lng, pickup_contact,
      delivery_address, delivery_lat, delivery_lng, delivery_contact,
      status, priority, weight_kg, volume_m3, description, notes,
      price, distance_km, estimated_delivery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orderNumber, customer_name, customer_phone, customer_email,
       pickup_address, pickup_lat, pickup_lng, pickup_contact,
       delivery_address, delivery_lat, delivery_lng, delivery_contact,
       priority, weight_kg, volume_m3, description, notes, price, distance_km, estimated_delivery]);

    await exec("INSERT INTO order_history (id, order_id, status, notes, created_by) VALUES (?, ?, 'pending', 'Order created', 'dispatcher')", [uuidv4(), id]);
    await exec("INSERT INTO notifications (id, type, title, message, read, related_id) VALUES (?, 'order', 'New Order Created', ?, 0, ?)",
      [uuidv4(), `New order ${orderNumber} from ${customer_name} is ready for assignment.`, id]);

    res.status(201).json(await queryOne('SELECT * FROM orders WHERE id = ?', [id]));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const updates = req.body;
    const fields = Object.keys(updates).filter(k => !['id', 'order_number', 'created_at'].includes(k));
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    await exec(`UPDATE orders SET ${setClause} WHERE id = ?`, [...fields.map(f => updates[f] ?? null), req.params.id]);
    res.json(await queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/assign', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { driver_id, truck_id } = req.body;
    const now = new Date().toISOString();

    const [order, driver] = await Promise.all([
      queryOne<Record<string,unknown>>('SELECT * FROM orders WHERE id = ?', [req.params.id]),
      queryOne<Record<string,unknown>>('SELECT * FROM drivers WHERE id = ?', [driver_id]),
    ]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    await exec(`UPDATE orders SET status = 'assigned', driver_id = ?, truck_id = ?, assigned_at = ?,
      dispatcher_user_id = COALESCE(dispatcher_user_id, ?) WHERE id = ?`,
      [driver_id, truck_id, now, authReq.user?.id || null, req.params.id]);
    await exec("UPDATE drivers SET status = 'busy', truck_id = ? WHERE id = ?", [truck_id, driver_id]);
    await exec("INSERT INTO order_history (id, order_id, status, notes, created_by) VALUES (?, ?, 'assigned', ?, 'dispatcher')",
      [uuidv4(), req.params.id, `Assigned to driver ${driver.name}`]);
    await exec("INSERT INTO notifications (id, type, title, message, read, related_id) VALUES (?, 'order', 'Order Assigned', ?, 0, ?)",
      [uuidv4(), `Order ${order.order_number} assigned to ${driver.name}`, req.params.id]);

    const driverNotifId = uuidv4();
    const driverNotifMsg = `Se te asignó la orden ${order.order_number}. Confirma el pickup cuando estés listo.`;
    await exec("INSERT INTO notifications (id, type, title, message, read, related_id, target_driver_id) VALUES (?, 'order', 'Nueva orden asignada', ?, 0, ?, ?)",
      [driverNotifId, driverNotifMsg, req.params.id, driver_id]);

    appEvents.emit('driver:notification', {
      driverId: driver_id,
      notification: { id: driverNotifId, type: 'order', title: 'Nueva orden asignada', message: driverNotifMsg, read: 0, related_id: req.params.id, target_driver_id: driver_id, created_at: now },
    });

    res.json(await queryOne(`
      SELECT o.*, d.name as driver_name, t.plate_number
      FROM orders o LEFT JOIN drivers d ON o.driver_id = d.id LEFT JOIN trucks t ON o.truck_id = t.id WHERE o.id = ?
    `, [req.params.id]));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, notes = '', lat, lng } = req.body;
    const now = new Date().toISOString();
    const order = await queryOne<Record<string,unknown>>('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const updates: Record<string, unknown> = { status };
    if (status === 'picked_up') updates.picked_up_at = now;
    if (status === 'in_transit') updates.in_transit_at = now;
    if (status === 'delivered') {
      updates.delivered_at = now;
      updates.actual_delivery = now;
      if (order.driver_id) {
        await exec("UPDATE drivers SET status = 'available', total_deliveries = total_deliveries + 1 WHERE id = ?", [order.driver_id]);
        if ((order.price as number) > 0) {
          const [drv, disp] = await Promise.all([
            queryOne<{name:string}>('SELECT name FROM drivers WHERE id = ?', [order.driver_id as string]),
            order.dispatcher_user_id ? queryOne<{name:string}>('SELECT name FROM users WHERE id = ?', [order.dispatcher_user_id as string]) : Promise.resolve(undefined),
          ]);
          await createCommission(req.params.id, order.order_number as string,
            order.driver_id as string, drv?.name || '',
            (order.dispatcher_user_id as string | null) ?? null, disp?.name ?? null,
            order.price as number, now);
        }
      }
    }
    if (status === 'cancelled' && order.driver_id) {
      await exec("UPDATE drivers SET status = 'available' WHERE id = ?", [order.driver_id]);
    }

    const fields = Object.keys(updates);
    await exec(`UPDATE orders SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(updates), req.params.id]);
    await exec('INSERT INTO order_history (id, order_id, status, notes, lat, lng, created_by) VALUES (?, ?, ?, ?, ?, ?, \'driver\')',
      [uuidv4(), req.params.id, status, notes, lat ?? null, lng ?? null]);
    await exec("INSERT INTO notifications (id, type, title, message, read, related_id) VALUES (?, 'order', ?, ?, 0, ?)",
      [uuidv4(), `Order ${status.replace('_', ' ').toUpperCase()}`,
       `Order ${order.order_number} status updated to ${status}`, req.params.id]);

    // Emails de entrega completada
    if (status === 'delivered') {
      const [driverUser, dispatcherUser] = await Promise.all([
        order.driver_id
          ? queryOne<{ email: string; name: string }>('SELECT u.email, u.name FROM users u WHERE u.driver_id = ? AND u.active = 1 LIMIT 1', [order.driver_id])
          : Promise.resolve(null),
        order.dispatcher_user_id
          ? queryOne<{ email: string; name: string }>('SELECT email, name FROM users WHERE id = ? AND active = 1', [order.dispatcher_user_id])
          : Promise.resolve(null),
      ]);
      const args = [
        order.order_number as string,
        order.pickup_address as string,
        order.delivery_address as string,
        now,
        (order.price as number) || 0,
      ] as const;
      if (driverUser?.email)     sendDeliveryEmail(driverUser.email,     driverUser.name,     'driver',      ...args).catch(e => console.error('[Email] Delivery driver:', e));
      if (dispatcherUser?.email) sendDeliveryEmail(dispatcherUser.email, dispatcherUser.name, 'dispatcher',  ...args).catch(e => console.error('[Email] Delivery dispatcher:', e));
    }

    res.json(await queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/offer', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { driver_id, truck_id } = req.body;
    const now = new Date().toISOString();
    const [order, driver] = await Promise.all([
      queryOne<Record<string,unknown>>('SELECT * FROM orders WHERE id = ?', [req.params.id]),
      queryOne<Record<string,unknown>>('SELECT * FROM drivers WHERE id = ?', [driver_id]),
    ]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!['pending', 'offered'].includes(order.status as string)) return res.status(400).json({ error: 'Order is not available to offer' });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    await exec(`UPDATE orders SET status = 'offered', offered_to_driver_id = ?, offered_to_truck_id = ?, offered_at = ?,
      dispatcher_user_id = COALESCE(dispatcher_user_id, ?) WHERE id = ?`,
      [driver_id, truck_id || null, now, authReq.user?.id || null, req.params.id]);
    await exec("INSERT INTO order_history (id, order_id, status, notes, created_by) VALUES (?, ?, 'offered', ?, 'dispatcher')",
      [uuidv4(), req.params.id, `Oferta enviada al conductor ${driver.name}`]);

    const driverNotifId = uuidv4();
    const driverNotifMsg = `Tienes una nueva oferta: ${order.order_number}. Tienes 60 segundos para aceptar o ignorar.`;
    await exec("INSERT INTO notifications (id, type, title, message, read, related_id, target_driver_id) VALUES (?, 'order', 'Nueva oferta de carga', ?, 0, ?, ?)",
      [driverNotifId, driverNotifMsg, req.params.id, driver_id]);

    const updated = await queryOne(`
      SELECT o.*, od.name as offered_driver_name FROM orders o
      LEFT JOIN drivers od ON o.offered_to_driver_id = od.id WHERE o.id = ?
    `, [req.params.id]);

    appEvents.emit('driver:offer', { driverId: driver_id, offer: updated });
    appEvents.emit('order:status_changed', { id: req.params.id, order_number: order.order_number, status: 'offered' });

    // Email al driver
    const driverUser = await queryOne<{ email: string; name: string }>(
      'SELECT u.email, u.name FROM users u WHERE u.driver_id = ? AND u.active = 1 LIMIT 1', [driver_id]
    );
    if (driverUser?.email) {
      sendOfferEmail(
        driverUser.email,
        driverUser.name || (driver.name as string),
        order.order_number as string,
        order.pickup_address as string,
        order.delivery_address as string,
        (order.rate as number) || 0,
      ).catch(e => console.error('[Email] Offer email failed:', e));
    }

    res.json(updated);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/accept', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const now = new Date().toISOString();
    const order = await queryOne<Record<string,unknown>>('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'offered') return res.status(400).json({ error: 'Order is not in offered state' });

    const driverId = order.offered_to_driver_id as string;
    const truckId  = order.offered_to_truck_id as string;
    if (authReq.user?.driver_id && authReq.user.driver_id !== driverId) {
      return res.status(403).json({ error: 'This offer was not sent to you' });
    }

    await exec(`UPDATE orders SET status = 'assigned', driver_id = ?, truck_id = ?, assigned_at = ?,
      offered_to_driver_id = NULL, offered_to_truck_id = NULL, offered_at = NULL WHERE id = ?`,
      [driverId, truckId, now, req.params.id]);
    await exec("UPDATE drivers SET status = 'busy', truck_id = ? WHERE id = ?", [truckId, driverId]);
    await exec("INSERT INTO order_history (id, order_id, status, notes, created_by) VALUES (?, ?, 'assigned', 'Conductor aceptó la oferta', 'driver')", [uuidv4(), req.params.id]);
    await exec("INSERT INTO notifications (id, type, title, message, read, related_id) VALUES (?, 'order', '✅ Oferta Aceptada', ?, 0, ?)",
      [uuidv4(), `El conductor aceptó la orden ${order.order_number}`, req.params.id]);
    appEvents.emit('order:status_changed', { id: req.params.id, order_number: order.order_number, status: 'assigned' });

    // Email al dispatcher
    if (order.dispatcher_user_id) {
      const dispatcher = await queryOne<{ email: string; name: string }>(
        'SELECT email, name FROM users WHERE id = ? AND active = 1', [order.dispatcher_user_id]
      );
      const driver = await queryOne<{ name: string }>('SELECT name FROM drivers WHERE id = ?', [driverId]);
      if (dispatcher?.email) {
        sendOfferAcceptedEmail(
          dispatcher.email,
          dispatcher.name,
          driver?.name || 'El conductor',
          order.order_number as string,
          order.pickup_address as string,
          order.delivery_address as string,
        ).catch(e => console.error('[Email] Accept email failed:', e));
      }
    }

    res.json(await queryOne(`
      SELECT o.*, d.name as driver_name, t.plate_number FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id LEFT JOIN trucks t ON o.truck_id = t.id WHERE o.id = ?
    `, [req.params.id]));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/ignore', async (_req: Request, res: Response) => {
  try {
    const order = await queryOne<Record<string,unknown>>('SELECT * FROM orders WHERE id = ?', [_req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'offered') return res.status(400).json({ error: 'Order is not in offered state' });

    await exec("UPDATE orders SET status = 'pending', offered_to_driver_id = NULL, offered_to_truck_id = NULL, offered_at = NULL WHERE id = ?", [_req.params.id]);
    await exec("INSERT INTO order_history (id, order_id, status, notes, created_by) VALUES (?, ?, 'pending', 'Conductor ignoró la oferta', 'driver')", [uuidv4(), _req.params.id]);
    await exec("INSERT INTO notifications (id, type, title, message, read, related_id) VALUES (?, 'order', '❌ Oferta Ignorada', ?, 0, ?)",
      [uuidv4(), `El conductor ignoró la orden ${order.order_number}. Disponible para reasignar.`, _req.params.id]);
    appEvents.emit('order:status_changed', { id: _req.params.id, order_number: order.order_number, status: 'pending' });
    res.json(await queryOne('SELECT * FROM orders WHERE id = ?', [_req.params.id]));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    await exec('DELETE FROM order_history WHERE order_id = ?', [req.params.id]);
    await exec('DELETE FROM tracking WHERE order_id = ?', [req.params.id]);
    await exec('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
