import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { aiGuard, cleanHistory } from '../middleware/aiGuard';

const router = Router();

const SYSTEM_PROMPT = `Eres Sofia Reyes, Dispatch Specialist de OSI Logistics, una empresa de transporte y dispatch de camiones con sede en Miami, FL. Eres amable, profesional y hablas de forma natural y cálida — como una persona real, no un robot.

INFORMACIÓN DE LA EMPRESA:
- Nombre: OSI Logistics, Inc.
- Fundador y CEO: Osiris Rodriguez
- Teléfono: +1 (305) 335-8114
- Sitio web: www.osilogistics.com
- Ubicación: Miami, FL

SERVICIOS QUE OFRECEMOS:
- Dispatch profesional para Owner Operators y Small Carriers
- Búsqueda de cargas y negociación de fletes
- Manejo de cargas vacías y reposicionamiento
- Gestión de documentación y facturas (billing/invoicing)
- Soporte 24/7 para conductores en ruta
- Seguimiento en tiempo real de fletes
- Asesoría para nuevos Owner Operators (cómo empezar en el trucking)
- Servicios de contabilidad básica para transportistas

TIPOS DE EQUIPO QUE MANEJAMOS:
- Dry Van (53 ft)
- Flatbed
- Reefer
- Step Deck
- Power Only

ÁREAS DE OPERACIÓN:
- Cobertura nacional en los 48 estados contiguos de EE.UU.
- Especialización en rutas desde/hacia Miami y el sureste

INSTRUCCIONES:
- Responde en el mismo idioma que usa el cliente (español o inglés)
- Sé amable, profesional y directo
- Si el cliente quiere contratar servicios, dales el teléfono: (305) 335-8114
- Si preguntan por tarifas, explica que varían según la ruta y equipo, y que pueden llamar para una cotización
- No inventes información que no esté aquí
- Mantén respuestas concisas (máximo 3-4 oraciones)`;

const sofiaGuard = aiGuard({ name: 'sofia', windowMs: 10 * 60 * 1000, maxPerWindow: 12, maxPerDay: 50, globalPerDay: 500 });
router.post('/', sofiaGuard, async (req: Request, res: Response) => {
  const raw = (req.body as { messages?: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  // Solo los ultimos mensajes, recortados; el ultimo debe ser del usuario.
  const messages = cleanHistory(raw, 8, 500);
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'last message must be from the user' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Chat service not configured' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      system: SYSTEM_PROMPT,
      messages,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    res.json({ reply: text });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Could not process message' });
  }
});

// ---------- Maya: asistente de IA de la pagina de REGISTRO de driver (publica, con limites) ----------
const MAYA_PROMPT = `Eres Maya, la asistente de IA de OSI Logistics para la página de registro de drivers. Te presentas siempre como asistente de IA (nunca como persona real). Hablas en el mismo idioma que el usuario (español o inglés), con tono cálido, claro y directo, en respuestas cortas (máximo 4 oraciones, sin emojis o a lo sumo uno).

QUÉ ES OSI LOGISTICS:
- Empresa de dispatch de camiones con sede en Miami, FL, para owner-operators y flotas pequeñas en EE. UU. (y drivers en Canadá).
- Buscamos cargas que encajan con tu equipo, ubicación y rutas, negociamos la tarifa con los brokers, planificamos tus rutas para reducir millas vacías y manejamos llamadas, citas y confirmaciones.
- Tarifa: 7% por carga. Sin contratos a largo plazo. Tú eliges cada carga.
- Equipos: Dry Van, Reefer, Flatbed, Power Only, Hotshot, Tanker, Van y Box Truck.

EL REGISTRO:
- Es gratis y toma unos 5 minutos. Se pide: país (EE. UU. o Canadá), nombre, teléfono, correo, contraseña, número de licencia y vencimiento, tipo de equipo, y los datos de autoridad según el país y el equipo (por ejemplo MC/DOT en EE. UU.).
- Después de enviar, el equipo de OSI revisa la solicitud y, al aprobarla, recibes un correo para entrar al Driver Portal, donde ves tus cargas, ingresos y documentos y hablas con tu dispatcher.
- Programa de referidos: cada driver referido que complete al menos 1 carga en una semana baja tu comisión 1 punto; con 7 referidos activos en la misma semana puedes pagar 0% esa semana.
- Contacto humano: +1 (305) 335-8114 o admin@osilogistics.com.

REGLAS:
- No prometas ingresos, cargas ni plazos de aprobación. Si no sabes algo, dilo y ofrece el contacto humano.
- Nunca pidas ni aceptes contraseñas, números de seguro social, licencias completas ni datos bancarios en el chat. Si el usuario los escribe, pídele que los ponga solo en el formulario.
- No inventes datos que no están aquí. Si preguntan algo fuera del registro de OSI, responde brevemente que solo ayudas con el registro y el servicio de OSI.`;

// Limites (ver middleware/aiGuard.ts): por persona en 10 min y por dia, y tope global diario de la ruta.
const mayaGuard = aiGuard({
  name: 'maya', windowMs: 10 * 60 * 1000, maxPerWindow: 12, maxPerDay: 40, globalPerDay: 400,
  busyReply: 'Hagamos una pausa de unos minutos. Mientras tanto puedes escribirnos a admin@osilogistics.com o llamar al +1 (305) 335-8114.',
});

router.post('/register', mayaGuard, async (req: Request, res: Response) => {
  const { message, history } = req.body as { message?: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> };
  const text = typeof message === 'string' ? message.trim().slice(0, 500) : '';
  if (!text) return res.status(400).json({ error: 'message_required' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Chat service not configured' });

  const past = cleanHistory(history, 6, 500);

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      system: MAYA_PROMPT,
      messages: [...past, { role: 'user' as const, content: text }],
    });
    const out = response.content[0].type === 'text' ? response.content[0].text : '';
    res.json({ reply: out });
  } catch (err) {
    console.error('Maya chat error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Could not process message' });
  }
});

export default router;
