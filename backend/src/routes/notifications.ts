import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const notifications = db.prepare(`
    SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50
  `).all();
  const unread = (db.prepare('SELECT COUNT(*) as c FROM notifications WHERE read = 0').get() as { c: number }).c;
  res.json({ notifications, unread });
});

router.put('/read-all', (_req: Request, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1').run();
  res.json({ success: true });
});

router.put('/:id/read', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.delete('/', (_req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM notifications WHERE read = 1').run();
  res.json({ success: true });
});

export default router;
