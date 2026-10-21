import { Router, Request, Response } from 'express';
import { exec, query, queryOne } from '../database';

const router = Router();

// Esta tabla mezcla dos cosas: notificaciones "broadcast" para dispatchers/
// admin (target_driver_id = NULL, ej. "Order Assigned") y notificaciones
// privadas de UN driver especifico (target_driver_id = su id, ej. "Nueva
// oferta de carga"). Ninguna ruta de aqui chequeaba `req.user` en absoluto --
// cualquier usuario autenticado, incluido un driver, podia leer/marcar/borrar
// TODAS las notificaciones de TODOS, y /driver/:driverId dejaba a cualquier
// driver leer el feed privado de CUALQUIER OTRO driver con solo cambiar el id
// en la URL.

router.get('/', async (req: Request, res: Response) => {
  try {
    if (req.user?.role === 'driver') return res.status(403).json({ error: 'No autorizado' });
    const [notifications, unread] = await Promise.all([
      query('SELECT * FROM notifications WHERE target_driver_id IS NULL ORDER BY created_at DESC LIMIT 50'),
      queryOne<{c:number}>('SELECT COUNT(*) as c FROM notifications WHERE target_driver_id IS NULL AND read = 0'),
    ]);
    res.json({ notifications, unread: unread?.c ?? 0 });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/read-all', async (req: Request, res: Response) => {
  try {
    if (req.user?.role === 'driver') return res.status(403).json({ error: 'No autorizado' });
    await exec('UPDATE notifications SET read = 1 WHERE target_driver_id IS NULL');
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const row = await queryOne<{ target_driver_id: string | null }>('SELECT target_driver_id FROM notifications WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const isMine = row.target_driver_id === null ? req.user?.role !== 'driver' : req.user?.driver_id === row.target_driver_id;
    if (!isMine) return res.status(403).json({ error: 'No autorizado' });
    await exec('UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const row = await queryOne<{ target_driver_id: string | null }>('SELECT target_driver_id FROM notifications WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const isMine = row.target_driver_id === null ? req.user?.role !== 'driver' : req.user?.driver_id === row.target_driver_id;
    if (!isMine) return res.status(403).json({ error: 'No autorizado' });
    await exec('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/', async (req: Request, res: Response) => {
  try {
    if (req.user?.role === 'driver') return res.status(403).json({ error: 'No autorizado' });
    await exec('DELETE FROM notifications WHERE read = 1 AND target_driver_id IS NULL');
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/driver/:driverId', async (req: Request, res: Response) => {
  try {
    if (req.user?.role === 'driver' && req.user.driver_id !== req.params.driverId) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const [notifications, unread] = await Promise.all([
      query('SELECT * FROM notifications WHERE target_driver_id = ? ORDER BY created_at DESC LIMIT 50', [req.params.driverId]),
      queryOne<{c:number}>('SELECT COUNT(*) as c FROM notifications WHERE target_driver_id = ? AND read = 0', [req.params.driverId]),
    ]);
    res.json({ notifications, unread: unread?.c ?? 0 });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/driver/:driverId/read-all', async (req: Request, res: Response) => {
  try {
    if (req.user?.role === 'driver' && req.user.driver_id !== req.params.driverId) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    await exec('UPDATE notifications SET read = 1 WHERE target_driver_id = ?', [req.params.driverId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
