import { DatabaseSync } from 'node:sqlite';
import { scryptSync, randomBytes } from 'node:crypto';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'osi_logistics.db');

let db: DatabaseSync;

export function getDb(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

export function initDatabase(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trucks (
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
    );

    CREATE TABLE IF NOT EXISTS orders (
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
      FOREIGN KEY (driver_id) REFERENCES drivers(id),
      FOREIGN KEY (truck_id) REFERENCES trucks(id)
    );

    CREATE TABLE IF NOT EXISTS order_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT NOT NULL DEFAULT '',
      lat REAL,
      lng REAL,
      created_by TEXT NOT NULL DEFAULT 'system',
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS tracking (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      order_id TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      speed REAL NOT NULL DEFAULT 0,
      heading REAL NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (driver_id) REFERENCES drivers(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'system',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      related_id TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'dispatcher',
      driver_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (driver_id) REFERENCES drivers(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS driver_favorites (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
    );
  `);

  // 1. Seed demo data first (creates drivers)
  seedDatabase(db);
  // 2. Then seed users (needs drivers to already exist for driver account)
  seedUsers(db);
  // 3. Seed sample favorites (safe to run every time — checks if empty first)
  seedFavorites(db);
}

function seedFavorites(db: DatabaseSync): void {
  const count = (db.prepare('SELECT COUNT(*) as c FROM driver_favorites').get() as { c: number }).c;
  if (count > 0) return;

  const carlos = db.prepare(
    "SELECT id FROM drivers WHERE email = 'carlos.r@osilogistics.com' LIMIT 1"
  ).get() as { id: string } | undefined;

  if (!carlos) return;

  const ins = db.prepare(
    'INSERT INTO driver_favorites (id, driver_id, name, address, type) VALUES (?, ?, ?, ?, ?)'
  );
  ins.run(uuidv4(), carlos.id, 'Home',     'Fort Myers, FL 33907',     'home');
  ins.run(uuidv4(), carlos.id, 'Michigan', 'Detroit, MI',              'frequent');
  ins.run(uuidv4(), carlos.id, 'OSI Warehouse', '1200 NW 22nd Ave, Miami, FL 33125', 'work');
}

function seedUsers(db: DatabaseSync): void {
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, password_hash, salt, role, driver_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Admin + Dispatcher (always created)
  const adminSalt = randomBytes(16).toString('hex');
  const dispatchSalt = randomBytes(16).toString('hex');
  insertUser.run(uuidv4(), 'Admin OSI',       'admin@osilogistics.com',      hashPassword('Admin123!',    adminSalt),    adminSalt,    'admin',      null);
  insertUser.run(uuidv4(), 'Dispatcher OSI',  'dispatcher@osilogistics.com', hashPassword('Dispatch123!', dispatchSalt), dispatchSalt, 'dispatcher', null);

  // Driver: Carlos Rodriguez specifically (drivers already exist at this point)
  const carlos = db.prepare("SELECT id, name, email FROM drivers WHERE email = 'carlos.r@osilogistics.com' LIMIT 1").get() as Record<string, string> | undefined;
  if (carlos) {
    const driverSalt = randomBytes(16).toString('hex');
    insertUser.run(uuidv4(), carlos.name, carlos.email, hashPassword('Driver123!', driverSalt), driverSalt, 'driver', carlos.id);
    console.log('   👤 carlos.r@osilogistics.com / Driver123!');
  }

  console.log('   👤 admin@osilogistics.com / Admin123!');
  console.log('   👤 dispatcher@osilogistics.com / Dispatch123!');
}

function seedDatabase(db: DatabaseSync): void {
  const driverCount = (db.prepare('SELECT COUNT(*) as count FROM drivers').get() as { count: number }).count;
  if (driverCount > 0) return;

  const trucks = [
    { id: uuidv4(), plate: 'OSI-001', make: 'Ford', model: 'F-650', year: 2022, type: 'Box Truck', cap_kg: 7000, cap_m3: 28, status: 'active', mileage: 45230, fuel: 85, last_maint: '2026-04-15', next_maint: '2026-07-15', vin: '1FDWF36P02EA12345', color: 'White' },
    { id: uuidv4(), plate: 'OSI-002', make: 'Freightliner', model: 'M2 106', year: 2021, type: 'Box Truck', cap_kg: 9000, cap_m3: 35, status: 'active', mileage: 78400, fuel: 60, last_maint: '2026-03-20', next_maint: '2026-06-20', vin: '1FUBBCYB62LJ12346', color: 'White' },
    { id: uuidv4(), plate: 'OSI-003', make: 'Isuzu', model: 'NPR-HD', year: 2023, type: 'Refrigerated', cap_kg: 4500, cap_m3: 18, status: 'active', mileage: 12100, fuel: 95, last_maint: '2026-05-01', next_maint: '2026-08-01', vin: '54DC4W1B63JS12347', color: 'White' },
    { id: uuidv4(), plate: 'OSI-004', make: 'Mercedes-Benz', model: 'Sprinter', year: 2022, type: 'Van', cap_kg: 1500, cap_m3: 11, status: 'active', mileage: 33800, fuel: 70, last_maint: '2026-04-01', next_maint: '2026-07-01', vin: 'WD3PE8CC6GP12348', color: 'Silver' },
    { id: uuidv4(), plate: 'OSI-005', make: 'Kenworth', model: 'T270', year: 2020, type: 'Flatbed', cap_kg: 12000, cap_m3: 45, status: 'active', mileage: 112000, fuel: 40, last_maint: '2026-02-10', next_maint: '2026-05-10', vin: '2NKHHM6X2KM12349', color: 'Blue' },
    { id: uuidv4(), plate: 'OSI-006', make: 'Ford', model: 'Transit', year: 2023, type: 'Van', cap_kg: 1200, cap_m3: 9, status: 'active', mileage: 8900, fuel: 90, last_maint: '2026-05-15', next_maint: '2026-08-15', vin: '1FTBW2CM8KKA12350', color: 'White' },
    { id: uuidv4(), plate: 'OSI-007', make: 'Peterbilt', model: '337', year: 2021, type: 'Box Truck', cap_kg: 8500, cap_m3: 32, status: 'maintenance', mileage: 67400, fuel: 55, last_maint: '2026-05-28', next_maint: '2026-08-28', vin: '2NP2HM6X2LM12351', color: 'Black' },
    { id: uuidv4(), plate: 'OSI-008', make: 'Isuzu', model: 'FTR', year: 2022, type: 'Refrigerated', cap_kg: 6000, cap_m3: 24, status: 'active', mileage: 29300, fuel: 75, last_maint: '2026-03-05', next_maint: '2026-06-05', vin: '54DB4W1B63JS12352', color: 'White' },
  ];

  const insertTruck = db.prepare(`
    INSERT INTO trucks (id, plate_number, make, model, year, type, capacity_kg, capacity_m3, status, mileage, fuel_level, last_maintenance, next_maintenance, vin, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const t of trucks) {
    insertTruck.run(t.id, t.plate, t.make, t.model, t.year, t.type, t.cap_kg, t.cap_m3, t.status, t.mileage, t.fuel, t.last_maint, t.next_maint, t.vin, t.color);
  }

  const miamiLocations = [
    { lat: 25.7617, lng: -80.1918, addr: 'Miami Downtown, FL' },
    { lat: 25.7959, lng: -80.2870, addr: 'Miami International Airport, FL' },
    { lat: 25.7907, lng: -80.1300, addr: 'Miami Beach, FL' },
    { lat: 25.7215, lng: -80.2684, addr: 'Coral Gables, FL' },
    { lat: 25.8576, lng: -80.2781, addr: 'Hialeah, FL' },
    { lat: 25.7741, lng: -80.1977, addr: 'Brickell, FL' },
    { lat: 25.8195, lng: -80.3556, addr: 'Doral, FL' },
    { lat: 25.7997, lng: -80.1992, addr: 'Wynwood, FL' },
  ];

  const drivers = [
    { name: 'Carlos Rodriguez', phone: '(305) 555-0101', email: 'carlos.r@osilogistics.com', license: 'FL-CDL-100234', expiry: '2027-08-15', status: 'busy', rating: 4.9, deliveries: 1247, on_time: 97.2, hire: '2022-03-15', loc: miamiLocations[0], truck: trucks[0].id },
    { name: 'Marcus Johnson', phone: '(305) 555-0102', email: 'marcus.j@osilogistics.com', license: 'FL-CDL-100456', expiry: '2026-11-20', status: 'busy', rating: 4.7, deliveries: 892, on_time: 94.8, hire: '2022-09-01', loc: miamiLocations[1], truck: trucks[1].id },
    { name: 'Ana Martinez', phone: '(305) 555-0103', email: 'ana.m@osilogistics.com', license: 'FL-CDL-100789', expiry: '2027-03-10', status: 'available', rating: 4.95, deliveries: 2103, on_time: 98.5, hire: '2021-01-10', loc: miamiLocations[2], truck: trucks[2].id },
    { name: 'David Thompson', phone: '(305) 555-0104', email: 'david.t@osilogistics.com', license: 'FL-CDL-101011', expiry: '2026-07-25', status: 'available', rating: 4.6, deliveries: 567, on_time: 92.1, hire: '2023-06-20', loc: miamiLocations[3], truck: trucks[3].id },
    { name: 'Sofia Hernandez', phone: '(305) 555-0105', email: 'sofia.h@osilogistics.com', license: 'FL-CDL-101234', expiry: '2027-12-01', status: 'busy', rating: 4.8, deliveries: 1456, on_time: 96.3, hire: '2022-05-14', loc: miamiLocations[4], truck: trucks[4].id },
    { name: 'James Wilson', phone: '(305) 555-0106', email: 'james.w@osilogistics.com', license: 'FL-CDL-101567', expiry: '2027-06-18', status: 'on_break', rating: 4.5, deliveries: 334, on_time: 91.0, hire: '2023-11-05', loc: miamiLocations[5], truck: trucks[5].id },
    { name: 'Maria Garcia', phone: '(305) 555-0107', email: 'maria.g@osilogistics.com', license: 'FL-CDL-101890', expiry: '2026-09-30', status: 'offline', rating: 4.85, deliveries: 1789, on_time: 95.7, hire: '2021-08-22', loc: miamiLocations[6], truck: null },
    { name: 'Robert Davis', phone: '(305) 555-0108', email: 'robert.d@osilogistics.com', license: 'FL-CDL-102123', expiry: '2027-02-14', status: 'available', rating: 4.75, deliveries: 723, on_time: 93.4, hire: '2023-02-28', loc: miamiLocations[7], truck: trucks[7].id },
  ];

  const insertDriver = db.prepare(`
    INSERT INTO drivers (id, name, phone, email, license_number, license_expiry, status, current_lat, current_lng, current_address, truck_id, rating, total_deliveries, on_time_rate, avatar, hire_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const driverIds: string[] = [];
  for (const d of drivers) {
    const id = uuidv4();
    driverIds.push(id);
    const initials = d.name.split(' ').map(n => n[0]).join('');
    insertDriver.run(id, d.name, d.phone, d.email, d.license, d.expiry, d.status, d.loc.lat, d.loc.lng, d.loc.addr, d.truck, d.rating, d.deliveries, d.on_time, initials, d.hire);
  }

  const pickupLocations = [
    { addr: '1200 NW 22nd Ave, Miami, FL 33125', lat: 25.7886, lng: -80.2284 },
    { addr: '500 Brickell Ave, Miami, FL 33131', lat: 25.7656, lng: -80.1935 },
    { addr: '8888 NW 36th St, Doral, FL 33178', lat: 25.8192, lng: -80.3602 },
    { addr: '2601 S Bayshore Dr, Coconut Grove, FL', lat: 25.7272, lng: -80.2378 },
    { addr: '11200 NW 25th St, Miami, FL 33172', lat: 25.7917, lng: -80.3734 },
    { addr: '3300 NE 1st Ave, Miami, FL 33137', lat: 25.8061, lng: -80.1923 },
  ];

  const deliveryLocations = [
    { addr: '401 Collins Ave, Miami Beach, FL 33139', lat: 25.7745, lng: -80.1349 },
    { addr: '9055 SW 87th Ave, Miami, FL 33176', lat: 25.6841, lng: -80.3282 },
    { addr: '20001 E Country Club Dr, Aventura, FL', lat: 25.9590, lng: -80.1398 },
    { addr: '7777 NW 74th Ave, Medley, FL 33166', lat: 25.8234, lng: -80.3234 },
    { addr: '3251 Hollywood Blvd, Hollywood, FL', lat: 26.0112, lng: -80.1496 },
    { addr: '1 Alhambra Plaza, Coral Gables, FL', lat: 25.7215, lng: -80.2684 },
    { addr: '1601 Washington Ave, Miami Beach, FL', lat: 25.7907, lng: -80.1336 },
    { addr: '10000 W Flagler St, Miami, FL 33174', lat: 25.7754, lng: -80.3368 },
  ];

  const customers = [
    { name: 'TechCorp Solutions', phone: '(305) 800-1001', email: 'logistics@techcorp.com' },
    { name: 'Fresh Market Foods', phone: '(305) 800-1002', email: 'orders@freshmarket.com' },
    { name: 'BuildRight Construction', phone: '(305) 800-1003', email: 'supply@buildright.com' },
    { name: 'MedSupply Inc', phone: '(305) 800-1004', email: 'orders@medsupply.com' },
    { name: 'Auto Parts Direct', phone: '(305) 800-1005', email: 'shipping@autoparts.com' },
    { name: 'Miami Fashion House', phone: '(305) 800-1006', email: 'warehouse@miamifw.com' },
    { name: 'HomeGoods Warehouse', phone: '(305) 800-1007', email: 'dist@homegoods.com' },
    { name: 'Green Grocers Co', phone: '(305) 800-1008', email: 'delivery@greengrocers.com' },
    { name: 'Industrial Supply Hub', phone: '(305) 800-1009', email: 'orders@indsupply.com' },
    { name: 'ElectroCom Retail', phone: '(305) 800-1010', email: 'logistics@electrocom.com' },
  ];

  const orderStatuses = [
    { status: 'delivered', days: -5 },
    { status: 'delivered', days: -4 },
    { status: 'delivered', days: -3 },
    { status: 'delivered', days: -2 },
    { status: 'delivered', days: -1 },
    { status: 'in_transit', days: 0 },
    { status: 'in_transit', days: 0 },
    { status: 'picked_up', days: 0 },
    { status: 'assigned', days: 0 },
    { status: 'assigned', days: 0 },
    { status: 'pending', days: 0 },
    { status: 'pending', days: 0 },
    { status: 'pending', days: 1 },
    { status: 'cancelled', days: -3 },
    { status: 'delivered', days: -6 },
    { status: 'delivered', days: -7 },
    { status: 'in_transit', days: 0 },
    { status: 'assigned', days: 0 },
    { status: 'pending', days: 0 },
    { status: 'delivered', days: -2 },
  ];

  const insertOrder = db.prepare(`
    INSERT INTO orders (id, order_number, customer_name, customer_phone, customer_email,
      pickup_address, pickup_lat, pickup_lng, pickup_contact,
      delivery_address, delivery_lat, delivery_lng, delivery_contact,
      status, priority, weight_kg, volume_m3, description, notes,
      driver_id, truck_id, created_at, assigned_at, picked_up_at, in_transit_at, delivered_at,
      estimated_delivery, price, distance_km)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertHistory = db.prepare(`
    INSERT INTO order_history (id, order_id, status, timestamp, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const priorities = ['low', 'normal', 'normal', 'high', 'urgent'];
  const descriptions = [
    'Electronic components and peripherals',
    'Refrigerated food items - temperature sensitive',
    'Construction materials and equipment',
    'Medical supplies and pharmaceuticals',
    'Automotive parts and accessories',
    'Fashion merchandise and textiles',
    'Home appliances and furniture',
    'Fresh produce and organic goods',
    'Industrial machinery parts',
    'Consumer electronics',
  ];

  for (let i = 0; i < orderStatuses.length; i++) {
    const id = uuidv4();
    const orderNum = `OSI-${String(2024100 + i).padStart(7, '0')}`;
    const customer = customers[i % customers.length];
    const pickup = pickupLocations[i % pickupLocations.length];
    const delivery = deliveryLocations[i % deliveryLocations.length];
    const { status, days } = orderStatuses[i];
    const priority = priorities[i % priorities.length];
    const weight = Math.round((Math.random() * 4000 + 200) * 10) / 10;
    const volume = Math.round((Math.random() * 25 + 2) * 10) / 10;
    const distance = Math.round((Math.random() * 50 + 5) * 10) / 10;
    const price = Math.round((distance * 2.5 + weight * 0.1) * 100) / 100;

    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() + days);
    createdDate.setHours(Math.floor(Math.random() * 8) + 8);

    const assignedAt = ['assigned', 'picked_up', 'in_transit', 'delivered'].includes(status)
      ? new Date(createdDate.getTime() + 30 * 60000).toISOString()
      : null;
    const pickedUpAt = ['picked_up', 'in_transit', 'delivered'].includes(status)
      ? new Date(createdDate.getTime() + 90 * 60000).toISOString()
      : null;
    const inTransitAt = ['in_transit', 'delivered'].includes(status)
      ? new Date(createdDate.getTime() + 120 * 60000).toISOString()
      : null;
    const deliveredAt = status === 'delivered'
      ? new Date(createdDate.getTime() + 240 * 60000).toISOString()
      : null;

    const estimatedDelivery = new Date(createdDate.getTime() + 4 * 3600000).toISOString();

    const driverIdx = i % 5;
    const driverId = ['assigned', 'picked_up', 'in_transit', 'delivered'].includes(status)
      ? driverIds[driverIdx]
      : null;
    const truckId = driverId ? trucks[driverIdx].id : null;

    insertOrder.run(
      id, orderNum, customer.name, customer.phone, customer.email,
      pickup.addr, pickup.lat, pickup.lng, customer.phone,
      delivery.addr, delivery.lat, delivery.lng, customer.phone,
      status, priority, weight, volume, descriptions[i % descriptions.length], '',
      driverId, truckId, createdDate.toISOString(), assignedAt, pickedUpAt, inTransitAt, deliveredAt,
      estimatedDelivery, price, distance
    );

    insertHistory.run(uuidv4(), id, 'pending', createdDate.toISOString(), 'Order created', 'system');
    if (assignedAt) insertHistory.run(uuidv4(), id, 'assigned', assignedAt, 'Driver assigned', 'dispatcher');
    if (pickedUpAt) insertHistory.run(uuidv4(), id, 'picked_up', pickedUpAt, 'Package picked up', 'driver');
    if (inTransitAt) insertHistory.run(uuidv4(), id, 'in_transit', inTransitAt, 'In transit to destination', 'driver');
    if (deliveredAt) insertHistory.run(uuidv4(), id, 'delivered', deliveredAt, 'Successfully delivered', 'driver');
  }

  const insertNotif = db.prepare(`
    INSERT INTO notifications (id, type, title, message, read, created_at, related_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const notifs = [
    { type: 'alert', title: 'Low Fuel Alert', message: 'Truck OSI-005 fuel level is at 40%. Schedule refueling.', read: 0 },
    { type: 'order', title: 'New Urgent Order', message: 'New urgent order requires immediate assignment.', read: 0 },
    { type: 'driver', title: 'Driver Available', message: 'Ana Martinez has completed her delivery and is now available.', read: 0 },
    { type: 'truck', title: 'Maintenance Due', message: 'Truck OSI-002 is due for maintenance on June 20, 2026.', read: 1 },
    { type: 'order', title: 'Delivery Completed', message: 'Order OSI-2024101 has been successfully delivered.', read: 1 },
    { type: 'system', title: 'System Update', message: 'OSI Logistics platform updated to version 2.1.0', read: 1 },
  ];

  const now = new Date();
  for (let i = 0; i < notifs.length; i++) {
    const t = new Date(now.getTime() - i * 15 * 60000);
    insertNotif.run(uuidv4(), notifs[i].type, notifs[i].title, notifs[i].message, notifs[i].read, t.toISOString(), null);
  }

  console.log('✅ Database seeded with sample data');
}
