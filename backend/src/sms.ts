export async function sendSmsCode(phone: string, code: string): Promise<void> {
  const key = process.env.TEXTBELT_KEY || 'textbelt';
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.length === 10 ? '1' + digits : digits;

  const res = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: normalized,
      message: `Tu código de verificación OSI Logistics: ${code}. Válido por 10 minutos.`,
      key,
    }),
  });

  const json = await res.json() as { success: boolean; error?: string };
  if (!json.success) throw new Error(json.error || 'SMS no enviado');
}
