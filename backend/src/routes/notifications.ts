import { Router, Request, Response } from 'express';
import { exec, query, queryOne } from '../database';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const [notifications, unread] = await Promise.all([
      query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50'),
      queryOne<{c:number}>('SELECT COUNT(*) as c FROM notifications WHERE read = 0'),
    ]);
    res.json({ notifications, unread: unread?.c ?? 0 });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/read-all', async (_req: Request, res: Response) => {
  try { await exec('UPDATE notifications SET read = 1'); res.json({ success: true }); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/:id/read', async (req: Request, res: Response) => {
  try { await exec('UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try { await exec('DELETE FROM notifications WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/', async (_req: Request, res: Response) => {
  try { await exec('DELETE FROM notifications WHERE read = 1'); res.json({ success: true }); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/driver/:driverId', async (req: Request, res: Response) => {
  try {
    const [notifications, unread] = await Promise.all([
      query('SELECT * FROM notifications WHERE target_driver_id = ? ORDER BY created_at DESC LIMIT 50', [req.params.driverId]),
      queryOne<{c:number}>('SELECT COUNT(*) as c FROM notifications WHERE target_driver_id = ? AND read = 0', [req.params.driverId]),
    ]);
    res.json({ notifications, unread: unread?.c ?? 0 });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/driver/:driverId/read-all', async (req: Request, res: Response) => {
  try { await exec('UPDATE notifications SET read = 1 WHERE target_driver_id = ?', [req.params.driverId]); res.json({ success: true }); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
