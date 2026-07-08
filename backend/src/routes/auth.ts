import { Router, Request, Response } from 'express';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { exec, query, queryOne } from '../database';
import { appEvents } from '../events';
import { sendVerificationCode } from '../email';
import { sendSmsCode } from '../sms';

const router = Router();

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  try {
    const derived = scryptSync(password, salt, 64);
    return timingSafeEqual(derived, Buffer.from(storedHash, 'hex'));
  } catch { return false; }
}

async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await exec('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
    [uuidv4(), userId, token, expiresAt]);
  return token;
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user || !verifyPassword(password, user.salt as string, user.password_hash as string)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.approval_status === 'pending') {
      return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación por el administrador. Te notificaremos cuando sea activada.' });
    }
    if (user.approval_status === 'rejected') {
      return res.status(403).json({ error: 'Tu solicitud de cuenta fue rechazada. Contacta al administrador para más información.' });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'Esta cuenta está desactivada. Contacta al administrador.' });
    }

    const token = await createSession(user.id as string);
    let driverProfile = null;
    if (user.role === 'driver' && user.driver_id) {
      driverProfile = await queryOne('SELECT * FROM drivers WHERE id = ?', [user.driver_id as string]);
    }

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, driver_id: user.driver_id },
      driverProfile,
    });
  } catch { res.status(500).json({ error: 'Login failed' }); }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      name, email, password, role = 'dispatcher', driver_id = null,
      phone = '', date_of_birth = '', city = '',
      years_experience = 0, previous_companies = '', languages = '', availability = 'full-time',
      equipment_experience = '',
    } = req.body;

    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    if (role === 'driver' && driver_id) {
      const driver = await queryOne('SELECT id FROM drivers WHERE id = ?', [driver_id]);
      if (!driver) return res.status(400).json({ error: 'Driver profile not found' });
      const existingDriver = await queryOne('SELECT id FROM users WHERE driver_id = ?', [driver_id]);
      if (existingDriver) return res.status(409).json({ error: 'This driver profile already has an account' });
    }

    const salt = randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const id = uuidv4();

    const genCode = async (): Promise<string> => {
      const code = String(Math.floor(10000000 + Math.random() * 90000000));
      const exists = await queryOne("SELECT id FROM users WHERE dispatcher_code = ?", [code]);
      return exists ? genCode() : code;
    };
    const dispatcher_code = role === 'dispatcher' ? await genCode() : '';

    await exec(`INSERT INTO users
      (id, name, email, password_hash, salt, role, driver_id,
       phone, date_of_birth, city, years_experience, previous_companies, languages, availability, equipment_experience, dispatcher_code,
       active, approval_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending')`,
      [id, name, email.toLowerCase(), passwordHash, salt, role, driver_id,
       phone, date_of_birth, city, years_experience, previous_companies, languages, availability, equipment_experience, dispatcher_code]);

    await exec("INSERT INTO notifications (id, type, title, message, read) VALUES (?, 'system', 'Nueva Cuenta Pendiente de Aprobación', ?, 0)",
      [uuidv4(), `${name} (${role}) se registró y está esperando aprobación.`]);

    res.status(201).json({ pending: true, message: 'Tu cuenta fue creada exitosamente. Un administrador la revisará y activará pronto.' });
  } catch (err: unknown) {
    const msg = (err as { code?: string })?.code === 'SQLITE_CONSTRAINT'
      ? 'An account with this email already exists' : 'Registration failed';
    res.status(500).json({ error: msg });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const session = await queryOne<Record<string, unknown>>(`
      SELECT s.*, u.id as uid, u.name, u.email, u.role, u.driver_id, u.active
      FROM sessions s JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `, [token]);

    if (!session || !session.active) return res.status(401).json({ error: 'Invalid or expired session' });

    let driverProfile = null;
    if (session.role === 'driver' && session.driver_id) {
      driverProfile = await queryOne('SELECT * FROM drivers WHERE id = ?', [session.driver_id as string]);
    }

    res.json({
      user: { id: session.uid, name: session.name, email: session.email, role: session.role, driver_id: session.driver_id },
      driverProfile,
    });
  } catch { res.status(500).json({ error: 'Failed to get user' }); }
});

router.post('/logout', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) await exec('DELETE FROM sessions WHERE token = ?', [token]).catch(() => {});
  res.json({ success: true });
});

router.post('/register-driver', async (req: Request, res: Response) => {
  try {
    const {
      name, email, password, phone,
      license_number, license_expiry,
      hire_date = new Date().toISOString().split('T')[0],
      equipment_type = 'Dry Van', company_name = 'OSI Logistics LLC',
      mc_number = '', dot_number = '', authority_since = '',
    } = req.body;

    if (!name || !email || !password || !phone || !license_number || !license_expiry) {
      return res.status(400).json({ error: 'All required fields must be filled in' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existingUser = await queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingUser) return res.status(409).json({ error: 'An account with this email already exists' });

    const existingDriver = await queryOne('SELECT id FROM drivers WHERE email = ?', [email.toLowerCase()]);
    if (existingDriver) return res.status(409).json({ error: 'A driver profile with this email already exists' });

    const driverId = uuidv4();
    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);

    const genDriverCode = async (): Promise<string> => {
      const code = String(Math.floor(10000000 + Math.random() * 90000000));
      const exists = await queryOne("SELECT id FROM drivers WHERE driver_code = ?", [code]);
      return exists ? genDriverCode() : code;
    };
    const driver_code = await genDriverCode();

    await exec(`INSERT INTO drivers
      (id, name, phone, email, license_number, license_expiry, status,
       current_lat, current_lng, current_address,
       rating, total_deliveries, on_time_rate, avatar, hire_date,
       equipment_type, company_name, mc_number, dot_number, authority_since, driver_code)
      VALUES (?, ?, ?, ?, ?, ?, 'offline', 25.7617, -80.1918, 'Miami, FL',
              5.0, 0, 100.0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [driverId, name, phone, email.toLowerCase(), license_number, license_expiry,
       initials, hire_date, equipment_type, company_name, mc_number, dot_number, authority_since, driver_code]);

    const salt = randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const userId = uuidv4();

    await exec("INSERT INTO users (id, name, email, password_hash, salt, role, driver_id, active, approval_status) VALUES (?, ?, ?, ?, ?, 'driver', ?, 0, 'pending')",
      [userId, name, email.toLowerCase(), passwordHash, salt, driverId]);

    await exec("INSERT INTO notifications (id, type, title, message, read) VALUES (?, 'driver', 'Nuevo Driver Pendiente de Aprobación', ?, 0)",
      [uuidv4(), `${name} se registró como conductor y está esperando aprobación.`]);

    res.status(201).json({ pending: true, message: 'Tu cuenta fue creada exitosamente. Un administrador la revisará y activará pronto.' });
  } catch (err: unknown) {
    const msg = (err as { code?: string })?.code === 'SQLITE_CONSTRAINT'
      ? 'An account with this email already exists' : 'Registration failed';
    res.status(500).json({ error: msg });
  }
});

router.get('/profile', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });
    const row = await queryOne<{
      payout_method: string; payout_details: string; ssn: string; dispatcher_code: string;
      phone: string; availability: string; languages: string; years_experience: number;
      city: string; date_of_birth: string; previous_companies: string; equipment_experience: string;
      shift_active: number; email_verified: number; phone_verified: number;
    }>(`
      SELECT u.payout_method, u.payout_details, u.ssn, u.dispatcher_code,
             u.phone, u.availability, u.languages, u.years_experience,
             u.city, u.date_of_birth, u.previous_companies, u.equipment_experience,
             u.shift_active, u.email_verified, u.phone_verified
      FROM sessions s JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `, [token]);
    if (!row) return res.status(401).json({ error: 'Invalid session' });
    res.json({
      payout_method:        row.payout_method,
      payout_details:       row.payout_details,
      ssn:                  row.ssn,
      dispatcher_code:      row.dispatcher_code,
      phone:                row.phone,
      availability:         row.availability,
      languages:            row.languages,
      years_experience:     row.years_experience,
      city:                 row.city,
      date_of_birth:        row.date_of_birth,
      previous_companies:   row.previous_companies,
      equipment_experience: row.equipment_experience,
      shift_active:         row.shift_active,
      email_verified:       !!row.email_verified,
      phone_verified:       !!row.phone_verified,
    });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/profile', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });
    const session = await queryOne<{ user_id: string }>('SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime(\'now\')', [token]);
    if (!session) return res.status(401).json({ error: 'Invalid session' });
    const {
      payout_method, payout_details, ssn,
      phone, availability, languages, years_experience,
      city, date_of_birth, previous_companies, equipment_experience,
    } = req.body;
    const updates: string[] = [];
    const vals: unknown[] = [];
    if (payout_method        !== undefined) { updates.push('payout_method = ?');        vals.push(payout_method); }
    if (payout_details       !== undefined) { updates.push('payout_details = ?');       vals.push(payout_details); }
    if (ssn                  !== undefined) { updates.push('ssn = ?');                  vals.push(ssn); }
    if (phone                !== undefined) { updates.push('phone = ?');                vals.push(phone); }
    if (availability         !== undefined) { updates.push('availability = ?');         vals.push(availability); }
    if (languages            !== undefined) { updates.push('languages = ?');            vals.push(languages); }
    if (years_experience     !== undefined) { updates.push('years_experience = ?');     vals.push(years_experience); }
    if (city                 !== undefined) { updates.push('city = ?');                 vals.push(city); }
    if (date_of_birth        !== undefined) { updates.push('date_of_birth = ?');        vals.push(date_of_birth); }
    if (previous_companies   !== undefined) { updates.push('previous_companies = ?');   vals.push(previous_companies); }
    if (equipment_experience !== undefined) { updates.push('equipment_experience = ?'); vals.push(equipment_experience); }
    if (updates.length) {
      vals.push(session.user_id);
      await exec(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, vals);
    }
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/shift', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });
    const session = await queryOne<{ user_id: string }>(
      "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')", [token]
    );
    if (!session) return res.status(401).json({ error: 'Invalid session' });

    const active = !!req.body.active;
    await exec("UPDATE users SET shift_active = ?, shift_changed_at = datetime('now') WHERE id = ?",
      [active ? 1 : 0, session.user_id]);

    const user = await queryOne<{ id: string; name: string }>('SELECT id, name FROM users WHERE id = ?', [session.user_id]);
    if (user) appEvents.emit('dispatcher:shift_changed', { id: user.id, name: user.name, active });

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Send verification code ──────────────────────────────────────────
router.post('/send-verification', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });
    const session = await queryOne<{ user_id: string; name: string; email: string; phone: string }>(
      `SELECT s.user_id, u.name, u.email, u.phone FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > datetime('now')`, [token]
    );
    if (!session) return res.status(401).json({ error: 'Invalid session' });

    const { type } = req.body as { type: 'email' | 'phone' };
    if (!['email', 'phone'].includes(type)) return res.status(400).json({ error: 'type must be email or phone' });

    if (type === 'phone' && !session.phone)
      return res.status(400).json({ error: 'No tienes un número de teléfono guardado en tu perfil' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await exec("DELETE FROM verification_codes WHERE user_id = ? AND type = ?", [session.user_id, type]);
    await exec(
      "INSERT INTO verification_codes (id, user_id, code, type, expires_at, used) VALUES (?, ?, ?, ?, ?, 0)",
      [uuidv4(), session.user_id, code, type, expires]
    );

    if (type === 'phone') {
      // Normalizar número: asegurar que tenga +1 si es de USA
      let phone = session.phone.replace(/\D/g, '');
      if (phone.length === 10) phone = '+1' + phone;
      else if (!phone.startsWith('+')) phone = '+' + phone;
      await sendSmsCode(phone, code);
    } else {
      await sendVerificationCode(session.email, session.name, code, type);
    }

    res.json({ sent: true });
  } catch (e) {
    const err = e as Record<string, unknown>;
    const msg = (err.message as string) || JSON.stringify(err);
    console.error('[send-verification] error:', msg, err.code, err.status);
    res.status(500).json({ error: msg.includes('Twilio not configured') ? 'SMS no configurado.' : msg });
  }
});

// ── Verify code ────────────────────────────────────────────────────
router.post('/verify-code', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });
    const session = await queryOne<{ user_id: string }>(
      `SELECT s.user_id FROM sessions s
       WHERE s.token = ? AND s.expires_at > datetime('now')`, [token]
    );
    if (!session) return res.status(401).json({ error: 'Invalid session' });

    const { type, code } = req.body as { type: 'email' | 'phone'; code: string };
    const row = await queryOne<{ id: string; code: string; expires_at: string; used: number }>(
      "SELECT * FROM verification_codes WHERE user_id = ? AND type = ? AND used = 0 ORDER BY expires_at DESC LIMIT 1",
      [session.user_id, type]
    );
    if (!row) return res.status(400).json({ error: 'No hay código pendiente' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Código expirado' });
    if (row.code !== String(code).trim()) return res.status(400).json({ error: 'Código incorrecto' });

    await exec("UPDATE verification_codes SET used = 1 WHERE id = ?", [row.id]);
    const field = type === 'email' ? 'email_verified' : 'phone_verified';
    await exec(`UPDATE users SET ${field} = 1 WHERE id = ?`, [session.user_id]);
    res.json({ verified: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Update account name/email ─────────────────────────────────────
router.put('/account', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });
    const session = await queryOne<{ user_id: string }>(
      "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')", [token]
    );
    if (!session) return res.status(401).json({ error: 'Sesión inválida' });
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    await exec('UPDATE users SET name = ? WHERE id = ?', [name.trim(), session.user_id]);
    res.json({ success: true, name: name.trim() });
  } catch { res.status(500).json({ error: 'Error al actualizar cuenta' }); }
});

// ── Change password ───────────────────────────────────────────────
router.put('/change-password', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });

    const session = await queryOne<{ user_id: string }>(
      "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')", [token]
    );
    if (!session) return res.status(401).json({ error: 'Sesión inválida' });

    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Completa todos los campos' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' });

    const user = await queryOne<{ id: string; password_hash: string; salt: string }>(
      'SELECT id, password_hash, salt FROM users WHERE id = ?', [session.user_id]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!verifyPassword(current_password, user.salt, user.password_hash))
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });

    const newSalt = randomBytes(16).toString('hex');
    const newHash = hashPassword(new_password, newSalt);
    await exec('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?', [newHash, newSalt, user.id]);
    await exec('DELETE FROM sessions WHERE user_id = ? AND token != ?', [user.id, token]);

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error al cambiar contraseña' }); }
});

// One-time admin creation — no secret needed if zero admins exist, otherwise requires ADMIN_SETUP_SECRET
router.post('/setup-admin', async (req: Request, res: Response) => {
  try {
    const { secret, name, email, password } = req.body;
    const realAdmins = await queryOne<{ c: number }>("SELECT COUNT(*) as c FROM users WHERE role='admin' AND active=1 AND email != 'admin@osilogistics.com'");
    const hasRealAdmin = (realAdmins?.c ?? 0) > 0;
    if (hasRealAdmin) {
      const expected = process.env.ADMIN_SETUP_SECRET;
      if (!expected || secret !== expected) return res.status(403).json({ error: 'Ya existe un admin real. Se requiere el secret.' });
    }
    if (!name || !email || !password || password.length < 8)
      return res.status(400).json({ error: 'name, email y password (mín. 8 chars) son requeridos' });

    const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    const salt = randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    if (existing) {
      await exec(
        "UPDATE users SET name=?, password_hash=?, salt=?, role='admin', active=1, approval_status='approved' WHERE id=?",
        [name, hash, salt, existing.id]
      );
      return res.json({ updated: true, email: email.toLowerCase() });
    }
    await exec(
      "INSERT INTO users (id, name, email, password_hash, salt, role, active, approval_status) VALUES (?, ?, ?, ?, ?, 'admin', 1, 'approved')",
      [uuidv4(), name, email.toLowerCase(), hash, salt]
    );
    res.status(201).json({ created: true, email: email.toLowerCase() });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/drivers-list', async (_req: Request, res: Response) => {
  try {
    const drivers = await query(`
      SELECT d.id, d.name, d.email, d.equipment_type, d.company_name, d.mc_number,
             (SELECT COUNT(*) FROM users WHERE driver_id = d.id) as has_account
      FROM drivers d ORDER BY d.name ASC
    `);
    res.json(drivers);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
