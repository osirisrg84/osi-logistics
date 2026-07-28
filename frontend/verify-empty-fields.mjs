import { chromium } from 'playwright';
import path from 'node:path';

const shotsDir = path.resolve('verify-shots');
await import('node:fs').then(fs => fs.mkdirSync(shotsDir, { recursive: true }));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(String(err)));

async function shot(name) {
  await page.screenshot({ path: path.join(shotsDir, name), fullPage: false });
  console.log('screenshot:', name);
}

try {
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  console.log('URL after nav:', page.url());
  await shot('00-landing.png');

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await emailInput.waitFor({ timeout: 15000 });
  await emailInput.fill('admin@osilogistics.com');
  const passInput = page.locator('input[type="password"]').first();
  await passInput.fill('Admin123!');
  await page.locator('button[type="submit"]').first().click();

  await page.waitForTimeout(2500);
  console.log('URL after login:', page.url());
  await shot('01-after-login.png');

  // Dashboard - Recent Activity
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot('02-dashboard.png');

  // Orders page - desktop table + mobile cards
  await page.goto('http://localhost:5173/orders', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot('03-orders-desktop.png');

  await page.setViewportSize({ width: 420, height: 900 });
  await page.waitForTimeout(500);
  await shot('04-orders-mobile.png');
  await page.setViewportSize({ width: 1400, height: 900 });

  // Drivers page - detail Recent Orders
  await page.goto('http://localhost:5173/drivers', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot('05-drivers-list.png');

  const firstDriverRow = page.locator('table tbody tr, [class*="card"]').first();
  if (await firstDriverRow.count() > 0) {
    await firstDriverRow.click();
    await page.waitForTimeout(1500);
    await shot('06-driver-detail.png');
  }

  console.log('CONSOLE ERRORS:', JSON.stringify(errors, null, 2));
} catch (e) {
  console.error('SCRIPT ERROR:', e);
  await shot('99-error.png').catch(() => {});
} finally {
  await browser.close();
}
