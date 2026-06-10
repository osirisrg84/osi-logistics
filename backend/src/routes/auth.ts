import { Router, Request, Response } from 'express';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';

const router = Router();

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  try {
    const derived = scryptSync(password, salt, 64);
    return timingSafeEqual(derived, Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

function createSession(userId: string): string {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  db.prepare(`
    INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)
  `).run(uuidv4(), userId, token, expiresAt);
  return token;
}

router.post('/login', (req: Request, res: Response) => {
  const db = getDb();
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email.toLowerCase()) as Record<string, unknown> | undefined;

  if (!user || !verifyPassword(password, user.salt as string, user.password_hash as string)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = createSession(user.id as string);

  let driverProfile = null;
  if (user.role === 'driver' && user.driver_id) {
    driverProfile = db.prepare('SELECT * FROM drivers WHERE id = ?').get(user.driver_id as string);
  }

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      driver_id: user.driver_id,
    },
    driverProfile,
  });
});

router.post('/register', (req: Request, res: Response) => {
  const db = getDb();
  const { name, email, password, role = 'dispatcher', driver_id = null } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  if (role === 'driver' && driver_id) {
    const driver = db.prepare('SELECT id FROM drivers WHERE id = ?').get(driver_id);
    if (!driver) return res.status(400).json({ error: 'Driver profile not found' });

    const existing = db.prepare('SELECT id FROM users WHERE driver_id = ?').get(driver_id);
    if (existing) return res.status(409).json({ error: 'This driver profile already has an account' });
  }

  const salt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const id = uuidv4();

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, salt, role, driver_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, email.toLowerCase(), passwordHash, salt, role, driver_id);

  const token = createSession(id);

  let driverProfile = null;
  if (role === 'driver' && driver_id) {
    driverProfile = db.prepare('SELECT * FROM drivers WHERE id = ?').get(driver_id);
  }

  db.prepare(`
    INSERT INTO notifications (id, type, title, message, read)
    VALUES (?, 'system', 'New User Registered', ?, 0)
  `).run(uuidv4(), `${name} (${role}) has created an account.`);

  res.status(201).json({
    token,
    user: { id, name, email: email.toLowerCase(), role, driver_id },
    driverProfile,
  });
});

router.get('/me', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const db = getDb();
  const session = db.prepare(`
    SELECT s.*, u.id as uid, u.name, u.email, u.role, u.driver_id, u.active
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token) as Record<string, unknown> | undefined;

  if (!session || !session.active) return res.status(401).json({ error: 'Invalid or expired session' });

  let driverProfile = null;
  if (session.role === 'driver' && session.driver_id) {
    driverProfile = db.prepare('SELECT * FROM drivers WHERE id = ?').get(session.driver_id as string);
  }

  res.json({
    user: {
      id: session.uid,
      name: session.name,
      email: session.email,
      role: session.role,
      driver_id: session.driver_id,
    },
    driverProfile,
  });
});

router.post('/logout', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ success: true });
});

router.post('/register-driver', (req: Request, res: Response) => {
  const db = getDb();
  const {
    name, email, password, phone,
    license_number, license_expiry, hire_date,
    equipment_type = 'Dry Van', company_name = 'OSI Logistics LLC',
    mc_number = '', authority_since = '',
  } = req.body;

  if (!name || !email || !password || !phone || !license_number || !license_expiry || !hire_date) {
    return res.status(400).json({ error: 'All required fields must be filled in' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existingUser) return res.status(409).json({ error: 'An account with this email already exists' });

  const existingDriver = db.prepare('SELECT id FROM drivers WHERE email = ?').get(email.toLowerCase());
  if (existingDriver) return res.status(409).json({ error: 'A driver profile with this email already exists' });

  const driverId = uuidv4();
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);

  db.prepare(`
    INSERT INTO drivers
      (id, name, phone, email, license_number, license_expiry, status,
       current_lat, current_lng, current_address,
       rating, total_deliveries, on_time_rate, avatar, hire_date,
       equipment_type, company_name, mc_number, authority_since)
    VALUES (?, ?, ?, ?, ?, ?, 'offline', 25.7617, -80.1918, 'Miami, FL',
            5.0, 0, 100.0, ?, ?, ?, ?, ?, ?)
  `).run(driverId, name, phone, email.toLowerCase(), license_number, license_expiry,
    initials, hire_date, equipment_type, company_name, mc_number, authority_since);

  const salt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const userId = uuidv4();

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, salt, role, driver_id)
    VALUES (?, ?, ?, ?, ?, 'driver', ?)
  `).run(userId, name, email.toLowerCase(), passwordHash, salt, driverId);

  db.prepare(`
    INSERT INTO notifications (id, type, title, message, read)
    VALUES (?, 'driver', 'New Driver Registered', ?, 0)
  `).run(uuidv4(), `${name} has registered as a new driver.`);

  const token = createSession(userId);
  const driverProfile = db.prepare('SELECT * FROM drivers WHERE id = ?').get(driverId);

  res.status(201).json({
    token,
    user: { id: userId, name, email: email.toLowerCase(), role: 'driver', driver_id: driverId },
    driverProfile,
  });
});

router.get('/drivers-list', (_req: Request, res: Response) => {
  const db = getDb();
  const drivers = db.prepare(`
    SELECT d.id, d.name, d.email, d.equipment_type, d.company_name, d.mc_number,
           (SELECT COUNT(*) FROM users WHERE driver_id = d.id) as has_account
    FROM drivers d
    ORDER BY d.name ASC
  `).all();
  res.json(drivers);
});

export default router;
