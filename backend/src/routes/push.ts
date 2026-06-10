import { Router } from 'express';
import webpush from 'web-push';

export const VAPID_PUBLIC = 'BBeTA9aza6pqeFv37MnvyZEGMB1trlftrwmgSVM_qxkg7WmBmvWqfAy4TMcHly4tWsXCv9n9DVtGeemajEPC2YE';
const VAPID_PRIVATE = 'sQXlHYlrucJRWRB-yCA2ionf9vTpYzTM7YoM_j5ctxU';

webpush.setVapidDetails('mailto:admin@osilogistics.com', VAPID_PUBLIC, VAPID_PRIVATE);

// In-memory subscription store (persists while backend is running)
const subscriptions: webpush.PushSubscription[] = [];

export function sendPushToAll(payload: object): void {
  const data = JSON.stringify(payload);
  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, data).catch(() => {
      // Remove stale subscriptions silently
      const idx = subscriptions.indexOf(sub);
      if (idx > -1) subscriptions.splice(idx, 1);
    });
  });
}

const router = Router();

router.get('/vapid-public-key', (_req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

router.post('/subscribe', (req, res) => {
  const sub = req.body as webpush.PushSubscription;
  if (!sub?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  const exists = subscriptions.some(s => s.endpoint === sub.endpoint);
  if (!exists) subscriptions.push(sub);
  res.json({ ok: true });
});

export default router;
