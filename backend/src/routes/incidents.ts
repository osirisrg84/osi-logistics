import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { exec, query } from '../database';

const router = Router();

const isDemo = (email?: string) => (email ?? '').endsWith('@osilogistics.com');

const CATEGORIES = ['accidente', 'retraso', 'carga_dañada', 'vehiculo', 'comportamiento', 'otro'];

// Wires up what was previously a dead "Reportar Incidente" button in
// DispatcherHub.tsx's Support section (no onClick at all).
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    const order_number = String(req.body.order_number ?? '').trim().slice(0, 40);
    const category = String(req.body.category ?? '').trim();
    const description = String(req.body.description ?? '').trim().slice(0, 1000);
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Categoría inválida' });
    if (!description) return res.status(400).json({ error: 'La descripción es requerida' });

    const demo = req.user.role !== 'admin' && isDemo(req.user.email);
    const id = uuidv4();
    await exec(
      `INSERT INTO incident_reports
        (id, reporter_user_id, reporter_driver_id, reporter_name, reporter_role, order_number, category, description, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, req.user.driver_id ?? null, req.user.name, req.user.role, order_number, category, description, demo ? 1 : 0]
    );
    await exec(
      `INSERT INTO notifications (id, type, title, message, read, related_id) VALUES (?, 'alert', '⚠️ Nuevo incidente reportado', ?, 0, ?)`,
      [uuidv4(), `${req.user.name} reportó un incidente${order_number ? ` (orden ${order_number})` : ''}: ${category}`, id]
    );
    res.json({ success: true, id });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
    const rows = await query('SELECT * FROM incident_reports ORDER BY created_at DESC LIMIT 200');
    res.json(rows);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
