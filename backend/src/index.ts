import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { initDatabase, switchToLocalSqlite, exec, query, queryOne } from './database';
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
import pushRouter, { sendPushToAll } from './routes/push';
import chatRouter from './routes/chat';
import { authenticate } from './middleware/auth';

const PORT = process.env.PORT || 3001;

const allowedOrigins: string[] = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://osilogistics.com',
  'https://www.osilogistics.com',
];
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach(u => allowedOrigins.push(u.trim()));
}

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
const io = new Server(httpServer, { cors: corsOptions });

app.use(cors(corsOptions));
app.use(express.json());

// Public routes
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);

app.get('/api/health', async (_req, res) => {
  try {
    const [userRow, driverRow] = await Promise.all([
      queryOne<{c:number}>('SELECT COUNT(*) as c FROM users'),
      queryOne<{c:number}>('SELECT COUNT(*) as c FROM drivers'),
    ]);
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.5.0',
               userCount: userRow?.c ?? 0, driverCount: driverRow?.c ?? 0 });
  } catch {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.5.0' });
  }
});

app.post('/api/setup', async (_req, res) => {
  try {
    const { scryptSync, randomBytes } = await import('node:crypto');

    function hashPw(pw: string, salt: string) {
      return scryptSync(pw, salt, 64).toString('hex');
    }

    const users = [
      { name: 'Admin OSI',      email: 'admin@osilogistics.com',      pw: 'Admin123!',    role: 'admin' },
      { name: 'Dispatcher OSI', email: 'dispatcher@osilogistics.com', pw: 'Dispatch123!', role: 'dispatcher' },
    ];

    const created: string[] = [];
    for (const u of users) {
      const exists = await queryOne('SELECT id FROM users WHERE email = ?', [u.email]);
      if (!exists) {
        const salt = randomBytes(16).toString('hex');
        await exec('INSERT INTO users (id,name,email,password_hash,salt,role,driver_id) VALUES (?,?,?,?,?,?,?)',
          [uuidv4(), u.name, u.email, hashPw(u.pw, salt), salt, u.role, null]);
        created.push(u.email);
      }
    }

    const driverUser = await queryOne("SELECT id FROM users WHERE email='carlos.r@osilogistics.com'");
    if (!driverUser) {
      const driver = await queryOne<{id:string;name:string;email:string}>(
        "SELECT id,name,email FROM drivers WHERE email='carlos.r@osilogistics.com' LIMIT 1"
      );
      if (driver) {
        const salt = randomBytes(16).toString('hex');
        await exec('INSERT OR IGNORE INTO users (id,name,email,password_hash,salt,role,driver_id) VALUES (?,?,?,?,?,?,?)',
          [uuidv4(), driver.name, driver.email, hashPw('Driver123!', salt), salt, 'driver', driver.id]);
        created.push(driver.email);
      }
    }

    const allUsers = await query('SELECT id, name, email, role, active FROM users');
    res.json({ created, allUsers });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
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
app.use('/api/push', pushRouter);

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('subscribe_tracking',    () => socket.join('tracking'));
  socket.on('subscribe_orders',      () => socket.join('orders'));
  socket.on('subscribe_dispatchers', () => socket.join('dispatchers'));
  socket.on('driver:subscribe', (driverId: string) => socket.join(`driver:${driverId}`));
  socket.on('radio:join', () => socket.join('osi_radio'));

  socket.on('radio:msg', (data: { name: string; msg: string }) => {
    if (!data.msg?.trim() || !data.name?.trim()) return;
    io.to('osi_radio').emit('radio:msg', {
      name: data.name.slice(0, 50),
      msg: data.msg.slice(0, 200),
      ts: new Date().toISOString(),
    });
  });

  socket.on('radio:voice', (data: { name: string; audioData: string; duration: number }) => {
    if (!data.audioData || !data.name?.trim()) return;
    if (data.audioData.length > 2_000_000) return;
    io.to('osi_radio').emit('radio:voice', {
      name: data.name.slice(0, 50),
      audioData: data.audioData,
      duration: Math.min(data.duration || 0, 60),
      ts: new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => console.log(`Client disconnected: ${socket.id}`));
});

// Simulation engine — moves drivers along routes
const MIAMI_ROUTES: Array<Array<[number, number]>> = [
  [[25.7617,-80.1918],[25.7656,-80.1935],[25.7745,-80.1600],[25.7907,-80.1300],[25.7850,-80.1280]],
  [[25.7959,-80.2870],[25.8050,-80.2800],[25.8195,-80.3200],[25.8195,-80.3556],[25.8100,-80.3400]],
  [[25.7215,-80.2684],[25.7400,-80.2400],[25.7600,-80.2100],[25.7741,-80.1977],[25.7800,-80.1900]],
  [[25.8576,-80.2781],[25.8400,-80.2600],[25.8200,-80.2400],[25.8000,-80.2200],[25.7900,-80.2000]],
  [[25.7997,-80.1992],[25.8100,-80.2100],[25.8200,-80.2400],[25.8300,-80.2600],[25.8400,-80.2800]],
];

interface DriverSimState { id: string; routeIndex: number; waypointIndex: number; progress: number; }
const simStates: Map<string, DriverSimState> = new Map();

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

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

const DEMO_EMAIL_SUFFIX = '@osilogistics.com';

async function isDemoDriver(driverId: string): Promise<boolean> {
  const row = await queryOne<{email:string}>('SELECT email FROM drivers WHERE id = ?', [driverId]);
  return !!row?.email?.endsWith(DEMO_EMAIL_SUFFIX);
}

async function startSimulation(): Promise<void> {
  const onlineDrivers = await query<{id:string}>(`
    SELECT id FROM drivers WHERE status IN ('busy','available','on_break')
    AND email LIKE '%${DEMO_EMAIL_SUFFIX}' LIMIT 5
  `);
  onlineDrivers.forEach(d => addToSimulation(d.id));

  appEvents.on('driver:notification', ({ driverId, notification }: { driverId: string; notification: unknown }) => {
    io.to(`driver:${driverId}`).emit('driver:notification', notification);
  });

  appEvents.on('driver:offer', ({ driverId, offer }: { driverId: string; offer: unknown }) => {
    io.to(`driver:${driverId}`).emit('driver:offer', offer);
  });

  appEvents.on('order:status_changed', (data: unknown) => {
    io.to('orders').emit('order_updated', data);
  });

  appEvents.on('dispatcher:shift_changed', (event: { id: string; name: string; active: boolean }) => {
    io.to('dispatchers').emit('dispatcher_shift_changed', event);
  });

  appEvents.on('driver:status_changed', (event: DriverStatusEvent) => {
    io.to('tracking').emit('driver_status_changed', event);
    io.to('dispatchers').emit('driver_status_changed', event);

    if (event.status === 'available') {
      sendPushToAll({
        title: '🟢 Driver Online',
        body: `${event.name} está disponible y listo para entregas`,
        driverId: event.id,
      });
    }

    if (event.status !== 'offline') {
      isDemoDriver(event.id).then(isDemo => { if (isDemo) addToSimulation(event.id); });
    } else {
      simStates.delete(event.id);
      io.to('tracking').emit('driver_went_offline', { id: event.id });
    }
  });

  setInterval(async () => {
    const liveData: unknown[] = [];

    simStates.forEach((state) => {
      const route = MIAMI_ROUTES[state.routeIndex];
      const wpIdx = state.waypointIndex;
      const nextIdx = (wpIdx + 1) % route.length;

      const [fromLat, fromLng] = route[wpIdx];
      const [toLat, toLng]     = route[nextIdx];

      state.progress += 0.03 + Math.random() * 0.02;
      if (state.progress >= 1) {
        state.progress = 0;
        state.waypointIndex = nextIdx;
        if (nextIdx === 0) state.routeIndex = (state.routeIndex + 1) % MIAMI_ROUTES.length;
      }

      const lat     = lerp(fromLat, toLat, state.progress);
      const lng     = lerp(fromLng, toLng, state.progress);
      const speed   = 30 + Math.random() * 40;
      const heading = Math.atan2(toLng - fromLng, toLat - fromLat) * (180 / Math.PI);

      liveData.push({ driver_id: state.id, lat, lng, speed, heading, timestamp: new Date().toISOString() });

      // Fire-and-forget DB writes (don't await inside setInterval)
      exec('UPDATE drivers SET current_lat=?, current_lng=? WHERE id=?', [lat, lng, state.id]).catch(() => {});
      exec('INSERT INTO tracking (id,driver_id,lat,lng,speed,heading) VALUES (?,?,?,?,?,?)',
        [uuidv4(), state.id, lat, lng, speed, heading]).catch(() => {});
    });

    if (liveData.length > 0) io.to('tracking').emit('location_update', liveData);

    // Occasionally auto-complete an in_transit order
    if (Math.random() < 0.05) {
      try {
        const transitOrder = await queryOne<{id:string;order_number:string;driver_id:string}>(
          "SELECT id, order_number, driver_id FROM orders WHERE status='in_transit' LIMIT 1"
        );
        if (transitOrder && Math.random() < 0.3) {
          const now = new Date().toISOString();
          await exec("UPDATE orders SET status='delivered', delivered_at=?, actual_delivery=? WHERE id=?",
            [now, now, transitOrder.id]);

          if (transitOrder.driver_id) {
            await exec('UPDATE drivers SET status=\'available\', total_deliveries=total_deliveries+1 WHERE id=?',
              [transitOrder.driver_id]);
          }

          const notifId = uuidv4();
          await exec("INSERT INTO notifications (id,type,title,message,read,related_id) VALUES (?,'order','Delivery Completed',?,0,?)",
            [notifId, `Order ${transitOrder.order_number} has been delivered successfully!`, transitOrder.id]);

          io.to('orders').emit('order_updated', {
            id: transitOrder.id, order_number: transitOrder.order_number, status: 'delivered',
          });
          io.emit('notification', {
            id: notifId, type: 'order', title: 'Delivery Completed',
            message: `Order ${transitOrder.order_number} has been delivered successfully!`,
            created_at: now,
          });
        }
      } catch { /* non-critical */ }
    }
  }, 3000);
}

function startKeepAlive(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const selfUrl = `${process.env.RENDER_EXTERNAL_URL || 'https://osi-logistics-backend.onrender.com'}/api/health`;
  console.log(`💓 Keep-alive enabled → pinging ${selfUrl} every 14 min`);
  setInterval(async () => {
    try { await fetch(selfUrl); } catch { /* ignore */ }
  }, 14 * 60 * 1000);
}

(async () => {
  const tursoUrl = process.env.TURSO_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();
  console.log(`\n🚛 OSI Logistics — Node ${process.version}`);
  console.log(`   DB      : ${tursoUrl ? tursoUrl.replace(/^(libsql:\/\/[^/]{0,30}).*/, '$1...') : 'local SQLite (TURSO_URL not set)'}`);
  console.log(`   Token   : ${tursoToken ? `set (${tursoToken.length} chars)` : 'NOT SET'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV ?? 'undefined'}\n`);

  // Errors like 400/401/403 are permanent — no point retrying, switch to SQLite immediately.
  // Transient errors (network, 5xx) get up to 3 retries.
  const isPermanentError = (err: unknown) =>
    err instanceof Error && /HTTP status (400|401|403)|Unauthorized|Forbidden/i.test(err.message);

  let dbReady = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await initDatabase();
      dbReady = true;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isPermanentError(err)) {
        console.error(`❌ Turso permanent error (${msg}) — switching to local SQLite immediately`);
        break;
      }
      console.error(`❌ DB init attempt ${attempt}/3: ${msg}`);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }
  }

  if (!dbReady) {
    switchToLocalSqlite();
    try {
      await initDatabase();
    } catch (localErr) {
      console.error('💀 Fatal: local SQLite also failed:', localErr);
      process.exit(1);
    }
  }

  httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`\n🚛 OSI Logistics Backend running on port ${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}/api`);
    console.log(`🔌 Socket.io ready for real-time tracking\n`);
  });

  await startSimulation();
  startKeepAlive();
})();

export { io };
