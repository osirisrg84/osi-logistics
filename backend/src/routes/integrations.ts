import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { query } from '../database';

// Endpoints de SOLO LECTURA para sistemas internos hermanos (hoy: Project 16.0 "Centro de
// Automatizacion"). Se protegen con una API key propia (INTEGRATION_API_KEY), NO con una sesion de
// admin: el consumidor nunca recibe ni guarda una credencial con acceso a todo el sistema.
//
// Contrato deliberadamente minimo: nunca se devuelven SSN, fecha de nacimiento, datos de pago,
// documentos ni verificaciones. Si algun dia hace falta otro campo, se agrega aqui a proposito.
const router = Router();

function keyMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Fail-closed: sin INTEGRATION_API_KEY configurada, el endpoint no existe para nadie.
router.use((req: Request, res: Response, next) => {
  const expected = (process.env.INTEGRATION_API_KEY || '').trim();
  if (!expected) return res.status(404).json({ error: 'Not found' });
  if (!keyMatches(req.header('x-integration-key'), expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET /api/integrations/contacts
// Dispatchers y drivers reales. Excluye admins y toda cuenta @osilogistics.com (admin + cuentas demo
// sembradas), que nunca deben recibir correos de secuencias.
router.get('/contacts', async (_req: Request, res: Response) => {
  try {
    const rows = await query<{
      id: string; name: string; email: string; phone: string | null;
      role: string; active: number; approval_status: string; created_at: string;
    }>(`
      SELECT u.id, u.name, u.email,
             COALESCE(NULLIF(TRIM(u.phone), ''), d.phone) AS phone,
             u.role, u.active, u.approval_status, u.created_at
      FROM users u
      LEFT JOIN drivers d ON u.driver_id = d.id
      WHERE u.role IN ('dispatcher', 'driver')
        AND LOWER(u.email) NOT LIKE '%@osilogistics.com'
      ORDER BY u.created_at ASC
    `);

    res.json({
      generatedAt: new Date().toISOString(),
      contacts: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone || null,
        role: r.role,
        // Solo "activo" si la cuenta esta habilitada Y aprobada por un admin.
        status: r.active === 1 && r.approval_status === 'approved' ? 'active' : 'inactive',
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('integrations/contacts error', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
