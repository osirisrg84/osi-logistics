import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;

let cachedVerifySid = process.env.TWILIO_VERIFY_SID || '';

function getClient() {
  if (!accountSid || !authToken) throw new Error('Twilio not configured');
  return twilio(accountSid, authToken);
}

async function getVerifySid(): Promise<string> {
  if (cachedVerifySid) return cachedVerifySid;
  const client = getClient();
  const service = await client.verify.v2.services.create({ friendlyName: 'OSI Logistics' });
  cachedVerifySid = service.sid;
  console.log(`[Twilio] Verify Service creado: ${cachedVerifySid} — agrega TWILIO_VERIFY_SID=${cachedVerifySid} a Render`);
  return cachedVerifySid;
}

export async function sendSmsVerification(to: string): Promise<void> {
  const client = getClient();
  const sid = await getVerifySid();
  await client.verify.v2.services(sid).verifications.create({ to, channel: 'sms' });
}

export async function checkSmsVerification(to: string, code: string): Promise<boolean> {
  const client = getClient();
  const sid = await getVerifySid();
  const result = await client.verify.v2.services(sid).verificationChecks.create({ to, code });
  return result.status === 'approved';
}
