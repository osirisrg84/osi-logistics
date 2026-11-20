import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM || 'OSI Logistics <onboarding@resend.dev>';

// FROM is a noreply@ address with no real mailbox behind it, so without a
// reply-to every "responde a este correo" in these templates bounces back
// to the sender with a 550 (mailbox doesn't exist). admin@osilogistics.com
// is the one real, monitored mailbox (seeded admin account, already shown
// in every footer), so replies get routed there instead.
const REPLY_TO = process.env.RESEND_REPLY_TO || 'admin@osilogistics.com';

async function sendEmail(payload: Parameters<Resend['emails']['send']>[0]) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${payload.to}`);
    return;
  }
  await resend.emails.send({ replyTo: REPLY_TO, ...payload });
}

// Shared by the driver and dispatcher activation emails -- a gradient video
// card with a "Ver tutorial ahora" CTA. Returns '' (section simply omitted)
// when no tutorial URL is configured yet, instead of linking to a broken or
// placeholder video.
function buildVideoSection(tutorialUrl: string | undefined, poster: string, accentTo: string, audienceLabel: string): string {
  if (!tutorialUrl) return '';
  return `
      <tr><td style="padding:0 0 24px;">
        <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111827;">📹 ${audienceLabel}</p>
        <p style="margin:0 0 14px;font-size:13px;color:#6b7280;line-height:1.6;">
          Un video corto para empezar en minutos. / A short video to get started in minutes.
        </p>
        <a href="${tutorialUrl}" style="display:block;text-decoration:none;">
          <img src="${poster}" alt="${audienceLabel}" width="496" style="display:block;width:100%;max-width:496px;height:auto;border-radius:12px;border:1px solid #e5e7eb;">
        </a>
        <div style="text-align:center;padding:14px 0 0;">
          <a href="${tutorialUrl}" style="display:inline-block;background:${accentTo};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;">
            ▶&nbsp; Ver tutorial ahora
          </a>
        </div>
      </td></tr>`;
}

export async function sendActivationEmail(to: string, name: string, role: string) {
  const isDriver     = role === 'driver';
  const isDispatcher = role === 'dispatcher';
  const isAdmin      = role === 'admin';
  const color       = isDriver ? '#2563eb' : isAdmin ? '#6366f1' : '#f97316';
  const subtitle    = isDriver ? 'Driver Portal' : isAdmin ? 'Admin Management' : 'Dispatch Management';
  const portalLabel = isDriver ? 'Driver Portal' : isAdmin ? 'Admin Console' : 'Dispatch Console';
  const link        = isDriver
    ? `${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/driver/login`
    : `${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/dispatcher`;
  const tutorialUrl = process.env.DRIVER_TUTORIAL_URL || 'https://driver.osilogistics.com/tutorial/driver.html';
  // Sin fallback a proposito -- el video de dispatcher todavia se esta
  // grabando. Hasta que se configure DISPATCHER_TUTORIAL_URL en Render, la
  // seccion de video simplemente no aparece en el correo (ver buildVideoSection).
  const dispatcherTutorialUrl = process.env.DISPATCHER_TUTORIAL_URL || 'https://dispatch.osilogistics.com/tutorial/dispatcher.html';

  if (isDriver) {
    const videoSection = buildVideoSection(tutorialUrl, 'https://driver.osilogistics.com/videos/poster-driver.jpg', '#2563eb', 'Tutorial para Drivers / Driver tutorial');

    await sendEmail({
      from: FROM,
      to,
      subject: '🎉 ¡Bienvenido a OSI Logistics! Tu cuenta de driver está activa',
      html: `
      <!DOCTYPE html>
      <html lang="es">
      <body style="margin:0;padding:0;background:#f0f4f8;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f0f4f8;">
          <tr><td style="padding:32px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;border-collapse:collapse;">

              <!-- HEADER -->
              <tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);border-radius:16px 16px 0 0;padding:32px 32px 28px;text-align:center;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:2px;">OSI Logistics · Driver Portal</p>
                <h1 style="margin:0 0 8px;font-size:32px;font-weight:800;color:#fff;letter-spacing:-0.5px;">¡Bienvenido a bordo!</h1>
                <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.8);">Tu cuenta ha sido verificada y activada</p>
                <div style="margin-top:20px;display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:100px;padding:6px 18px;">
                  <span style="font-size:13px;font-weight:600;color:#fff;">✅ Cuenta Activa</span>
                </div>
              </td></tr>

              <!-- BODY -->
              <tr><td style="background:#fff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">

                  <!-- Greeting -->
                  <tr><td style="padding:0 0 24px;">
                    <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#111827;">Hola, ${name} 👋</h2>
                    <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.7;">
                      El equipo de <strong>OSI Logistics</strong> ha revisado y aprobado tu cuenta. A partir de ahora formas parte de nuestra red de conductores y ya puedes recibir cargas, gestionar tus entregas y administrar tus comisiones desde el <strong>Driver Portal</strong>.
                    </p>
                  </td></tr>

                  <!-- CTA Login -->
                  <tr><td style="padding:0 0 28px;text-align:center;">
                    <a href="${link}"
                      style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:16px 40px;border-radius:10px;font-weight:700;font-size:16px;letter-spacing:0.2px;">
                      Entrar al Driver Portal →
                    </a>
                    <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">https://driver.osilogistics.com/driver</p>
                  </td></tr>

                  <!-- Divider -->
                  <tr><td style="padding:0 0 24px;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>

                  <!-- Steps -->
                  <tr><td style="padding:0 0 24px;">
                    <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111827;">🚀 Pasos para empezar</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td style="padding:10px 0;vertical-align:top;width:36px;">
                          <div style="width:28px;height:28px;background:#eff6ff;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#2563eb;">1</div>
                        </td>
                        <td style="padding:10px 0 10px 8px;vertical-align:top;">
                          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#111827;">Inicia sesión</p>
                          <p style="margin:0;font-size:13px;color:#6b7280;">Usa tu email y la contraseña que registraste en el Driver Portal.</p>
                        </td>
                      </tr>
                      <tr><td colspan="2" style="padding:0 0 2px 0;"><div style="height:1px;background:#f3f4f6;margin-left:36px;"></div></td></tr>
                      <tr>
                        <td style="padding:10px 0;vertical-align:top;width:36px;">
                          <div style="width:28px;height:28px;background:#eff6ff;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#2563eb;">2</div>
                        </td>
                        <td style="padding:10px 0 10px 8px;vertical-align:top;">
                          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#111827;">Completa tu perfil</p>
                          <p style="margin:0;font-size:13px;color:#6b7280;">Agrega tu información de empresa, MC Number, tipo de equipo y datos de autoridad.</p>
                        </td>
                      </tr>
                      <tr><td colspan="2" style="padding:0 0 2px 0;"><div style="height:1px;background:#f3f4f6;margin-left:36px;"></div></td></tr>
                      <tr>
                        <td style="padding:10px 0;vertical-align:top;width:36px;">
                          <div style="width:28px;height:28px;background:#dcfce7;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#16a34a;">3</div>
                        </td>
                        <td style="padding:10px 0 10px 8px;vertical-align:top;">
                          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#111827;">Activa tu GPS y ponte Online</p>
                          <p style="margin:0;font-size:13px;color:#6b7280;">Activa tu GPS y cambia tu estatus a <strong style="color:#16a34a;">Disponible</strong> para comenzar a recibir ofertas de carga del dispatcher.</p>
                        </td>
                      </tr>
                    </table>
                  </td></tr>

                  <!-- Divider -->
                  <tr><td style="padding:0 0 24px;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>

                  <!-- Video Tutorial -->
                  ${videoSection}
                  ${buildGuideBody(name, 'driver')}

                  <!-- Support note -->
                  <tr><td style="padding:0;">
                    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;">
                      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#374151;">¿Necesitas ayuda?</p>
                      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                        Comunícate con nuestro equipo de dispatch a través de la sección <strong>Hub</strong> dentro del Driver Portal o responde a este correo.
                      </p>
                    </div>
                  </td></tr>

                </table>
              </td></tr>

              <!-- FOOTER -->
              <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#374151;">OSI Logistics INC</p>
                <p style="margin:0 0 12px;font-size:11px;color:#9ca3af;">Miami, FL · admin@osilogistics.com</p>
                <p style="margin:0;font-size:11px;color:#d1d5db;">Si no solicitaste esta cuenta, ignora este mensaje.</p>
              </td></tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
      `,
    });
    return;
  }

  if (isDispatcher) {
    const videoSection = buildVideoSection(dispatcherTutorialUrl, 'https://dispatch.osilogistics.com/videos/poster-dispatcher.jpg', '#f97316', 'Tutorial para Dispatchers');

    await sendEmail({
      from: FROM,
      to,
      subject: '🎉 ¡Bienvenido a OSI Logistics! Tu cuenta de dispatcher está activa',
      html: `
      <!DOCTYPE html>
      <html lang="es">
      <body style="margin:0;padding:0;background:#f0f4f8;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f0f4f8;">
          <tr><td style="padding:32px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;border-collapse:collapse;">

              <!-- HEADER -->
              <tr><td style="background:linear-gradient(135deg,#7c2d12 0%,#f97316 100%);border-radius:16px 16px 0 0;padding:32px 32px 28px;text-align:center;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:2px;">OSI Logistics · Dispatch Console</p>
                <h1 style="margin:0 0 8px;font-size:32px;font-weight:800;color:#fff;letter-spacing:-0.5px;">¡Bienvenido a bordo!</h1>
                <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.8);">Tu cuenta ha sido verificada y activada</p>
                <div style="margin-top:20px;display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:100px;padding:6px 18px;">
                  <span style="font-size:13px;font-weight:600;color:#fff;">✅ Cuenta Activa</span>
                </div>
              </td></tr>

              <!-- BODY -->
              <tr><td style="background:#fff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">

                  <!-- Greeting -->
                  <tr><td style="padding:0 0 24px;">
                    <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#111827;">Hola, ${name} 👋</h2>
                    <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.7;">
                      El equipo de <strong>OSI Logistics</strong> ha revisado y aprobado tu cuenta. A partir de ahora puedes gestionar órdenes, asignar conductores y administrar tus comisiones desde la <strong>Dispatch Console</strong>.
                    </p>
                  </td></tr>

                  <!-- CTA Login -->
                  <tr><td style="padding:0 0 28px;text-align:center;">
                    <a href="${link}"
                      style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:16px 40px;border-radius:10px;font-weight:700;font-size:16px;letter-spacing:0.2px;">
                      Entrar al Dispatch Console →
                    </a>
                    <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">https://dispatch.osilogistics.com</p>
                  </td></tr>

                  <!-- Divider -->
                  <tr><td style="padding:0 0 24px;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>

                  <!-- Steps -->
                  <tr><td style="padding:0 0 24px;">
                    <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111827;">🚀 Pasos para empezar</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td style="padding:10px 0;vertical-align:top;width:36px;">
                          <div style="width:28px;height:28px;background:#fff7ed;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#f97316;">1</div>
                        </td>
                        <td style="padding:10px 0 10px 8px;vertical-align:top;">
                          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#111827;">Inicia sesión</p>
                          <p style="margin:0;font-size:13px;color:#6b7280;">Usa tu email y la contraseña que registraste en la Dispatch Console.</p>
                        </td>
                      </tr>
                      <tr><td colspan="2" style="padding:0 0 2px 0;"><div style="height:1px;background:#f3f4f6;margin-left:36px;"></div></td></tr>
                      <tr>
                        <td style="padding:10px 0;vertical-align:top;width:36px;">
                          <div style="width:28px;height:28px;background:#fff7ed;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#f97316;">2</div>
                        </td>
                        <td style="padding:10px 0 10px 8px;vertical-align:top;">
                          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#111827;">Ponte activo (En turno)</p>
                          <p style="margin:0;font-size:13px;color:#6b7280;">Arriba, en la Consola, toca el interruptor <strong style="color:#16a34a;">Activo</strong> hasta que diga <strong style="color:#16a34a;">En turno</strong>. Si estás en &ldquo;Libre&rdquo;, la Consola no te muestra a tus drivers.</p>
                          <img src="https://dispatch.osilogistics.com/email/dispatcher-interruptor-activo.png" alt="Interruptor Activo en la parte de arriba de la Consola, en En turno" width="420" style="display:block;width:100%;max-width:420px;height:auto;margin-top:10px;border:1px solid #e5e7eb;border-radius:10px;">
                        </td>
                      </tr>
                      <tr><td colspan="2" style="padding:0 0 2px 0;"><div style="height:1px;background:#f3f4f6;margin-left:36px;"></div></td></tr>
                      <tr>
                        <td style="padding:10px 0;vertical-align:top;width:36px;">
                          <div style="width:28px;height:28px;background:#fff7ed;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#f97316;">3</div>
                        </td>
                        <td style="padding:10px 0 10px 8px;vertical-align:top;">
                          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#111827;">Completa tu perfil</p>
                          <p style="margin:0;font-size:13px;color:#6b7280;">Agrega tu método de pago y tus datos de contacto desde la sección Mi Perfil.</p>
                        </td>
                      </tr>
                      <tr><td colspan="2" style="padding:0 0 2px 0;"><div style="height:1px;background:#f3f4f6;margin-left:36px;"></div></td></tr>
                      <tr>
                        <td style="padding:10px 0;vertical-align:top;width:36px;">
                          <div style="width:28px;height:28px;background:#dcfce7;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#16a34a;">4</div>
                        </td>
                        <td style="padding:10px 0 10px 8px;vertical-align:top;">
                          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#111827;">Asigna tu primera carga</p>
                          <p style="margin:0;font-size:13px;color:#6b7280;">Crea una orden y asígnala a un conductor <strong style="color:#16a34a;">disponible</strong> para empezar a generar comisiones.</p>
                        </td>
                      </tr>
                    </table>
                  </td></tr>

                  <!-- Divider -->
                  <tr><td style="padding:0 0 24px;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>

                  <!-- Video Tutorial -->
                  ${videoSection}
                  ${buildGuideBody(name, 'dispatcher')}

                  <!-- Support note -->
                  <tr><td style="padding:0;">
                    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;">
                      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#374151;">¿Necesitas ayuda?</p>
                      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                        Comunícate con nuestro equipo a través de la sección <strong>Hub</strong> dentro de la Dispatch Console o responde a este correo.
                      </p>
                    </div>
                  </td></tr>

                </table>
              </td></tr>

              <!-- FOOTER -->
              <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#374151;">OSI Logistics INC</p>
                <p style="margin:0 0 12px;font-size:11px;color:#9ca3af;">Miami, FL · admin@osilogistics.com</p>
                <p style="margin:0;font-size:11px;color:#d1d5db;">Si no solicitaste esta cuenta, ignora este mensaje.</p>
              </td></tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
      `,
    });
    return;
  }

  // Admins — email simple
  await sendEmail({
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

// Segundo correo tras aprobar una cuenta (va junto al de bienvenida): explicacion
// breve de como funciona todo + enlace al PDF. Driver en espanol e ingles,
// dispatcher solo en espanol. Los PDF viven en frontend/public/guias.
// Contenido de la guia de inicio (pasos + boton al PDF). Va DENTRO del correo de bienvenida: asi cada aprobado recibe un solo correo.
function buildGuideBody(name: string, role: string): string {
  const isDriver = role === 'driver';
  const host = isDriver ? 'https://driver.osilogistics.com' : 'https://dispatch.osilogistics.com';
  const pdf = isDriver ? `${host}/guias/OSI-Guia-Driver-ES-EN.pdf` : `${host}/guias/OSI-Guia-Dispatcher.pdf`;
  const from = isDriver ? '#1e3a5f' : '#7c2d12';
  const accent = isDriver ? '#2563eb' : '#f97316';
  const light = isDriver ? '#eff6ff' : '#fff7ed';
  const portal = isDriver ? 'Driver Portal' : 'Dispatch Console';

  const stepRow = (n: number, title: string, text: string) => `
    <tr>
      <td style="padding:8px 0;vertical-align:top;width:36px;"><div style="width:28px;height:28px;background:${light};border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:${accent};">${n}</div></td>
      <td style="padding:8px 0 8px 8px;vertical-align:top;"><p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#111827;">${title}</p><p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">${text}</p></td>
    </tr>`;
  const section = (heading: string, intro: string, steps: string, extra: string, cta: string) => `
    <tr><td style="padding:0 0 8px;">
      <h2 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#111827;">${heading}</h2>
      <p style="margin:0 0 14px;font-size:14px;color:#4b5563;line-height:1.7;">${intro}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${steps}</table>
      ${extra}
      <div style="text-align:center;padding:18px 0 4px;">
        <a href="${pdf}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">${cta}</a>
      </div>
    </td></tr>`;
  const note = (txt: string) => `<div style="background:${light};border-left:4px solid ${accent};border-radius:8px;padding:12px 14px;margin:14px 0 0;font-size:13px;color:#374151;line-height:1.6;">${txt}</div>`;

  const dispatcherSteps =
    stepRow(1, 'Ponte “En turno”', 'Arriba en la Consola, toca el interruptor <b>Activo</b> hasta que diga <b>En turno</b>.') +
    stepRow(2, 'Busca cargas en DAT One o Truckstop', 'Filtra por el equipo y la ciudad de tu driver, mira la tarifa por milla y negocia con el broker. OSI no está conectada a esos servicios: buscas la carga allá y la registras acá.') +
    stepRow(3, 'Crea la orden y ofrécela', 'En <b>Orders</b> pon origen, destino y tarifa, y asígnala a un driver <b>disponible</b> (míralos en Drivers y Tracking).') +
    stepRow(4, 'Sigue la entrega', 'Asignada, recogida, en tránsito, entregada. El driver sube el BOL y el POD.') +
    stepRow(5, 'Cobra tu comisión', 'Recibes el <b>3%</b> de cada carga entregada. Lo ves en <b>Comisiones</b>. Configura tu método de pago en Mi Perfil.');
  const driverStepsEs =
    stepRow(1, 'Completa tu perfil', 'Compañía, MC y DOT, tu equipo y tu certificado de seguro (COI).') +
    stepRow(2, 'Paga tu 7% a OSI', 'Tú cobras de cada carga directo del broker. En <b>Payments</b> pagas a OSI el 7% de esa carga con tarjeta, Zelle o ACH.') +
    stepRow(3, 'Activa el GPS y ponte Online', 'Sin Online no te llegan ofertas de carga.') +
    stepRow(4, 'Acepta una oferta', 'Revisa origen, destino y tarifa; toca <b>Aceptar</b>. Verás el contacto del dispatcher.') +
    stepRow(5, 'Confirma cada paso', 'Recogida, en tránsito, entregada, y sube el BOL y el POD.');
  const driverStepsEn =
    stepRow(1, 'Complete your profile', 'Company, MC and DOT, your equipment and your certificate of insurance (COI).') +
    stepRow(2, 'Pay your 7% to OSI', 'You collect for each load directly from the broker. In <b>Payments</b> you pay OSI 7% of that load by card, Zelle or ACH.') +
    stepRow(3, 'Turn on GPS and go Online', 'If you are not Online, you will not get load offers.') +
    stepRow(4, 'Accept an offer', 'Review origin, destination and rate; tap <b>Accept</b>. You will see the dispatcher&rsquo;s contact.') +
    stepRow(5, 'Confirm each step', 'Picked up, in transit, delivered, and upload the BOL and the POD.');

  const body = isDriver
    ? section('Así funciona OSI, en 2 minutos', `Hola, ${name}. Además de tu bienvenida, aquí tienes lo básico para empezar en el <b>${portal}</b> hoy mismo. Tú cobras de cada carga directo del broker y a OSI le pagas el 7% por gestionarla. Tú eliges qué ofertas aceptar.`, driverStepsEs, '', '📄 Descargar la guía completa (PDF)') +
      `<tr><td style="padding:18px 0;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>` +
      section('How OSI works, in 2 minutes', `Hi ${name}. Besides your welcome email, here are the basics to get started in the <b>${portal}</b> today. You get paid by the broker for each load and you pay OSI 7% for managing it. You choose which offers to accept.`, driverStepsEn, '', '📄 Download the full guide (PDF)')
    : section('Así funciona OSI, en 2 minutos', `Hola, ${name}. Además de tu bienvenida, aquí tienes lo básico para trabajar en la <b>${portal}</b>. Tú eres el puente entre las cargas (brokers y load boards) y los drivers, y OSI te da el lugar donde organizarlo todo.`, dispatcherSteps,
      note('<b>Tiempo disponible:</b> los brokers en EE. UU. atienden en su horario, así que necesitas algunas horas libres al día para buscar y negociar cargas. Se puede combinar con otro trabajo.'),
      '📄 Descargar la guía completa (PDF)');

  return body;
}

interface OfferEmailOrder {
  order_number: string;
  pickup_address: string;
  pickup_contact?: string | null;
  delivery_address: string;
  delivery_contact?: string | null;
  price: number;
  distance_km?: number | null;
  weight_kg?: number | null;
  volume_m3?: number | null;
  equipment_type?: string | null;
  temperature?: string | null;
  priority?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  description?: string | null;
  notes?: string | null;
  estimated_delivery?: string | null;
}

// Antes solo mandaba origen/destino/tarifa -- el driver tenia que entrar al
// portal para ver el resto (peso, equipo, cliente, notas, etc.) antes de
// decidir si aceptar. Ahora lleva toda la info de la carga que el correo
// puede mostrar, salvo datos del dispatcher (eso solo se revela si acepta).
export async function sendOfferEmail(to: string, driverName: string, order: OfferEmailOrder, orderId: string) {
  const miles = order.distance_km ? Math.round(order.distance_km * 0.621371) : 0;
  const lbs = order.weight_kg ? Math.round(order.weight_kg * 2.20462) : 0;
  const cuft = order.volume_m3 ? Math.round(order.volume_m3 * 35.3147) : 0;
  const priorityLabel: Record<string, string> = { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 0;font-size:11px;color:#6b7280;width:38%;vertical-align:top;">${label}</td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${value}</td></tr>`;

  const detailRows = [
    order.equipment_type ? row('Equipo', order.equipment_type + (order.temperature ? ` · 🌡️ ${order.temperature}` : '')) : '',
    lbs ? row('Peso', `${lbs.toLocaleString('en-US')} lbs`) : '',
    cuft ? row('Volumen', `${cuft.toLocaleString('en-US')} ft³`) : '',
    miles ? row('Distancia', `${miles.toLocaleString('en-US')} mi`) : '',
    order.priority ? row('Prioridad', priorityLabel[order.priority] || order.priority) : '',
    order.customer_name ? row('Cliente', order.customer_name) : '',
    order.customer_phone ? row('Tel. cliente', order.customer_phone) : '',
    order.estimated_delivery ? row('Entrega estimada', new Date(order.estimated_delivery).toLocaleString('es-US', { dateStyle: 'medium', timeStyle: 'short' })) : '',
    order.description ? row('Descripción', order.description) : '',
    order.notes ? row('Notas', order.notes) : '',
  ].filter(Boolean).join('');

  await sendEmail({
    from: FROM,
    to,
    subject: `🚛 Nueva oferta de carga — ${order.order_number}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f8f9fa;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#3b82f6;margin:0;font-size:28px;">OSI Logistics</h1>
          <p style="color:#6b7280;margin:4px 0 0;">Driver Portal</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
          <h2 style="color:#111827;margin:0 0 4px;">¡Hola, ${driverName}!</h2>
          <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">Tienes una nueva oferta de carga esperando tu respuesta.</p>

          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;margin-bottom:16px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#3b82f6;text-transform:uppercase;letter-spacing:1px;">Orden ${order.order_number}</p>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;align-items:flex-start;gap:8px;">
                <span style="color:#10b981;font-size:16px;margin-top:2px;">●</span>
                <div><p style="margin:0;font-size:11px;color:#6b7280;">Origen</p><p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${order.pickup_address}${order.pickup_contact ? ` — ${order.pickup_contact}` : ''}</p></div>
              </div>
              <div style="border-left:2px dashed #bfdbfe;margin-left:7px;height:12px;"></div>
              <div style="display:flex;align-items:flex-start;gap:8px;">
                <span style="color:#ef4444;font-size:16px;margin-top:2px;">●</span>
                <div><p style="margin:0;font-size:11px;color:#6b7280;">Destino</p><p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${order.delivery_address}${order.delivery_contact ? ` — ${order.delivery_contact}` : ''}</p></div>
              </div>
            </div>
            ${order.price ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #bfdbfe;"><p style="margin:0;font-size:18px;font-weight:bold;color:#10b981;">$${order.price.toLocaleString('en-US', {minimumFractionDigits:2})}</p><p style="margin:0;font-size:11px;color:#6b7280;">Tarifa de carga</p></div>` : ''}
          </div>

          ${detailRows ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${detailRows}</table></div>` : ''}

          <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">Inicia sesión en el Driver Portal para aceptar o rechazar la oferta.</p>

          <div style="text-align:center;">
            <a href="${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/driver?order=${orderId}"
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

export async function sendDeliveryEmail(to: string, recipientName: string, role: 'driver' | 'dispatcher', orderNumber: string, pickup: string, delivery: string, deliveredAt: string, rate: number, orderId: string) {
  const isDriver = role === 'driver';
  const color    = isDriver ? '#3b82f6' : '#f97316';
  const subtitle = isDriver ? 'Driver Portal' : 'Dispatch Management';
  const link     = isDriver
    ? `${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/driver?order=${orderId}`
    : `${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/dispatcher`;

  await sendEmail({
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
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px;">
              <tr>
                <td style="width:32px;vertical-align:top;font-size:24px;">📦</td>
                <td style="vertical-align:top;">
                  <p style="margin:0;font-size:12px;font-weight:bold;color:#16a34a;text-transform:uppercase;letter-spacing:1px;">Entregado</p>
                  <p style="margin:0;font-size:16px;font-weight:bold;color:#111827;">Orden ${orderNumber}</p>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;color:#374151;">
              <tr><td style="padding:3px 0;"><strong>Origen:</strong> ${pickup}</td></tr>
              <tr><td style="padding:3px 0;"><strong>Destino:</strong> ${delivery}</td></tr>
              <tr><td style="padding:3px 0;"><strong>Entregado:</strong> ${new Date(deliveredAt).toLocaleString('es-US', { dateStyle: 'medium', timeStyle: 'short' })}</td></tr>
              ${rate ? `<tr><td style="padding-top:10px;"><span style="display:inline-block;padding-top:8px;border-top:1px solid #bbf7d0;font-size:16px;font-weight:bold;color:#10b981;">$${rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td></tr>` : ''}
            </table>
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

export async function sendOrderAssignedEmail(to: string, driverName: string, orderNumber: string, pickup: string, delivery: string, orderId: string, dispatcherName?: string, dispatcherPhone?: string, dispatcherEmail?: string) {
  const dispatcherSection = (dispatcherName || dispatcherPhone || dispatcherEmail) ? `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#f97316;text-transform:uppercase;letter-spacing:1px;">Contacto del Dispatcher</p>
      ${dispatcherName ? `<p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#111827;">${dispatcherName}</p>` : ''}
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
        ${dispatcherPhone ? `<tr><td style="padding:3px 0;font-size:13px;color:#374151;">📞 <a href="tel:${dispatcherPhone}" style="color:#f97316;font-weight:600;">${dispatcherPhone}</a></td></tr>` : ''}
        ${dispatcherEmail ? `<tr><td style="padding:3px 0;font-size:13px;color:#374151;">✉️ <a href="mailto:${dispatcherEmail}" style="color:#f97316;">${dispatcherEmail}</a></td></tr>` : ''}
      </table>
    </div>` : '';
  await sendEmail({
    from: FROM,
    to,
    subject: `✅ Orden confirmada — ${orderNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f8f9fa;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#3b82f6;margin:0;font-size:28px;">OSI Logistics</h1>
          <p style="color:#6b7280;margin:4px 0 0;">Driver Portal</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
          <h2 style="color:#111827;margin:0 0 4px;">¡Hola, ${driverName}!</h2>
          <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">Confirmaste la orden ${orderNumber}. Aquí tienes los datos de contacto del dispatch para coordinar la carga.</p>

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
          </div>

          ${dispatcherSection}

          <div style="text-align:center;">
            <a href="${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/driver?order=${orderId}"
              style="background:#3b82f6;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:15px;display:inline-block;">
              Ver orden →
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px;">© OSI Logistics · Miami, FL</p>
      </div>
    `,
  });
}

export async function sendOfferAcceptedEmail(to: string, dispatcherName: string, driverName: string, orderNumber: string, pickup: string, delivery: string) {
  await sendEmail({
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

export async function sendDocumentEmail(to: string, driverName: string, orderNumber: string, docTypeLabel: string, filename: string, dataUrl: string) {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  await sendEmail({
    from: FROM,
    to,
    subject: `📄 ${docTypeLabel} — Orden ${orderNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f8f9fa;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#3b82f6;margin:0;font-size:28px;">OSI Logistics</h1>
          <p style="color:#6b7280;margin:4px 0 0;">Driver Portal</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
          <h2 style="color:#111827;margin:0 0 4px;">Nuevo documento subido</h2>
          <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">${driverName} subió un documento para esta orden.</p>

          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#3b82f6;text-transform:uppercase;letter-spacing:1px;">Orden ${orderNumber}</p>
            <p style="margin:0 0 4px;font-size:15px;font-weight:bold;color:#111827;">${docTypeLabel}</p>
            <p style="margin:0;font-size:13px;color:#6b7280;">${filename}</p>
          </div>

          <p style="color:#9ca3af;font-size:12px;margin:20px 0 0;">El documento está adjunto a este correo.</p>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px;">© OSI Logistics · Miami, FL</p>
      </div>
    `,
    attachments: [{ filename, content: base64 }],
  });
}

export async function sendNewDriverRegistrationEmail(driverName: string, driverEmail: string, driverPhone: string) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  const adminUrl = `${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/admin/verifications`;
  const now = new Date().toLocaleString('es-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' });
  await sendEmail({
    from: FROM,
    to: adminEmail,
    subject: `🚛 Nuevo driver registrado — ${driverName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f8f9fa;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#f97316;margin:0;font-size:28px;">OSI Logistics</h1>
          <p style="color:#6b7280;margin:4px 0 0;">Admin Console</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
            <div style="width:44px;height:44px;background:#fff7ed;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🚛</div>
            <div>
              <h2 style="color:#111827;margin:0;font-size:17px;">Nuevo driver pendiente de aprobación</h2>
              <p style="color:#6b7280;margin:4px 0 0;font-size:13px;">${now}</p>
            </div>
          </div>

          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;margin-bottom:20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
              <tr>
                <td style="padding:6px 0;font-weight:600;width:100px;">Nombre</td>
                <td style="padding:6px 0;">${driverName}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-weight:600;">Email</td>
                <td style="padding:6px 0;"><a href="mailto:${driverEmail}" style="color:#f97316;">${driverEmail}</a></td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-weight:600;">Teléfono</td>
                <td style="padding:6px 0;">${driverPhone}</td>
              </tr>
            </table>
          </div>

          <p style="color:#374151;font-size:14px;margin:0 0 20px;">
            El driver está esperando verificación de documentos y aprobación de cuenta. Revísalo en la sección de <strong>Verificaciones</strong> del Admin Console.
          </p>

          <div style="text-align:center;">
            <a href="${adminUrl}"
              style="background:#f97316;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:15px;display:inline-block;">
              Revisar en Admin Console →
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px;">© OSI Logistics · Miami, FL</p>
      </div>
    `,
  });
}

export async function sendDriverOnlineEmail(to: string, dispatcherName: string, driverName: string, driverPhone: string) {
  await sendEmail({
    from: FROM,
    to,
    subject: `🟢 Driver disponible — ${driverName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f8f9fa;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#f97316;margin:0;font-size:28px;">OSI Logistics</h1>
          <p style="color:#6b7280;margin:4px 0 0;">Dispatch Management</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
            <div style="width:44px;height:44px;background:#f0fdf4;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🟢</div>
            <div>
              <h2 style="color:#111827;margin:0;font-size:17px;">Driver disponible para cargas</h2>
              <p style="color:#6b7280;margin:4px 0 0;font-size:13px;">Hola, ${dispatcherName}</p>
            </div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:20px;">
            <p style="margin:0 0 6px;font-size:15px;font-weight:bold;color:#111827;">${driverName}</p>
            ${driverPhone ? `<p style="margin:0 0 6px;font-size:14px;color:#374151;">📞 <a href="tel:${driverPhone}" style="color:#16a34a;">${driverPhone}</a></p>` : ''}
            <p style="margin:0;font-size:12px;font-weight:600;color:#16a34a;">● Online — Disponible</p>
          </div>
          <p style="color:#374151;font-size:14px;margin:0 0 20px;">El driver está listo para recibir una carga. Envíale una oferta desde el Dispatch Console.</p>
          <div style="text-align:center;">
            <a href="${process.env.FRONTEND_URL || 'https://osi-logistics.vercel.app'}/dispatcher"
              style="background:#f97316;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:15px;display:inline-block;">
              Ir a Dispatch Console →
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px;">© OSI Logistics · Miami, FL</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, code: string) {
  await sendEmail({
    from: FROM,
    to,
    subject: `Restablecer contraseña — código: ${code}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#f1f5f9;padding:32px 16px;">
        <div style="background:#0f172a;border-radius:12px 12px 0 0;padding:20px 32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:1px;">OSI Logistics</h1>
        </div>
        <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e2e8f0;border-top:none;">
          <h2 style="color:#111827;margin:0 0 8px;font-size:18px;">Hola, ${name}</h2>
          <p style="color:#374151;line-height:1.6;margin:0 0 28px;">
            Solicitaste restablecer tu contraseña. Usa este código para continuar:
          </p>
          <div style="background:#2563eb;border-radius:12px;padding:20px 12px;text-align:center;margin-bottom:24px;">
            <span style="color:#fff;font-size:28px;font-weight:800;letter-spacing:6px;white-space:nowrap;">${code}</span>
          </div>
          <p style="color:#6b7280;font-size:13px;text-align:center;margin:0;">
            Válido por <strong>15 minutos</strong>. Si no pediste este cambio, ignora este correo — tu contraseña actual sigue funcionando.
          </p>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px;">© OSI Logistics · Miami, FL</p>
      </div>
    `,
  });
}

export async function sendVerificationCode(to: string, name: string, code: string, type: 'email' | 'phone', role = 'driver') {
  const label = type === 'email' ? 'correo electrónico' : 'número de teléfono';
  const accent = role === 'admin' ? '#4f46e5' : role === 'dispatcher' ? '#f97316' : '#2563eb';
  await sendEmail({
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
          <div style="background:${accent};border-radius:12px;padding:20px 12px;text-align:center;margin-bottom:24px;">
            <span style="color:#fff;font-size:28px;font-weight:800;letter-spacing:6px;white-space:nowrap;">${code}</span>
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
