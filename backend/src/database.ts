import { createClient, Client } from '@libsql/client';
import { scryptSync, randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

let _db: Client;

export function getDb(): Client {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_URL || 'file:./osi_logistics.db',
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
  }
  return _db;
}

type ArgValue = null | boolean | number | bigint | string | ArrayBuffer;

function toArgs(args: unknown[]): ArgValue[] {
  return args.map(a => (a === undefined ? null : a) as ArgValue);
}

export async function exec(sql: string, args: unknown[] = []): Promise<void> {
  await getDb().execute({ sql, args: toArgs(args) });
}

export async function query<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> {
  const result = await getDb().execute({ sql, args: toArgs(args) });
  return result.rows as unknown as T[];
}

export async function queryOne<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T | undefined> {
  const result = await getDb().execute({ sql, args: toArgs(args) });
  return result.rows.length > 0 ? (result.rows[0] as unknown as T) : undefined;
}

async function addColumnIfMissing(table: string, col: string, def: string): Promise<void> {
  const cols = await query<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some(c => c.name === col)) {
    await exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  }
}

export async function initDatabase(): Promise<void> {
  const db = getDb();

  // Create tables
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      license_number TEXT NOT NULL,
      license_expiry TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      current_lat REAL NOT NULL DEFAULT 25.7617,
      current_lng REAL NOT NULL DEFAULT -80.1918,
      current_address TEXT NOT NULL DEFAULT 'Miami, FL',
      truck_id TEXT,
      rating REAL NOT NULL DEFAULT 5.0,
      total_deliveries INTEGER NOT NULL DEFAULT 0,
      on_time_rate REAL NOT NULL DEFAULT 100.0,
      avatar TEXT NOT NULL DEFAULT '',
      hire_date TEXT NOT NULL,
      equipment_type TEXT NOT NULL DEFAULT 'Dry Van',
      company_name TEXT NOT NULL DEFAULT 'OSI Logistics LLC',
      mc_number TEXT NOT NULL DEFAULT '',
      authority_since TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS trucks (
      id TEXT PRIMARY KEY,
      plate_number TEXT NOT NULL UNIQUE,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'Box Truck',
      capacity_kg REAL NOT NULL DEFAULT 5000,
      capacity_m3 REAL NOT NULL DEFAULT 20,
      status TEXT NOT NULL DEFAULT 'active',
      mileage INTEGER NOT NULL DEFAULT 0,
      fuel_level INTEGER NOT NULL DEFAULT 100,
      last_maintenance TEXT NOT NULL,
      next_maintenance TEXT NOT NULL,
      vin TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT 'White',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL DEFAULT '',
      pickup_address TEXT NOT NULL,
      pickup_lat REAL NOT NULL,
      pickup_lng REAL NOT NULL,
      pickup_contact TEXT NOT NULL DEFAULT '',
      delivery_address TEXT NOT NULL,
      delivery_lat REAL NOT NULL,
      delivery_lng REAL NOT NULL,
      delivery_contact TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'normal',
      weight_kg REAL NOT NULL DEFAULT 0,
      volume_m3 REAL NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      driver_id TEXT,
      truck_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      assigned_at TEXT,
      picked_up_at TEXT,
      in_transit_at TEXT,
      delivered_at TEXT,
      estimated_delivery TEXT,
      actual_delivery TEXT,
      price REAL NOT NULL DEFAULT 0,
      distance_km REAL NOT NULL DEFAULT 0,
      proof_of_delivery TEXT,
      dispatcher_user_id TEXT,
      offered_to_driver_id TEXT,
      offered_to_truck_id TEXT,
      offered_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS order_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT NOT NULL DEFAULT '',
      lat REAL,
      lng REAL,
      created_by TEXT NOT NULL DEFAULT 'system'
    )`,
    `CREATE TABLE IF NOT EXISTS tracking (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      order_id TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      speed REAL NOT NULL DEFAULT 0,
      heading REAL NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'system',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      related_id TEXT,
      target_driver_id TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'dispatcher',
      driver_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      phone TEXT NOT NULL DEFAULT '',
      ssn TEXT NOT NULL DEFAULT '',
      date_of_birth TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      years_experience INTEGER NOT NULL DEFAULT 0,
      previous_companies TEXT NOT NULL DEFAULT '',
      languages TEXT NOT NULL DEFAULT '',
      availability TEXT NOT NULL DEFAULT 'full-time',
      payout_method TEXT NOT NULL DEFAULT '',
      payout_details TEXT NOT NULL DEFAULT '',
      equipment_experience TEXT NOT NULL DEFAULT '',
      dispatcher_code TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS commissions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      order_number TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      dispatcher_user_id TEXT,
      dispatcher_name TEXT,
      order_price REAL NOT NULL,
      driver_charge REAL NOT NULL,
      dispatcher_pay REAL NOT NULL,
      net_osi REAL NOT NULL,
      delivery_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      settled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS driver_favorites (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ]) {
    await db.execute(sql);
  }

  // Migrations for users table
  await addColumnIfMissing('users', 'phone',                "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('users', 'ssn',                  "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('users', 'date_of_birth',        "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('users', 'city',                 "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('users', 'years_experience',     "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing('users', 'previous_companies',   "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('users', 'languages',            "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('users', 'availability',         "TEXT NOT NULL DEFAULT 'full-time'");
  await addColumnIfMissing('users', 'payout_method',        "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('users', 'payout_details',       "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('users', 'equipment_experience', "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('users', 'dispatcher_code',      "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('users', 'shift_active',         "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing('users', 'shift_changed_at',     "TEXT");
  await addColumnIfMissing('users', 'approval_status',      "TEXT NOT NULL DEFAULT 'approved'");

  // Assign dispatcher_code to existing dispatchers that don't have one
  const genCode = async (): Promise<string> => {
    const code = String(Math.floor(10000000 + Math.random() * 90000000));
    const exists = await queryOne("SELECT id FROM users WHERE dispatcher_code = ?", [code]);
    return exists ? genCode() : code;
  };
  const dispatchersWithoutCode = await query<{ id: string }>(
    "SELECT id FROM users WHERE role = 'dispatcher' AND dispatcher_code = ''"
  );
  for (const u of dispatchersWithoutCode) {
    await exec("UPDATE users SET dispatcher_code = ? WHERE id = ?", [await genCode(), u.id]);
  }

  // Migrations for notifications
  await addColumnIfMissing('notifications', 'target_driver_id', "TEXT");

  // Migrations for orders
  await addColumnIfMissing('orders', 'dispatcher_user_id',    "TEXT");
  await addColumnIfMissing('orders', 'offered_to_driver_id',  "TEXT");
  await addColumnIfMissing('orders', 'offered_to_truck_id',   "TEXT");
  await addColumnIfMissing('orders', 'offered_at',            "TEXT");

  // Migrations for drivers
  await addColumnIfMissing('drivers', 'equipment_type',  "TEXT NOT NULL DEFAULT 'Dry Van'");
  await addColumnIfMissing('drivers', 'company_name',    "TEXT NOT NULL DEFAULT 'OSI Logistics LLC'");
  await addColumnIfMissing('drivers', 'mc_number',       "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('drivers', 'authority_since', "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('drivers', 'payment_method',  "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('drivers', 'payment_details', "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('drivers', 'truck_number',    "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('drivers', 'trailer_number',  "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('drivers', 'driver_code',     "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('drivers', 'truck_make',      "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('drivers', 'coi_filename',    "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('drivers', 'coi_expiry',      "TEXT NOT NULL DEFAULT ''");

  // Assign driver_code to existing drivers without one
  const genDriverCode = async (): Promise<string> => {
    const code = String(Math.floor(10000000 + Math.random() * 90000000));
    const exists = await queryOne("SELECT id FROM drivers WHERE driver_code = ?", [code]);
    return exists ? genDriverCode() : code;
  };
  const driversWithoutCode = await query<{ id: string }>("SELECT id FROM drivers WHERE driver_code = ''");
  for (const d of driversWithoutCode) {
    await exec("UPDATE drivers SET driver_code = ? WHERE id = ?", [await genDriverCode(), d.id]);
  }

  // Patch demo drivers company/MC/authority
  const demoPatches = [
    { email: 'ana.m@osilogistics.com',   company: 'Martinez Transport LLC', mc: 'MC-1045672', authority: '2017-06-01' },
    { email: 'david.t@osilogistics.com', company: 'Thompson Freight LLC',   mc: 'MC-1234589', authority: '2021-09-15' },
    { email: 'james.w@osilogistics.com', company: 'Wilson Hauling Co.',     mc: 'MC-987654',  authority: '2022-01-10' },
  ];
  for (const p of demoPatches) {
    await exec('UPDATE drivers SET company_name = ?, mc_number = ?, authority_since = ? WHERE email = ?',
      [p.company, p.mc, p.authority, p.email]);
  }

  await seedDatabase();
  await seedUsers();
  await seedFavorites();
  await seedCommissions();
  await initCommissions();
}

export async function createCommission(
  orderId: string, orderNumber: string, driverId: string, driverName: string,
  dispatcherUserId: string | null, dispatcherName: string | null,
  orderPrice: number, deliveryDate: string | null
): Promise<void> {
  const existing = await queryOne('SELECT id FROM commissions WHERE order_id = ?', [orderId]);
  if (existing) return;
  const driverCharge  = Math.round(orderPrice * 0.08 * 100) / 100;
  const dispatcherPay = Math.round(orderPrice * 0.05 * 100) / 100;
  const netOsi        = Math.round((driverCharge - dispatcherPay) * 100) / 100;
  await exec(`
    INSERT INTO commissions
      (id, order_id, order_number, driver_id, driver_name, dispatcher_user_id, dispatcher_name,
       order_price, driver_charge, dispatcher_pay, net_osi, delivery_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [uuidv4(), orderId, orderNumber, driverId, driverName,
    dispatcherUserId, dispatcherName, orderPrice, driverCharge, dispatcherPay, netOsi, deliveryDate]);
}

async function initCommissions(): Promise<void> {
  const delivered = await query<{
    id: string; order_number: string; driver_id: string; price: number;
    delivered_at: string | null; dispatcher_user_id: string | null;
    driver_name: string; dispatcher_name: string | null;
  }>(`
    SELECT o.id, o.order_number, o.driver_id, o.price, o.delivered_at, o.dispatcher_user_id,
           d.name as driver_name,
           u.name as dispatcher_name
    FROM orders o
    JOIN drivers d ON o.driver_id = d.id
    LEFT JOIN users u ON o.dispatcher_user_id = u.id
    WHERE o.status = 'delivered' AND o.price > 0
      AND o.id NOT IN (SELECT order_id FROM commissions)
  `);

  for (const o of delivered) {
    const driverCharge = Math.round(o.price * 0.08 * 100) / 100;
    const dispPay      = Math.round(o.price * 0.05 * 100) / 100;
    const netOsi       = Math.round((driverCharge - dispPay) * 100) / 100;
    await exec(`
      INSERT OR IGNORE INTO commissions
        (id, order_id, order_number, driver_id, driver_name, dispatcher_user_id, dispatcher_name,
         order_price, driver_charge, dispatcher_pay, net_osi, delivery_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), o.id, o.order_number, o.driver_id, o.driver_name,
      o.dispatcher_user_id ?? null, o.dispatcher_name ?? null,
      o.price, driverCharge, dispPay, netOsi, o.delivered_at]);
  }
  if (delivered.length > 0) console.log(`   💰 ${delivered.length} commissions generated`);
}

async function seedFavorites(): Promise<void> {
  const row = await queryOne<{ c: number }>('SELECT COUNT(*) as c FROM driver_favorites');
  if ((row?.c ?? 0) > 0) return;
  const carlos = await queryOne<{ id: string }>("SELECT id FROM drivers WHERE email = 'carlos.r@osilogistics.com' LIMIT 1");
  if (!carlos) return;
  await exec('INSERT INTO driver_favorites (id, driver_id, name, address, type) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), carlos.id, 'Home', 'Fort Myers, FL 33907', 'home']);
  await exec('INSERT INTO driver_favorites (id, driver_id, name, address, type) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), carlos.id, 'Michigan', 'Detroit, MI', 'frequent']);
  await exec('INSERT INTO driver_favorites (id, driver_id, name, address, type) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), carlos.id, 'OSI Warehouse', '1200 NW 22nd Ave, Miami, FL 33125', 'work']);
}

async function seedCommissions(): Promise<void> {
  const row = await queryOne<{ c: number }>('SELECT COUNT(*) as c FROM commissions');
  if ((row?.c ?? 0) > 0) return;

  const carlos   = await queryOne<{ id: string }>("SELECT id FROM drivers WHERE email = 'carlos.r@osilogistics.com' LIMIT 1");
  const marcus   = await queryOne<{ id: string }>("SELECT id FROM drivers WHERE email = 'marcus.j@osilogistics.com' LIMIT 1");
  const sofia    = await queryOne<{ id: string }>("SELECT id FROM drivers WHERE email = 'sofia.h@osilogistics.com' LIMIT 1");
  const dispUser = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = 'dispatcher@osilogistics.com' LIMIT 1");
  if (!carlos || !marcus || !sofia) return;

  for (const [driver, driverName, price, date, status, settled] of [
    [carlos.id, 'Carlos Rodriguez', 2450, '2026-06-02', 'settled', '2026-06-03 10:00:00'],
    [marcus.id, 'Marcus Johnson',   1800, '2026-06-05', 'pending', null],
    [sofia.id,  'Sofia Hernandez',  3100, '2026-06-07', 'pending', null],
  ] as [string, string, number, string, string, string | null][]) {
    const dc = Math.round(price * 0.08 * 100) / 100;
    const dp = Math.round(price * 0.05 * 100) / 100;
    const no = Math.round(price * 0.03 * 100) / 100;
    await exec(`INSERT OR IGNORE INTO commissions
      (id, order_id, order_number, driver_id, driver_name, dispatcher_user_id, dispatcher_name,
       order_price, driver_charge, dispatcher_pay, net_osi, delivery_date, status, settled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), uuidv4(), `OSI-SEED-${driver.slice(0,4)}`, driver, driverName,
       dispUser?.id ?? null, dispUser ? 'Dispatcher OSI' : null,
       price, dc, dp, no, date, status, settled]);
  }
  console.log('   💰 3 example commissions seeded');
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

async function seedUsers(): Promise<void> {
  const upsert = async (name: string, email: string, password: string, role: string, driverId: string | null) => {
    const salt = randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      await exec('UPDATE users SET password_hash = ?, salt = ?, name = ?, active = 1 WHERE email = ?',
        [hash, salt, name, email]);
    } else {
      await exec('INSERT INTO users (id, name, email, password_hash, salt, role, driver_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), name, email, hash, salt, role, driverId]);
    }
  };

  await upsert('Admin OSI',      'admin@osilogistics.com',      'Admin123!',    'admin',      null);
  await upsert('Maria Gonzalez', 'dispatcher@osilogistics.com', 'Dispatch123!', 'dispatcher', null);

  const carlos = await queryOne<{ id: string; name: string; email: string }>(
    "SELECT id, name, email FROM drivers WHERE email = 'carlos.r@osilogistics.com' LIMIT 1"
  );
  if (carlos) {
    await upsert(carlos.name as string, carlos.email as string, 'Driver123!', 'driver', carlos.id as string);
    await exec("UPDATE users SET driver_id = ? WHERE email = ? AND role = 'driver'", [carlos.id, carlos.email]);
    console.log('   👤 carlos.r@osilogistics.com / Driver123!');
  }
  console.log('   👤 admin@osilogistics.com / Admin123!');
  console.log('   👤 dispatcher@osilogistics.com / Dispatch123!');
}

async function seedDatabase(): Promise<void> {
  const row = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM drivers');
  if ((row?.count ?? 0) > 0) return;

  const truckList = [
    { id: uuidv4(), plate: 'OSI-001', make: 'Peterbilt',    model: '579',         year: 2022, type: 'Dry Van',   cap_kg: 7000, cap_m3: 28, status: 'active',      mileage: 245230, fuel: 85, lm: '2026-04-15', nm: '2026-07-15', vin: '1FDWF36P02EA12345', color: 'White'  },
    { id: uuidv4(), plate: 'OSI-002', make: 'Freightliner', model: 'Cascadia',     year: 2021, type: 'Reefer',    cap_kg: 9000, cap_m3: 35, status: 'active',      mileage: 378400, fuel: 60, lm: '2026-03-20', nm: '2026-06-20', vin: '1FUBBCYB62LJ12346', color: 'White'  },
    { id: uuidv4(), plate: 'OSI-003', make: 'Volvo',        model: '860',          year: 2023, type: 'Reefer',    cap_kg: 4500, cap_m3: 18, status: 'active',      mileage: 112100, fuel: 95, lm: '2026-05-01', nm: '2026-08-01', vin: '54DC4W1B63JS12347', color: 'White'  },
    { id: uuidv4(), plate: 'OSI-004', make: 'Kenworth',     model: 'W900',         year: 2022, type: 'Flatbed',   cap_kg: 1500, cap_m3: 11, status: 'active',      mileage: 183800, fuel: 70, lm: '2026-04-01', nm: '2026-07-01', vin: 'WD3PE8CC6GP12348',  color: 'Silver' },
    { id: uuidv4(), plate: 'OSI-005', make: 'Kenworth',     model: 'T270',         year: 2020, type: 'Flatbed',   cap_kg: 12000,cap_m3: 45, status: 'active',      mileage: 412000, fuel: 40, lm: '2026-02-10', nm: '2026-05-10', vin: '2NKHHM6X2KM12349',  color: 'Blue'   },
    { id: uuidv4(), plate: 'OSI-006', make: 'Ford',         model: 'Transit 250',  year: 2023, type: 'Box Truck', cap_kg: 1200, cap_m3: 9,  status: 'active',      mileage: 108900, fuel: 90, lm: '2026-05-15', nm: '2026-08-15', vin: '1FTBW2CM8KKA12350', color: 'White'  },
    { id: uuidv4(), plate: 'OSI-007', make: 'Peterbilt',    model: '337',          year: 2021, type: 'Box Truck', cap_kg: 8500, cap_m3: 32, status: 'maintenance', mileage: 267400, fuel: 55, lm: '2026-05-28', nm: '2026-08-28', vin: '2NP2HM6X2LM12351',  color: 'Black'  },
    { id: uuidv4(), plate: 'OSI-008', make: 'Isuzu',        model: 'FTR',          year: 2022, type: 'Reefer',    cap_kg: 6000, cap_m3: 24, status: 'active',      mileage: 189300, fuel: 75, lm: '2026-03-05', nm: '2026-06-05', vin: '54DB4W1B63JS12352', color: 'White'  },
  ];

  for (const t of truckList) {
    await exec(`INSERT INTO trucks (id, plate_number, make, model, year, type, capacity_kg, capacity_m3, status, mileage, fuel_level, last_maintenance, next_maintenance, vin, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.plate, t.make, t.model, t.year, t.type, t.cap_kg, t.cap_m3, t.status, t.mileage, t.fuel, t.lm, t.nm, t.vin, t.color]);
  }

  const locs = [
    { lat: 25.7617, lng: -80.1918, addr: 'Miami Downtown, FL' },
    { lat: 25.7959, lng: -80.2870, addr: 'Miami International Airport, FL' },
    { lat: 25.7907, lng: -80.1300, addr: 'Miami Beach, FL' },
    { lat: 25.7215, lng: -80.2684, addr: 'Coral Gables, FL' },
    { lat: 25.8576, lng: -80.2781, addr: 'Hialeah, FL' },
    { lat: 25.7741, lng: -80.1977, addr: 'Brickell, FL' },
    { lat: 25.8195, lng: -80.3556, addr: 'Doral, FL' },
    { lat: 25.7997, lng: -80.1992, addr: 'Wynwood, FL' },
  ];

  const driverData = [
    { name: 'Carlos Rodriguez', phone: '(305) 555-0101', email: 'carlos.r@osilogistics.com', lic: 'FL-CDL-100234', exp: '2027-08-15', status: 'busy',     rating: 4.9, del: 47, ot: 97.2, hire: '2022-03-15', loc: locs[0], truck: truckList[0].id, eq: 'Dry Van',   co: 'OSI Logistics LLC',     mc: 'MC-892341',  auth: '2019-03-15' },
    { name: 'Marcus Johnson',   phone: '(305) 555-0102', email: 'marcus.j@osilogistics.com', lic: 'FL-CDL-100456', exp: '2026-11-20', status: 'busy',     rating: 4.7, del: 38, ot: 94.8, hire: '2022-09-01', loc: locs[1], truck: truckList[1].id, eq: 'Reefer',    co: 'OSI Logistics LLC',     mc: 'MC-892341',  auth: '2019-03-15' },
    { name: 'Ana Martinez',     phone: '(305) 555-0103', email: 'ana.m@osilogistics.com',    lic: 'FL-CDL-100789', exp: '2027-03-10', status: 'available',rating: 4.95,del: 49, ot: 98.5, hire: '2021-01-10', loc: locs[2], truck: truckList[2].id, eq: 'Reefer',    co: 'Martinez Transport LLC',mc: 'MC-1045672', auth: '2017-06-01' },
    { name: 'David Thompson',   phone: '(305) 555-0104', email: 'david.t@osilogistics.com',  lic: 'FL-CDL-101011', exp: '2026-07-25', status: 'available',rating: 4.6, del: 28, ot: 92.1, hire: '2023-06-20', loc: locs[3], truck: truckList[3].id, eq: 'Flatbed',   co: 'Thompson Freight LLC',  mc: 'MC-1234589', auth: '2021-09-15' },
    { name: 'Sofia Hernandez',  phone: '(305) 555-0105', email: 'sofia.h@osilogistics.com',  lic: 'FL-CDL-101234', exp: '2027-12-01', status: 'busy',     rating: 4.8, del: 43, ot: 96.3, hire: '2022-05-14', loc: locs[4], truck: truckList[4].id, eq: 'Dry Van',   co: 'OSI Logistics LLC',     mc: 'MC-892341',  auth: '2019-03-15' },
    { name: 'James Wilson',     phone: '(305) 555-0106', email: 'james.w@osilogistics.com',  lic: 'FL-CDL-101567', exp: '2027-06-18', status: 'on_break', rating: 4.5, del: 22, ot: 91.0, hire: '2023-11-05', loc: locs[5], truck: truckList[5].id, eq: 'Box Truck', co: 'Wilson Hauling Co.',    mc: 'MC-987654',  auth: '2022-01-10' },
    { name: 'Maria Garcia',     phone: '(305) 555-0107', email: 'maria.g@osilogistics.com',  lic: 'FL-CDL-101890', exp: '2026-09-30', status: 'offline',  rating: 4.85,del: 45, ot: 95.7, hire: '2021-08-22', loc: locs[6], truck: null,              eq: 'Flatbed',   co: 'OSI Logistics LLC',     mc: 'MC-892341',  auth: '2019-03-15' },
    { name: 'Robert Davis',     phone: '(305) 555-0108', email: 'robert.d@osilogistics.com', lic: 'FL-CDL-102123', exp: '2027-02-14', status: 'available',rating: 4.75,del: 31, ot: 93.4, hire: '2023-02-28', loc: locs[7], truck: truckList[7].id, eq: 'Dry Van',   co: 'OSI Logistics LLC',     mc: 'MC-892341',  auth: '2019-03-15' },
  ];

  const driverIds: string[] = [];
  for (const d of driverData) {
    const id = uuidv4();
    driverIds.push(id);
    const initials = d.name.split(' ').map(n => n[0]).join('');
    const code = String(Math.floor(10000000 + Math.random() * 90000000));
    await exec(`INSERT INTO drivers (id, name, phone, email, license_number, license_expiry, status,
      current_lat, current_lng, current_address, truck_id, rating, total_deliveries, on_time_rate,
      avatar, hire_date, equipment_type, company_name, mc_number, authority_since, driver_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, d.name, d.phone, d.email, d.lic, d.exp, d.status,
       d.loc.lat, d.loc.lng, d.loc.addr, d.truck,
       d.rating, d.del, d.ot, initials, d.hire, d.eq, d.co, d.mc, d.auth, code]);
  }

  const pickups = [
    { addr: '1200 NW 22nd Ave, Miami, FL 33125', lat: 25.7886, lng: -80.2284 },
    { addr: '500 Brickell Ave, Miami, FL 33131',  lat: 25.7656, lng: -80.1935 },
    { addr: '8888 NW 36th St, Doral, FL 33178',   lat: 25.8192, lng: -80.3602 },
    { addr: '2601 S Bayshore Dr, Coconut Grove',   lat: 25.7272, lng: -80.2378 },
    { addr: '11200 NW 25th St, Miami, FL 33172',  lat: 25.7917, lng: -80.3734 },
    { addr: '3300 NE 1st Ave, Miami, FL 33137',   lat: 25.8061, lng: -80.1923 },
  ];
  const deliveries = [
    { addr: '401 Collins Ave, Miami Beach, FL',   lat: 25.7745, lng: -80.1349 },
    { addr: '9055 SW 87th Ave, Miami, FL 33176',  lat: 25.6841, lng: -80.3282 },
    { addr: '20001 E Country Club Dr, Aventura',  lat: 25.9590, lng: -80.1398 },
    { addr: '7777 NW 74th Ave, Medley, FL 33166', lat: 25.8234, lng: -80.3234 },
    { addr: '3251 Hollywood Blvd, Hollywood, FL', lat: 26.0112, lng: -80.1496 },
    { addr: '1 Alhambra Plaza, Coral Gables, FL', lat: 25.7215, lng: -80.2684 },
    { addr: '1601 Washington Ave, Miami Beach',    lat: 25.7907, lng: -80.1336 },
    { addr: '10000 W Flagler St, Miami, FL',      lat: 25.7754, lng: -80.3368 },
  ];
  const customers = [
    { name: 'TechCorp Solutions',    phone: '(305) 800-1001', email: 'logistics@techcorp.com' },
    { name: 'Fresh Market Foods',    phone: '(305) 800-1002', email: 'orders@freshmarket.com' },
    { name: 'BuildRight Construction',phone:'(305) 800-1003', email: 'supply@buildright.com'  },
    { name: 'MedSupply Inc',         phone: '(305) 800-1004', email: 'orders@medsupply.com'  },
    { name: 'Auto Parts Direct',     phone: '(305) 800-1005', email: 'shipping@autoparts.com'},
    { name: 'Miami Fashion House',   phone: '(305) 800-1006', email: 'warehouse@miamifw.com' },
    { name: 'HomeGoods Warehouse',   phone: '(305) 800-1007', email: 'dist@homegoods.com'    },
    { name: 'Green Grocers Co',      phone: '(305) 800-1008', email: 'delivery@greengrocers.com'},
    { name: 'Industrial Supply Hub', phone: '(305) 800-1009', email: 'orders@indsupply.com'  },
    { name: 'ElectroCom Retail',     phone: '(305) 800-1010', email: 'logistics@electrocom.com'},
  ];
  const orderStatuses = [
    { status: 'delivered', days: -5 }, { status: 'delivered', days: -4 }, { status: 'delivered', days: -3 },
    { status: 'delivered', days: -2 }, { status: 'delivered', days: -1 }, { status: 'in_transit', days: 0 },
    { status: 'in_transit', days: 0 }, { status: 'picked_up', days: 0 },  { status: 'assigned', days: 0 },
    { status: 'assigned', days: 0 },   { status: 'pending', days: 0 },    { status: 'pending', days: 0 },
    { status: 'pending', days: 1 },    { status: 'cancelled', days: -3 }, { status: 'delivered', days: -6 },
    { status: 'delivered', days: -7 }, { status: 'in_transit', days: 0 }, { status: 'assigned', days: 0 },
    { status: 'pending', days: 0 },    { status: 'delivered', days: -2 },
  ];
  const descs = [
    'Componentes electrónicos y periféricos', 'Alimentos refrigerados - sensibles a la temperatura',
    'Materiales y equipos de construcción',   'Suministros médicos y productos farmacéuticos',
    'Repuestos y accesorios automotrices',    'Mercancía de moda y textiles',
    'Electrodomésticos y muebles',            'Productos frescos y orgánicos',
    'Partes de maquinaria industrial',        'Electrónica de consumo',
  ];
  const priorities = ['low', 'normal', 'normal', 'high', 'urgent'];

  for (let i = 0; i < orderStatuses.length; i++) {
    const id = uuidv4();
    const orderNum = `OSI-${String(2024100 + i).padStart(7, '0')}`;
    const cust = customers[i % customers.length];
    const pu   = pickups[i % pickups.length];
    const del  = deliveries[i % deliveries.length];
    const { status, days } = orderStatuses[i];
    const priority = priorities[i % priorities.length];
    const weight = Math.round((Math.random() * 4000 + 200) * 10) / 10;
    const volume = Math.round((Math.random() * 25 + 2) * 10) / 10;
    const dist   = Math.round((Math.random() * 50 + 5) * 10) / 10;
    const price  = Math.round((800 + dist * 20 + weight * 0.5) / 100) * 100;

    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() + days);
    createdDate.setHours(Math.floor(Math.random() * 8) + 8);

    const assigned  = ['assigned','picked_up','in_transit','delivered'].includes(status)
      ? new Date(createdDate.getTime() + 30 * 60000).toISOString() : null;
    const pickedUp  = ['picked_up','in_transit','delivered'].includes(status)
      ? new Date(createdDate.getTime() + 90 * 60000).toISOString() : null;
    const inTransit = ['in_transit','delivered'].includes(status)
      ? new Date(createdDate.getTime() + 120 * 60000).toISOString() : null;
    const delivered = status === 'delivered'
      ? new Date(createdDate.getTime() + 240 * 60000).toISOString() : null;
    const estimated = new Date(createdDate.getTime() + 4 * 3600000).toISOString();

    const driverIdx = i % 5;
    const driverId  = ['assigned','picked_up','in_transit','delivered'].includes(status) ? driverIds[driverIdx] : null;
    const truckId   = driverId ? truckList[driverIdx].id : null;

    await exec(`INSERT INTO orders (id, order_number, customer_name, customer_phone, customer_email,
      pickup_address, pickup_lat, pickup_lng, pickup_contact,
      delivery_address, delivery_lat, delivery_lng, delivery_contact,
      status, priority, weight_kg, volume_m3, description, notes,
      driver_id, truck_id, created_at, assigned_at, picked_up_at, in_transit_at, delivered_at,
      estimated_delivery, price, distance_km)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orderNum, cust.name, cust.phone, cust.email,
       pu.addr, pu.lat, pu.lng, cust.phone,
       del.addr, del.lat, del.lng, cust.phone,
       status, priority, weight, volume, descs[i % descs.length], '',
       driverId, truckId, createdDate.toISOString(),
       assigned, pickedUp, inTransit, delivered, estimated, price, dist]);

    await exec("INSERT INTO order_history (id, order_id, status, notes, created_by) VALUES (?, ?, 'pending', 'Order created', 'system')",
      [uuidv4(), id]);
    if (assigned)  await exec("INSERT INTO order_history (id, order_id, status, notes, created_by) VALUES (?, ?, 'assigned', 'Driver assigned', 'dispatcher')",   [uuidv4(), id]);
    if (pickedUp)  await exec("INSERT INTO order_history (id, order_id, status, notes, created_by) VALUES (?, ?, 'picked_up', 'Package picked up', 'driver')",    [uuidv4(), id]);
    if (inTransit) await exec("INSERT INTO order_history (id, order_id, status, notes, created_by) VALUES (?, ?, 'in_transit', 'In transit', 'driver')",          [uuidv4(), id]);
    if (delivered) await exec("INSERT INTO order_history (id, order_id, status, notes, created_by) VALUES (?, ?, 'delivered', 'Successfully delivered', 'driver')",[uuidv4(), id]);
  }

  const notifs = [
    { type: 'alert', title: 'Low Fuel Alert',       msg: 'Truck OSI-005 fuel level is at 40%. Schedule refueling.',              read: 0 },
    { type: 'order', title: 'New Urgent Order',      msg: 'New urgent order requires immediate assignment.',                        read: 0 },
    { type: 'driver',title: 'Driver Available',      msg: 'Ana Martinez has completed her delivery and is now available.',          read: 0 },
    { type: 'truck', title: 'Maintenance Due',       msg: 'Truck OSI-002 is due for maintenance on June 20, 2026.',                read: 1 },
    { type: 'order', title: 'Delivery Completed',    msg: 'Order OSI-2024101 has been successfully delivered.',                    read: 1 },
    { type: 'system',title: 'System Update',         msg: 'OSI Logistics platform updated to version 2.1.0',                      read: 1 },
  ];
  const now = new Date();
  for (let i = 0; i < notifs.length; i++) {
    const t = new Date(now.getTime() - i * 15 * 60000).toISOString();
    await exec('INSERT INTO notifications (id, type, title, message, read, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), notifs[i].type, notifs[i].title, notifs[i].msg, notifs[i].read, t]);
  }
  console.log('✅ Database seeded with sample data');
}
