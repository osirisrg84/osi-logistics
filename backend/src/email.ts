import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'OSI Logistics <onboarding@resend.dev>';

export async function sendActivationEmail(to: string, name: string, role: string) {
  const isDriver     = role === 'driver';
  const isAdmin      = role === 'admin';
  const color        = isDriver ? '#3b82f6' : isAdmin ? '#6366f1' : '#f97316';
  const subtitle     = isDriver ? 'Driver Portal' : isAdmin ? 'Admin Management' : 'Dispatch Management';
  const portalLabel  = isDriver ? 'Driver Portal' : isAdmin ? 'Admin Console' : 'Dispatch Console';
  const link         = isDriver
    ? `${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/driver/login`
    : `${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/dispatcher`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: '✅ Tu cuenta en OSI Logistics está activa',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f8f9fa;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:${color};margin:0;font-size:28px;">OSI Logistics</h1>
          <p style="color:#6b7280;margin:4px 0 0;">${subtitle}</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
          <h2 style="color:#111827;margin:0 0 12px;">¡Hola, ${name}! 👋</h2>
          <p style="color:#374151;line-height:1.6;">
            Tu cuenta en <strong>OSI Logistics</strong> ha sido <span style="color:#10b981;font-weight:bold;">activada</span> por el administrador.
            Ya puedes iniciar sesión en el <strong>${portalLabel}</strong>.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${link}"
              style="background:${color};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:15px;display:inline-block;">
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

export async function sendOfferEmail(to: string, driverName: string, orderNumber: string, pickup: string, delivery: string, rate: number) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `🚛 Nueva oferta de carga — ${orderNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f8f9fa;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#3b82f6;margin:0;font-size:28px;">OSI Logistics</h1>
          <p style="color:#6b7280;margin:4px 0 0;">Driver Portal</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
          <h2 style="color:#111827;margin:0 0 4px;">¡Hola, ${driverName}!</h2>
          <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">Tienes una nueva oferta de carga esperando tu respuesta.</p>

          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;margin-bottom:20px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#3b82f6;text-transform:uppercase;letter-spacing:1px;">Orden ${orderNumber}</p>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;align-items:flex-start;gap:8px;">
                <span style="color:#10b981;font-size:16px;margin-top:2px;">●</span>
                <div><p style="margin:0;font-size:11px;color:#6b7280;">Origen</p><p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${pickup}</p></div>
              </div>
              <div style="border-left:2px dashed #bfdbfe;margin-left:7px;height:12px;"></div>
              <div style="display:flex;align-items:flex-start;gap:8px;">
                <span style="color:#ef4444;font-size:16px;margin-top:2px;">●</span>
                <div><p style="margin:0;font-size:11px;color:#6b7280;">Destino</p><p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${delivery}</p></div>
              </div>
            </div>
            ${rate ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #bfdbfe;"><p style="margin:0;font-size:18px;font-weight:bold;color:#10b981;">$${rate.toLocaleString('en-US', {minimumFractionDigits:2})}</p><p style="margin:0;font-size:11px;color:#6b7280;">Tarifa de carga</p></div>` : ''}
          </div>

          <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">Inicia sesión en el Driver Portal para aceptar o rechazar la oferta.</p>

          <div style="text-align:center;">
            <a href="${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/driver/login"
              style="background:#3b82f6;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:15px;display:inline-block;">
              Ver oferta →
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px;">© OSI Logistics · Miami, FL</p>
      </div>
    `,
  });
}

export async function sendDeliveryEmail(to: string, recipientName: string, role: 'driver' | 'dispatcher', orderNumber: string, pickup: string, delivery: string, deliveredAt: string, rate: number) {
  const isDriver = role === 'driver';
  const color    = isDriver ? '#3b82f6' : '#f97316';
  const subtitle = isDriver ? 'Driver Portal' : 'Dispatch Management';
  const link     = isDriver
    ? `${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/driver/login`
    : `${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/dispatcher`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `📦 Entrega completada — ${orderNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f8f9fa;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:${color};margin:0;font-size:28px;">OSI Logistics</h1>
          <p style="color:#6b7280;margin:4px 0 0;">${subtitle}</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
          <h2 style="color:#111827;margin:0 0 4px;">¡Hola, ${recipientName}!</h2>
          <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">La entrega fue completada exitosamente.</p>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
              <span style="font-size:24px;">📦</span>
              <div>
                <p style="margin:0;font-size:12px;font-weight:bold;color:#16a34a;text-transform:uppercase;letter-spacing:1px;">Entregado</p>
                <p style="margin:0;font-size:16px;font-weight:bold;color:#111827;">Orden ${orderNumber}</p>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:#374151;">
              <p style="margin:0;"><strong>Origen:</strong> ${pickup}</p>
              <p style="margin:0;"><strong>Destino:</strong> ${delivery}</p>
              <p style="margin:0;"><strong>Entregado:</strong> ${new Date(deliveredAt).toLocaleString('es-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              ${rate ? `<p style="margin:8px 0 0;font-size:16px;font-weight:bold;color:#10b981;">$${rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>` : ''}
            </div>
          </div>

          <div style="text-align:center;">
            <a href="${link}" style="background:${color};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:15px;display:inline-block;">
              Ver detalles →
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px;">© OSI Logistics · Miami, FL</p>
      </div>
    `,
  });
}

export async function sendOfferAcceptedEmail(to: string, dispatcherName: string, driverName: string, orderNumber: string, pickup: string, delivery: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `✅ Oferta aceptada — ${orderNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f8f9fa;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#f97316;margin:0;font-size:28px;">OSI Logistics</h1>
          <p style="color:#6b7280;margin:4px 0 0;">Dispatch Management</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
          <h2 style="color:#111827;margin:0 0 4px;">¡Hola, ${dispatcherName}!</h2>
          <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">El conductor aceptó tu oferta de carga.</p>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
              <span style="font-size:20px;">✅</span>
              <div>
                <p style="margin:0;font-size:12px;font-weight:bold;color:#16a34a;text-transform:uppercase;letter-spacing:1px;">Aceptada</p>
                <p style="margin:0;font-size:15px;font-weight:bold;color:#111827;">Orden ${orderNumber}</p>
              </div>
            </div>
            <p style="margin:0 0 4px;font-size:13px;color:#374151;"><strong>Conductor:</strong> ${driverName}</p>
            <p style="margin:0 0 12px;font-size:13px;color:#374151;"><strong>Origen:</strong> ${pickup}</p>
            <p style="margin:0;font-size:13px;color:#374151;"><strong>Destino:</strong> ${delivery}</p>
          </div>

          <div style="text-align:center;">
            <a href="${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/dispatcher"
              style="background:#f97316;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:15px;display:inline-block;">
              Ver en Dispatch Console →
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px;">© OSI Logistics · Miami, FL</p>
      </div>
    `,
  });
}

export async function sendVerificationCode(to: string, name: string, code: string, type: 'email' | 'phone', role = 'driver') {
  const label = type === 'email' ? 'correo electrónico' : 'número de teléfono';
  const accent = role === 'admin' ? '#4f46e5' : role === 'dispatcher' ? '#f97316' : '#2563eb';
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Tu código de verificación OSI Logistics: ${code}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#f1f5f9;padding:32px 16px;">
        <div style="background:#0f172a;border-radius:12px 12px 0 0;padding:20px 32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:1px;">OSI Logistics</h1>
        </div>
        <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e2e8f0;border-top:none;">
          <h2 style="color:#111827;margin:0 0 8px;font-size:18px;">Hola, ${name}</h2>
          <p style="color:#374151;line-height:1.6;margin:0 0 28px;">
            Tu código para verificar tu <strong>${label}</strong>:
          </p>
          <div style="background:${accent};border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <span style="color:#fff;font-size:40px;font-weight:800;letter-spacing:10px;">${code}</span>
          </div>
          <p style="color:#6b7280;font-size:13px;text-align:center;margin:0;">
            Válido por <strong>10 minutos</strong>. No compartas este código con nadie.
          </p>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px;">© OSI Logistics · Miami, FL</p>
      </div>
    `,
  });
}
