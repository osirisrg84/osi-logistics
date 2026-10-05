import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { query, queryOne } from '../database';
import { AuthUser } from '../middleware/auth';

const router = Router();

const isDemo = (email?: string) => (email ?? '').endsWith('@osilogistics.com');

// Mirrors orders.ts's getOrderFilter -- kept self-contained here (same
// per-file duplication convention already used across orders.ts/drivers.ts/
// analytics.ts) so the assistant can never see across the demo/real or
// own-data boundary, regardless of what the model asks for.
function getOrderFilter(user: AuthUser): string {
  const demo = user.role !== 'admin' && isDemo(user.email);
  if (user.role === 'admin') {
    return "AND o.order_number NOT LIKE 'OSI-H%' AND (o.dispatcher_user_id IS NULL OR o.dispatcher_user_id NOT IN (SELECT id FROM users WHERE email LIKE '%@osilogistics.com'))";
  }
  if (demo) {
    return "AND (o.order_number LIKE 'OSI-H%' OR o.dispatcher_user_id IN (SELECT id FROM users WHERE email LIKE '%@osilogistics.com'))";
  }
  if (user.role === 'driver') {
    return user.driver_id ? `AND o.order_number NOT LIKE 'OSI-H%' AND o.driver_id = '${user.driver_id}'` : 'AND 1=0';
  }
  return `AND o.order_number NOT LIKE 'OSI-H%' AND o.dispatcher_user_id = '${user.id}'`;
}

function driverFilter(user: AuthUser): string {
  const demo = user.role !== 'admin' && isDemo(user.email);
  return demo ? "d.email LIKE '%@osilogistics.com'" : "d.email NOT LIKE '%@osilogistics.com'";
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function toolSearchOrders(user: AuthUser, input: { status?: string; search?: string; limit?: number }) {
  const of = getOrderFilter(user);
  const filters: string[] = [];
  const params: unknown[] = [];
  if (input.status) { filters.push('o.status = ?'); params.push(input.status); }
  if (input.search) { filters.push('(o.order_number LIKE ? OR o.customer_name LIKE ?)'); params.push(`%${input.search}%`, `%${input.search}%`); }
  const extra = filters.length ? ' AND ' + filters.join(' AND ') : '';
  const limit = Math.min(Number(input.limit) || 10, 25);
  return query(
    `SELECT o.order_number, o.status, o.customer_name, o.price, o.priority, o.created_at, o.delivered_at,
            d.name as driver_name
     FROM orders o LEFT JOIN drivers d ON o.driver_id = d.id
     WHERE 1=1 ${of}${extra}
     ORDER BY o.created_at DESC LIMIT ?`,
    [...params, limit]
  );
}

async function toolDriverStats(user: AuthUser, input: { name?: string }) {
  const df = driverFilter(user);
  const params: unknown[] = [];
  let nameFilter = '';
  if (input.name) { nameFilter = 'AND d.name LIKE ?'; params.push(`%${input.name}%`); }
  return query(
    `SELECT d.name, d.status, d.rating, d.total_deliveries, d.on_time_rate
     FROM drivers d WHERE ${df} ${nameFilter}
     ORDER BY d.total_deliveries DESC LIMIT 10`,
    params
  );
}

async function toolEarningsSummary(user: AuthUser, input: { period_days?: number }) {
  const days = Math.min(Number(input.period_days) || 30, 365);
  if (user.role === 'driver') {
    if (!user.driver_id) return { error: 'No hay un perfil de conductor vinculado a este usuario' };
    const row = await queryOne<{ deliveries: number; total: number }>(
      `SELECT COUNT(*) as deliveries, COALESCE(SUM(price),0) as total
       FROM orders WHERE driver_id = ? AND status = 'delivered' AND delivered_at >= date('now', ?)`,
      [user.driver_id, `-${days} days`]
    );
    return { period_days: days, deliveries: row?.deliveries ?? 0, gross_earnings: row?.total ?? 0 };
  }
  const row = await queryOne<{ loads: number; settled: number; pending: number }>(
    `SELECT COUNT(*) as loads,
            COALESCE(SUM(CASE WHEN dispatcher_status='settled' THEN dispatcher_pay ELSE 0 END),0) as settled,
            COALESCE(SUM(CASE WHEN dispatcher_status='pending' THEN dispatcher_pay ELSE 0 END),0) as pending
     FROM commissions WHERE dispatcher_user_id = ? AND delivery_date >= date('now', ?)`,
    [user.id, `-${days} days`]
  );
  return { period_days: days, loads: row?.loads ?? 0, settled: row?.settled ?? 0, pending: row?.pending ?? 0 };
}

async function toolSuggestBestDriver(user: AuthUser, input: { pickup_lat?: number; pickup_lng?: number }) {
  if (typeof input.pickup_lat !== 'number' || typeof input.pickup_lng !== 'number') {
    return { error: 'pickup_lat y pickup_lng son requeridos' };
  }
  const df = driverFilter(user);
  const drivers = await query<{ name: string; status: string; rating: number; current_lat: number; current_lng: number }>(
    `SELECT d.name, d.status, d.rating, d.current_lat, d.current_lng FROM drivers d WHERE ${df} AND d.status IN ('available','busy')`
  );
  return drivers
    .map(d => ({ ...d, distance_km: Math.round(haversineKm(input.pickup_lat as number, input.pickup_lng as number, d.current_lat, d.current_lng) * 10) / 10 }))
    .sort((a, b) => (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1) || a.distance_km - b.distance_km || b.rating - a.rating)
    .slice(0, 3);
}

async function runTool(name: string, input: Record<string, unknown>, user: AuthUser): Promise<unknown> {
  try {
    switch (name) {
      case 'search_orders': return await toolSearchOrders(user, input);
      case 'get_driver_stats': return await toolDriverStats(user, input);
      case 'get_earnings_summary': return await toolEarningsSummary(user, input);
      case 'suggest_best_driver': return await toolSuggestBestDriver(user, input as { pickup_lat?: number; pickup_lng?: number });
      default: return { error: 'Unknown tool' };
    }
  } catch (err) {
    console.error(`[Assistant] tool ${name} failed:`, err);
    return { error: 'La herramienta falló al ejecutarse' };
  }
}

const SEARCH_ORDERS_TOOL: Anthropic.Tool = {
  name: 'search_orders',
  description: 'Busca órdenes/cargas por estado o texto (número de orden o cliente). Devuelve hasta 25 resultados, las más recientes primero.',
  input_schema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['pending', 'offered', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'], description: 'Filtrar por estado exacto' },
      search: { type: 'string', description: 'Buscar por número de orden o nombre de cliente' },
      limit: { type: 'number', description: 'Máximo de resultados (default 10, máx 25)' },
    },
  },
};

const DRIVER_STATS_TOOL: Anthropic.Tool = {
  name: 'get_driver_stats',
  description: 'Consulta estadísticas de conductores (rating, entregas totales, % a tiempo, estado actual). Opcionalmente filtra por nombre.',
  input_schema: {
    type: 'object',
    properties: { name: { type: 'string', description: 'Nombre (o parte del nombre) del conductor a buscar' } },
  },
};

const EARNINGS_TOOL: Anthropic.Tool = {
  name: 'get_earnings_summary',
  description: 'Resume las ganancias propias del usuario actual (del dispatcher o del driver que está preguntando) en los últimos N días.',
  input_schema: {
    type: 'object',
    properties: { period_days: { type: 'number', description: 'Ventana de días hacia atrás (default 30, máx 365)' } },
  },
};

const SUGGEST_DRIVER_TOOL: Anthropic.Tool = {
  name: 'suggest_best_driver',
  description: 'Sugiere los 3 mejores conductores disponibles para una carga nueva, según distancia al punto de recogida, disponibilidad y rating.',
  input_schema: {
    type: 'object',
    properties: {
      pickup_lat: { type: 'number', description: 'Latitud del punto de recogida' },
      pickup_lng: { type: 'number', description: 'Longitud del punto de recogida' },
    },
    required: ['pickup_lat', 'pickup_lng'],
  },
};

router.post('/chat', async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'El asistente no está configurado' });

  const { message, history } = req.body as {
    message?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  if (!message || !message.trim()) return res.status(400).json({ error: 'message es requerido' });

  const user = req.user;
  const isDispatchRole = user.role === 'admin' || user.role === 'dispatcher';

  const tools: Anthropic.Tool[] = [
    SEARCH_ORDERS_TOOL,
    EARNINGS_TOOL,
    ...(isDispatchRole ? [DRIVER_STATS_TOOL, SUGGEST_DRIVER_TOOL] : []),
  ];

  const system = isDispatchRole
    ? `Eres el Asistente de Despacho de OSI Logistics, ayudando a ${user.name} (${user.role}). Puedes buscar órdenes, consultar estadísticas de conductores, resumir las comisiones propias del usuario y sugerir el mejor conductor disponible para una carga nueva. Responde siempre en español, de forma breve y directa. Usa SIEMPRE las herramientas para obtener datos reales -- nunca inventes números, nombres o estados. Si una herramienta no devuelve resultados, dilo claramente.`
    : `Eres el Asistente del Conductor de OSI Logistics, ayudando a ${user.name}. Puedes consultar sus propias órdenes y sus ganancias. Responde siempre en español, de forma breve y directa. Usa SIEMPRE las herramientas para obtener datos reales -- nunca inventes números. Nunca reveles información de otros conductores.`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const messages: Anthropic.MessageParam[] = [
      ...(history ?? []).slice(-6).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message.trim() },
    ];

    let finalText = 'No pude procesar la solicitud, intenta de nuevo.';
    for (let i = 0; i < 4; i++) {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system,
        tools,
        messages,
      });

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (toolUses.length === 0) {
        finalText = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n') || finalText;
        break;
      }

      messages.push({ role: 'assistant', content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const result = await runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, user);
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    res.json({ reply: finalText });
  } catch (err) {
    console.error('[Assistant] error:', err);
    res.status(500).json({ error: 'No se pudo procesar el mensaje' });
  }
});

export default router;
