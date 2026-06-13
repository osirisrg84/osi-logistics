import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

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

router.post('/', async (req: Request, res: Response) => {
  const { messages } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Chat service not configured' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: messages.slice(-10), // keep last 10 messages for context
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    res.json({ reply: text });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Could not process message' });
  }
});

export default router;
