import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { exec, query, queryOne } from '../database';

const router = Router();

const isDemo = (email?: string) => (email ?? '').endsWith('@osilogistics.com');

// Real, shared company feed -- replaces the two previously-fake, local-state-only
// "Comunidad" feeds that existed independently in the dispatcher and driver apps.
// Dispatchers and drivers now post into and read the same feed (demo/real scoped
// with the same isDemo(email) convention used for orders/drivers/tracking).
router.get('/', async (req: Request, res: Response) => {
  try {
    const demo = req.user?.role !== 'admin' && isDemo(req.user?.email);
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const posts = await query<{
      id: string; author_name: string; author_role: string; message: string;
      created_at: string; likes_count: number; liked: number;
    }>(`
      SELECT p.id, p.author_name, p.author_role, p.message, p.created_at,
             (SELECT COUNT(*) FROM community_post_likes l WHERE l.post_id = p.id) as likes_count,
             EXISTS(SELECT 1 FROM community_post_likes l WHERE l.post_id = p.id AND l.liker_key = ?) as liked
      FROM community_posts p
      WHERE p.is_demo = ?
      ORDER BY p.created_at DESC
      LIMIT ?
    `, [req.user?.id ?? '', demo ? 1 : 0, limit]);
    res.json(posts.map(p => ({ ...p, liked: !!p.liked })));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const message = String(req.body.message ?? '').trim().slice(0, 280);
    if (!message) return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });

    const demo = req.user.role !== 'admin' && isDemo(req.user.email);
    const id = uuidv4();
    await exec(
      `INSERT INTO community_posts (id, author_user_id, author_driver_id, author_name, author_role, message, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, req.user.driver_id ?? null, req.user.name, req.user.role, message, demo ? 1 : 0]
    );
    const post = await queryOne('SELECT id, author_name, author_role, message, created_at FROM community_posts WHERE id = ?', [id]);
    res.json({ ...post, likes_count: 0, liked: false });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/like', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    const existing = await queryOne('SELECT 1 FROM community_post_likes WHERE post_id = ? AND liker_key = ?', [req.params.id, req.user.id]);
    if (existing) {
      await exec('DELETE FROM community_post_likes WHERE post_id = ? AND liker_key = ?', [req.params.id, req.user.id]);
    } else {
      await exec('INSERT OR IGNORE INTO community_post_likes (post_id, liker_key) VALUES (?, ?)', [req.params.id, req.user.id]);
    }
    const countRow = await queryOne<{ c: number }>('SELECT COUNT(*) as c FROM community_post_likes WHERE post_id = ?', [req.params.id]);
    res.json({ likes_count: countRow?.c ?? 0, liked: !existing });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
