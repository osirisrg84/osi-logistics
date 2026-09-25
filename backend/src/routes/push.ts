import { Router } from 'express';
import webpush from 'web-push';
import { v4 as uuidv4 } from 'uuid';
import { exec, query } from '../database';

export const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY
  || 'BBeTA9aza6pqeFv37MnvyZEGMB1trlftrwmgSVM_qxkg7WmBmvWqfAy4TMcHly4tWsXCv9n9DVtGeemajEPC2YE';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
  || 'sQXlHYlrucJRWRB-yCA2ionf9vTpYzTM7YoM_j5ctxU';

webpush.setVapidDetails('mailto:admin@osilogistics.com', VAPID_PUBLIC, VAPID_PRIVATE);

type StoredSub = { endpoint: string; p256dh: string; auth: string };

async function sendToSubscriptions(subs: StoredSub[], payload: object): Promise<void> {
  const data = JSON.stringify(payload);
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data);
    } catch (e) {
      const statusCode = (e as { statusCode?: number })?.statusCode;
      // 404/410 = the browser/OS invalidated this subscription — stop trying it.
      if (statusCode === 404 || statusCode === 410) {
        await exec('DELETE FROM push_subscriptions WHERE endpoint = ?', [s.endpoint]);
      }
    }
  }));
}

export async function sendPushToAll(payload: object): Promise<void> {
  const subs = await query<StoredSub>('SELECT endpoint, p256dh, auth FROM push_subscriptions');
  await sendToSubscriptions(subs, payload);
}

export async function sendPushToDriver(driverId: string, payload: object): Promise<void> {
  if (!driverId) return;
  const subs = await query<StoredSub>('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE driver_id = ?', [driverId]);
  await sendToSubscriptions(subs, payload);
}

const router = Router();

router.get('/vapid-public-key', (_req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

router.post('/subscribe', async (req, res) => {
  const sub = req.body as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    res.status(400).json({ error: 'Invalid subscription' });
    return;
  }
  const driverId = req.user?.driver_id || null;
  await exec(
    `INSERT INTO push_subscriptions (id, driver_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET driver_id = excluded.driver_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [uuidv4(), driverId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  );
  res.json({ ok: true });
});

router.post('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (endpoint) await exec('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
  res.json({ ok: true });
});

export default router;
