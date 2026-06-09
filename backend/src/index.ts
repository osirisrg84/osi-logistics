import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { initDatabase, getDb } from './database';
import { appEvents, DriverStatusEvent } from './events';
import ordersRouter from './routes/orders';
import driversRouter from './routes/drivers';
import trucksRouter from './routes/trucks';
import trackingRouter from './routes/tracking';
import analyticsRouter from './routes/analytics';
import notificationsRouter from './routes/notifications';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import billingRouter from './routes/billing';
import { authenticate } from './middleware/auth';

const PORT = process.env.PORT || 3001;

// Build allowed origins list from env + always allow localhost for dev
const allowedOrigins: string[] = [
  'http://localhost:5173',
  'http://localhost:3000',
];
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach(u => allowedOrigins.push(u.trim()));
}

// Accept any vercel.app subdomain (preview deployments)
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true;
  return false;
}

const corsOptions = {
  origin: (origin: string | undefined, cb: (e: null, ok: boolean) => void) => cb(null, isAllowedOrigin(origin)),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: corsOptions,
});

app.use(cors(corsOptions));
app.use(express.json());

// Public routes
app.use('/api/auth', authRouter);

app.get('/api/health', (_req, res) => {
  const db = getDb();
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const driverCount = (db.prepare('SELECT COUNT(*) as c FROM drivers').get() as { c: number }).c;
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.3.0', userCount, driverCount });
});

// Temporary: force-create default users (safe to call multiple times)
app.post('/api/setup', (_req, res) => {
  const { scryptSync, randomBytes, timingSafeEqual } = require('node:crypto');
  const { v4: uuidv4 } = require('uuid');
  const db = getDb();

  function hash(pw: string, salt: string) {
    return scryptSync(pw, salt, 64).toString('hex');
  }

  const users = [
    { name: 'Admin OSI',       email: 'admin@osilogistics.com',      pw: 'Admin123!',    role: 'admin' },
    { name: 'Dispatcher OSI',  email: 'dispatcher@osilogistics.com', pw: 'Dispatch123!', role: 'dispatcher' },
  ];

  const created: string[] = [];
  for (const u of users) {
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
    if (!exists) {
      const salt = randomBytes(16).toString('hex');
      db.prepare(`INSERT INTO users (id,name,email,password_hash,salt,role,driver_id) VALUES (?,?,?,?,?,?,?)`)
        .run(uuidv4(), u.name, u.email, hash(u.pw, salt), salt, u.role, null);
      created.push(u.email);
    }
  }

  // Link Carlos Rodriguez specifically as driver account
  const driverUser = db.prepare("SELECT id FROM users WHERE email = 'carlos.r@osilogistics.com'").get();
  if (!driverUser) {
    const driver = db.prepare("SELECT id,name,email FROM drivers WHERE email = 'carlos.r@osilogistics.com' LIMIT 1").get() as Record<string,string>|undefined;
    if (driver) {
      const salt = randomBytes(16).toString('hex');
      db.prepare(`INSERT OR IGNORE INTO users (id,name,email,password_hash,salt,role,driver_id) VALUES (?,?,?,?,?,?,?)`)
        .run(uuidv4(), driver.name, driver.email, hash('Driver123!', salt), salt, 'driver', driver.id);
      created.push(driver.email);
    }
  }

  const allUsers = db.prepare('SELECT id, name, email, role, active FROM users').all();
  res.json({ created, allUsers });
});

// Protected routes
app.use('/api/orders', authenticate, ordersRouter);
app.use('/api/drivers', authenticate, driversRouter);
app.use('/api/trucks', authenticate, trucksRouter);
app.use('/api/tracking', authenticate, trackingRouter);
app.use('/api/analytics', authenticate, analyticsRouter);
app.use('/api/notifications', authenticate, notificationsRouter);
app.use('/api/admin', authenticate, adminRouter);
app.use('/api/billing', authenticate, billingRouter);

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('subscribe_tracking', () => {
    socket.join('tracking');
  });

  socket.on('subscribe_orders', () => {
    socket.join('orders');
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Simulation engine — moves drivers along routes
const MIAMI_ROUTES: Array<Array<[number, number]>> = [
  [
    [25.7617, -80.1918],
    [25.7656, -80.1935],
    [25.7745, -80.1600],
    [25.7907, -80.1300],
    [25.7850, -80.1280],
  ],
  [
    [25.7959, -80.2870],
    [25.8050, -80.2800],
    [25.8195, -80.3200],
    [25.8195, -80.3556],
    [25.8100, -80.3400],
  ],
  [
    [25.7215, -80.2684],
    [25.7400, -80.2400],
    [25.7600, -80.2100],
    [25.7741, -80.1977],
    [25.7800, -80.1900],
  ],
  [
    [25.8576, -80.2781],
    [25.8400, -80.2600],
    [25.8200, -80.2400],
    [25.8000, -80.2200],
    [25.7900, -80.2000],
  ],
  [
    [25.7997, -80.1992],
    [25.8100, -80.2100],
    [25.8200, -80.2400],
    [25.8300, -80.2600],
    [25.8400, -80.2800],
  ],
];

interface DriverSimState {
  id: string;
  routeIndex: number;
  waypointIndex: number;
  progress: number;
}

const simStates: Map<string, DriverSimState> = new Map();

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function addToSimulation(driverId: string): void {
  if (!simStates.has(driverId)) {
    simStates.set(driverId, {
      id: driverId,
      routeIndex: simStates.size % MIAMI_ROUTES.length,
      waypointIndex: 0,
      progress: Math.random(),
    });
  }
}

function startSimulation(): void {
  const db = getDb();

  // Seed initial online drivers
  const onlineDrivers = db.prepare(`
    SELECT id FROM drivers WHERE status IN ('busy', 'available', 'on_break') LIMIT 5
  `).all() as Array<{ id: string }>;

  onlineDrivers.forEach(d => addToSimulation(d.id));

  // React to driver status changes
  appEvents.on('driver:status_changed', (event: DriverStatusEvent) => {
    // Broadcast to all dispatcher clients subscribed to tracking
    io.to('tracking').emit('driver_status_changed', event);

    if (event.status !== 'offline') {
      addToSimulation(event.id);
    } else {
      simStates.delete(event.id);
      // Tell dispatchers to remove this driver from the map
      io.to('tracking').emit('driver_went_offline', { id: event.id });
    }
  });

  setInterval(() => {
    const db = getDb();
    const liveData: unknown[] = [];

    simStates.forEach((state) => {
      const route = MIAMI_ROUTES[state.routeIndex];
      const wpIdx = state.waypointIndex;
      const nextIdx = (wpIdx + 1) % route.length;

      const [fromLat, fromLng] = route[wpIdx];
      const [toLat, toLng] = route[nextIdx];

      state.progress += 0.03 + Math.random() * 0.02;
      if (state.progress >= 1) {
        state.progress = 0;
        state.waypointIndex = nextIdx;
        if (nextIdx === 0) {
          state.routeIndex = (state.routeIndex + 1) % MIAMI_ROUTES.length;
        }
      }

      const lat = lerp(fromLat, toLat, state.progress);
      const lng = lerp(fromLng, toLng, state.progress);
      const speed = 30 + Math.random() * 40;
      const heading = Math.atan2(toLng - fromLng, toLat - fromLat) * (180 / Math.PI);

      db.prepare(`
        UPDATE drivers SET current_lat = ?, current_lng = ? WHERE id = ?
      `).run(lat, lng, state.id);

      db.prepare(`
        INSERT INTO tracking (id, driver_id, lat, lng, speed, heading)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), state.id, lat, lng, speed, heading);

      liveData.push({ driver_id: state.id, lat, lng, speed, heading, timestamp: new Date().toISOString() });
    });

    if (liveData.length > 0) {
      io.to('tracking').emit('location_update', liveData);
    }

    // Simulate occasional order status updates
    if (Math.random() < 0.05) {
      const transitOrder = db.prepare(`
        SELECT id, order_number, driver_id FROM orders WHERE status = 'in_transit' LIMIT 1
      `).get() as Record<string, unknown> | undefined;

      if (transitOrder && Math.random() < 0.3) {
        const now = new Date().toISOString();
        db.prepare(`
          UPDATE orders SET status = 'delivered', delivered_at = ?, actual_delivery = ?
          WHERE id = ?
        `).run(now, now, transitOrder.id);

        if (transitOrder.driver_id) {
          db.prepare(`
            UPDATE drivers SET status = 'available', total_deliveries = total_deliveries + 1
            WHERE id = ?
          `).run(transitOrder.driver_id);
        }

        const notifId = uuidv4();
        db.prepare(`
          INSERT INTO notifications (id, type, title, message, read, related_id)
          VALUES (?, 'order', 'Delivery Completed', ?, 0, ?)
        `).run(notifId, `Order ${transitOrder.order_number} has been delivered successfully!`, transitOrder.id);

        io.to('orders').emit('order_updated', {
          id: transitOrder.id,
          order_number: transitOrder.order_number,
          status: 'delivered',
        });

        io.emit('notification', {
          id: notifId,
          type: 'order',
          title: 'Delivery Completed',
          message: `Order ${transitOrder.order_number} has been delivered successfully!`,
          created_at: now,
        });
      }
    }
  }, 3000);
}

initDatabase();

httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`\n🚛 OSI Logistics Backend running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`🔌 Socket.io ready for real-time tracking\n`);
  startSimulation();
  startKeepAlive();
});

function startKeepAlive(): void {
  if (process.env.NODE_ENV !== 'production') return;

  // Render free tier sleeps after 15 min inactivity — self-ping every 14 min
  const selfUrl = `${process.env.RENDER_EXTERNAL_URL || 'https://osi-logistics-backend.onrender.com'}/api/health`;
  console.log(`💓 Keep-alive enabled → pinging ${selfUrl} every 14 min`);

  setInterval(async () => {
    try {
      const res = await fetch(selfUrl);
      if (res.ok) console.log(`💓 Keep-alive ping OK (${new Date().toISOString()})`);
    } catch {
      // silently ignore — next ping will retry
    }
  }, 14 * 60 * 1000);
}

export { io };
