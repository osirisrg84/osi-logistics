import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

export async function sendSmsCode(to: string, code: string): Promise<void> {
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)');
  }
  const client = twilio(accountSid, authToken);
  await client.messages.create({
    body: `Tu código de verificación OSI Logistics: ${code}. Válido por 10 minutos.`,
    from: fromNumber,
    to,
  });
}
