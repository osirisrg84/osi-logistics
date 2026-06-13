import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, createCommission } from '../database';
import { appEvents } from '../events';

type AuthRequest = Request & { user?: { id: string; name: string; role: string } };

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { status, priority, driver_id, search, limit = 50, offset = 0 } = req.query;

  let query = `
    SELECT o.*,
           d.name as driver_name, d.phone as driver_phone,
           t.plate_number, t.make, t.model,
           od.name as offered_driver_name,
           u.name as dispatcher_name, u.id as dispatcher_id
    FROM orders o
    LEFT JOIN drivers d ON o.driver_id = d.id
    LEFT JOIN trucks t ON o.truck_id = t.id
    LEFT JOIN drivers od ON o.offered_to_driver_id = od.id
    LEFT JOIN users u ON o.dispatcher_user_id = u.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (status) { query += ' AND o.status = ?'; params.push(status); }
  if (priority) { query += ' AND o.priority = ?'; params.push(priority); }
  if (driver_id) { query += ' AND o.driver_id = ?'; params.push(driver_id); }
  if (search) {
    query += ' AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.delivery_address LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const orders = db.prepare(query).all(...params);
  const total = (db.prepare('SELECT COUNT(*) as count FROM orders WHERE 1=1').get() as { count: number }).count;

  res.json({ orders, total });
});

router.get('/stats', (_req: Request, res: Response) => {
  const db = getDb();
  const stats = {
    total: (db.prepare('SELECT COUNT(*) as c FROM orders').get() as { c: number }).c,
    pending: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get() as { c: number }).c,
    assigned: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'assigned'").get() as { c: number }).c,
    in_transit: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('picked_up','in_transit')").get() as { c: number }).c,
    delivered: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'delivered'").get() as { c: number }).c,
    cancelled: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'cancelled'").get() as { c: number }).c,
    today: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now')").get() as { c: number }).c,
    revenue: (db.prepare("SELECT COALESCE(SUM(price),0) as r FROM orders WHERE status = 'delivered'").get() as { r: number }).r,
    avg_delivery_time: (db.prepare(`
      SELECT AVG((julianday(delivered_at) - julianday(picked_up_at)) * 24) as avg
      FROM orders WHERE delivered_at IS NOT NULL AND picked_up_at IS NOT NULL
    `).get() as { avg: number | null }).avg || 0,
  };
  res.json(stats);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare(`
    SELECT o.*,
           d.name as driver_name, d.phone as driver_phone, d.email as driver_email,
           t.plate_number, t.make, t.model, t.type as truck_type,
           od.name as offered_driver_name,
           u.name as dispatcher_name, u.id as dispatcher_id
    FROM orders o
    LEFT JOIN drivers d ON o.driver_id = d.id
    LEFT JOIN trucks t ON o.truck_id = t.id
    LEFT JOIN drivers od ON o.offered_to_driver_id = od.id
    LEFT JOIN users u ON o.dispatcher_user_id = u.id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const history = db.prepare('SELECT * FROM order_history WHERE order_id = ? ORDER BY timestamp ASC').all(req.params.id);
  const tracking = db.prepare('SELECT * FROM tracking WHERE order_id = ? ORDER BY timestamp DESC LIMIT 50').all(req.params.id);

  res.json({ order, history, tracking });
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const count = (db.prepare('SELECT COUNT(*) as c FROM orders').get() as { c: number }).c;
  const orderNumber = `OSI-${String(2024100 + count + 1).padStart(7, '0')}`;

  const {
    customer_name, customer_phone, customer_email = '',
    pickup_address, pickup_lat, pickup_lng, pickup_contact = '',
    delivery_address, delivery_lat, delivery_lng, delivery_contact = '',
    priority = 'normal', weight_kg = 0, volume_m3 = 0,
    description = '', notes = '', price = 0, distance_km = 0,
    estimated_delivery = null,
  } = req.body;

  db.prepare(`
    INSERT INTO orders (id, order_number, customer_name, customer_phone, customer_email,
      pickup_address, pickup_lat, pickup_lng, pickup_contact,
      delivery_address, delivery_lat, delivery_lng, delivery_contact,
      status, priority, weight_kg, volume_m3, description, notes,
      price, distance_km, estimated_delivery)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orderNumber, customer_name, customer_phone, customer_email,
    pickup_address, pickup_lat, pickup_lng, pickup_contact,
    delivery_address, delivery_lat, delivery_lng, delivery_contact,
    priority, weight_kg, volume_m3, description, notes, price, distance_km, estimated_delivery);

  db.prepare(`
    INSERT INTO order_history (id, order_id, status, notes, created_by)
    VALUES (?, ?, 'pending', 'Order created', 'dispatcher')
  `).run(uuidv4(), id);

  db.prepare(`
    INSERT INTO notifications (id, type, title, message, read, related_id)
    VALUES (?, 'order', 'New Order Created', ?, 0, ?)
  `).run(uuidv4(), `New order ${orderNumber} from ${customer_name} is ready for assignment.`, id);

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  res.status(201).json(order);
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const updates = req.body;
  const fields = Object.keys(updates).filter(k => !['id', 'order_number', 'created_at'].includes(k));
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f]);
  db.prepare(`UPDATE orders SET ${setClause} WHERE id = ?`).run(...values, req.params.id);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.post('/:id/assign', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { driver_id, truck_id } = req.body;
  const now = new Date().toISOString();
  const dispatcherId   = req.user?.id   || null;
  const dispatcherName = req.user?.name || null;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(driver_id) as Record<string, unknown> | undefined;
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  db.prepare(`
    UPDATE orders SET status = 'assigned', driver_id = ?, truck_id = ?, assigned_at = ?,
      dispatcher_user_id = COALESCE(dispatcher_user_id, ?)
    WHERE id = ?
  `).run(driver_id, truck_id, now, dispatcherId, req.params.id);

  db.prepare(`UPDATE drivers SET status = 'busy', truck_id = ? WHERE id = ?`).run(truck_id, driver_id);

  db.prepare(`
    INSERT INTO order_history (id, order_id, status, notes, created_by)
    VALUES (?, ?, 'assigned', ?, 'dispatcher')
  `).run(uuidv4(), req.params.id, `Assigned to driver ${driver.name}`);

  db.prepare(`
    INSERT INTO notifications (id, type, title, message, read, related_id)
    VALUES (?, 'order', 'Order Assigned', ?, 0, ?)
  `).run(uuidv4(), `Order ${order.order_number} assigned to ${driver.name}`, req.params.id);

  const driverNotifId = uuidv4();
  const driverNotifMsg = `Se te asignó la orden ${order.order_number}. Confirma el pickup cuando estés listo.`;
  db.prepare(`
    INSERT INTO notifications (id, type, title, message, read, related_id, target_driver_id)
    VALUES (?, 'order', 'Nueva orden asignada', ?, 0, ?, ?)
  `).run(driverNotifId, driverNotifMsg, req.params.id, driver_id);

  appEvents.emit('driver:notification', {
    driverId: driver_id,
    notification: {
      id: driverNotifId,
      type: 'order',
      title: 'Nueva orden asignada',
      message: driverNotifMsg,
      read: 0,
      related_id: req.params.id,
      target_driver_id: driver_id,
      created_at: new Date().toISOString(),
    },
  });

  const updated = db.prepare(`
    SELECT o.*, d.name as driver_name, t.plate_number
    FROM orders o
    LEFT JOIN drivers d ON o.driver_id = d.id
    LEFT JOIN trucks t ON o.truck_id = t.id
    WHERE o.id = ?
  `).get(req.params.id);

  res.json(updated);
});

router.post('/:id/status', (req: Request, res: Response) => {
  const db = getDb();
  const { status, notes = '', lat, lng } = req.body;
  const now = new Date().toISOString();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const updates: Record<string, unknown> = { status };
  if (status === 'picked_up') updates.picked_up_at = now;
  if (status === 'in_transit') updates.in_transit_at = now;
  if (status === 'delivered') {
    updates.delivered_at = now;
    updates.actual_delivery = now;
    if (order.driver_id) {
      db.prepare(`UPDATE drivers SET status = 'available', total_deliveries = total_deliveries + 1 WHERE id = ?`).run(order.driver_id);
      // Generate commission record
      if ((order.price as number) > 0) {
        const driver = db.prepare('SELECT name FROM drivers WHERE id = ?').get(order.driver_id as string) as { name: string } | undefined;
        const dispUser = order.dispatcher_user_id
          ? db.prepare('SELECT name FROM users WHERE id = ?').get(order.dispatcher_user_id as string) as { name: string } | undefined
          : undefined;
        createCommission(
          req.params.id, order.order_number as string,
          order.driver_id as string, driver?.name || '',
          (order.dispatcher_user_id as string | null) || null,
          dispUser?.name || null,
          order.price as number, now
        );
      }
    }
  }
  if (status === 'cancelled') {
    if (order.driver_id) {
      db.prepare(`UPDATE drivers SET status = 'available' WHERE id = ?`).run(order.driver_id);
    }
  }

  const fields = Object.keys(updates);
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  db.prepare(`UPDATE orders SET ${setClause} WHERE id = ?`).run(...Object.values(updates), req.params.id);

  db.prepare(`
    INSERT INTO order_history (id, order_id, status, notes, lat, lng, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'driver')
  `).run(uuidv4(), req.params.id, status, notes, lat || null, lng || null);

  db.prepare(`
    INSERT INTO notifications (id, type, title, message, read, related_id)
    VALUES (?, 'order', ?, ?, 0, ?)
  `).run(uuidv4(), `Order ${status.replace('_', ' ').toUpperCase()}`,
    `Order ${order.order_number} status updated to ${status}`, req.params.id);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.post('/:id/offer', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { driver_id, truck_id } = req.body;
  const now = new Date().toISOString();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!['pending', 'offered'].includes(order.status as string)) return res.status(400).json({ error: 'Order is not available to offer' });

  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(driver_id) as Record<string, unknown> | undefined;
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  db.prepare(`
    UPDATE orders SET status = 'offered', offered_to_driver_id = ?, offered_to_truck_id = ?, offered_at = ?
    WHERE id = ?
  `).run(driver_id, truck_id, now, req.params.id);

  db.prepare(`
    INSERT INTO order_history (id, order_id, status, notes, created_by)
    VALUES (?, ?, 'offered', ?, 'dispatcher')
  `).run(uuidv4(), req.params.id, `Oferta enviada al conductor ${driver.name}`);

  const driverNotifId = uuidv4();
  const driverNotifMsg = `Tienes una nueva oferta: ${order.order_number}. Tienes 60 segundos para aceptar o ignorar.`;
  db.prepare(`
    INSERT INTO notifications (id, type, title, message, read, related_id, target_driver_id)
    VALUES (?, 'order', 'Nueva oferta de carga', ?, 0, ?, ?)
  `).run(driverNotifId, driverNotifMsg, req.params.id, driver_id);

  const updated = db.prepare(`
    SELECT o.*, od.name as offered_driver_name
    FROM orders o
    LEFT JOIN drivers od ON o.offered_to_driver_id = od.id
    WHERE o.id = ?
  `).get(req.params.id);

  appEvents.emit('driver:offer', { driverId: driver_id, offer: updated });
  appEvents.emit('order:status_changed', { id: req.params.id, order_number: order.order_number, status: 'offered' });

  res.json(updated);
});

router.post('/:id/accept', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const now = new Date().toISOString();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'offered') return res.status(400).json({ error: 'Order is not in offered state' });

  const driverId = order.offered_to_driver_id as string;
  const truckId = order.offered_to_truck_id as string;

  // Only the driver the offer was sent to can accept
  if (req.user?.driver_id && req.user.driver_id !== driverId) {
    return res.status(403).json({ error: 'This offer was not sent to you' });
  }

  db.prepare(`
    UPDATE orders SET status = 'assigned', driver_id = ?, truck_id = ?, assigned_at = ?,
      offered_to_driver_id = NULL, offered_to_truck_id = NULL, offered_at = NULL
    WHERE id = ?
  `).run(driverId, truckId, now, req.params.id);

  db.prepare(`UPDATE drivers SET status = 'busy', truck_id = ? WHERE id = ?`).run(truckId, driverId);

  db.prepare(`
    INSERT INTO order_history (id, order_id, status, notes, created_by)
    VALUES (?, ?, 'assigned', 'Conductor aceptó la oferta', 'driver')
  `).run(uuidv4(), req.params.id);

  db.prepare(`
    INSERT INTO notifications (id, type, title, message, read, related_id)
    VALUES (?, 'order', '✅ Oferta Aceptada', ?, 0, ?)
  `).run(uuidv4(), `El conductor aceptó la orden ${order.order_number}`, req.params.id);

  appEvents.emit('order:status_changed', { id: req.params.id, order_number: order.order_number, status: 'assigned' });

  const updated = db.prepare(`
    SELECT o.*, d.name as driver_name, t.plate_number
    FROM orders o
    LEFT JOIN drivers d ON o.driver_id = d.id
    LEFT JOIN trucks t ON o.truck_id = t.id
    WHERE o.id = ?
  `).get(req.params.id);

  res.json(updated);
});

router.post('/:id/ignore', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'offered') return res.status(400).json({ error: 'Order is not in offered state' });

  db.prepare(`
    UPDATE orders SET status = 'pending', offered_to_driver_id = NULL, offered_to_truck_id = NULL, offered_at = NULL
    WHERE id = ?
  `).run(req.params.id);

  db.prepare(`
    INSERT INTO order_history (id, order_id, status, notes, created_by)
    VALUES (?, ?, 'pending', 'Conductor ignoró la oferta', 'driver')
  `).run(uuidv4(), req.params.id);

  db.prepare(`
    INSERT INTO notifications (id, type, title, message, read, related_id)
    VALUES (?, 'order', '❌ Oferta Ignorada', ?, 0, ?)
  `).run(uuidv4(), `El conductor ignoró la orden ${order.order_number}. Disponible para reasignar.`, req.params.id);

  appEvents.emit('order:status_changed', { id: req.params.id, order_number: order.order_number, status: 'pending' });

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  db.prepare('DELETE FROM order_history WHERE order_id = ?').run(req.params.id);
  db.prepare('DELETE FROM tracking WHERE order_id = ?').run(req.params.id);
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);

  res.json({ success: true });
});

export default router;
