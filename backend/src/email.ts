import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'OSI Logistics <noreply@osilogistics.com>';

export async function sendActivationEmail(to: string, name: string, role: string) {
  const portal = role === 'driver' ? 'Driver Portal' : 'Dispatch Center';
  const link   = role === 'driver'
    ? `${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/driver/login`
    : `${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/dispatcher`;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: '✅ Tu cuenta en OSI Logistics está activa',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f8f9fa;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#f97316;margin:0;font-size:28px;">OSI Logistics</h1>
          <p style="color:#6b7280;margin:4px 0 0;">Dispatch Management</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
          <h2 style="color:#111827;margin:0 0 12px;">¡Hola, ${name}! 👋</h2>
          <p style="color:#374151;line-height:1.6;">
            Tu cuenta en <strong>OSI Logistics</strong> ha sido <span style="color:#10b981;font-weight:bold;">activada</span> por el administrador.
            Ya puedes iniciar sesión en el <strong>${portal}</strong>.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${link}"
              style="background:#f97316;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:15px;display:inline-block;">
              Iniciar sesión →
            </a>
          </div>
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            Si no esperabas este correo, puedes ignorarlo.
          </p>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px;">© OSI Logistics · Miami, FL</p>
      </div>
    `,
  });
}

export async function sendVerificationCode(to: string, name: string, code: string, type: 'email' | 'phone') {
  const label = type === 'email' ? 'correo electrónico' : 'número de teléfono';
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `🔐 Tu código de verificación OSI Logistics: ${code}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f8f9fa;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#f97316;margin:0;font-size:28px;">OSI Logistics</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
          <h2 style="color:#111827;margin:0 0 12px;">Hola, ${name}</h2>
          <p style="color:#374151;line-height:1.6;">
            Tu código para verificar tu <strong>${label}</strong>:
          </p>
          <div style="text-align:center;margin:28px 0;">
            <div style="background:#f97316;color:#fff;font-size:36px;font-weight:bold;letter-spacing:12px;
                        padding:20px 32px;border-radius:12px;display:inline-block;">
              ${code}
            </div>
          </div>
          <p style="color:#6b7280;font-size:13px;text-align:center;">
            Válido por <strong>10 minutos</strong>. No compartas este código con nadie.
          </p>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px;">© OSI Logistics · Miami, FL</p>
      </div>
    `,
  });
}
