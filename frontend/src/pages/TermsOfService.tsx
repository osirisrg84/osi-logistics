import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import osiLogo from '../assets/osi-logo.jpeg';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-base font-bold text-gray-900 mb-2">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-10">
      <div className="w-full max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al inicio
        </Link>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-1">
            <img src={osiLogo} alt="OSI Logistics" className="h-10 w-auto object-contain rounded-md" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Condiciones del Servicio</h1>
              <p className="text-xs text-gray-400">OSI Logistics · Última actualización: noviembre de 2026</p>
            </div>
          </div>

          <div className="mt-6">
            <Section title="1. Aceptación">
              <p>
                Al crear una cuenta o usar las aplicaciones de OSI Logistics ("OSI", "nosotros"), incluyendo
                osilogistics.com, app.osilogistics.com, dispatch.osilogistics.com y driver.osilogistics.com,
                aceptas estas condiciones y nuestra{' '}
                <Link to="/privacy" className="text-orange-500 font-medium">Política de Privacidad</Link>.
                Si no estás de acuerdo, no uses el servicio. Debes ser mayor de 18 años.
              </p>
            </Section>

            <Section title="2. Qué es OSI Logistics">
              <p>
                OSI es una plataforma de despacho de camiones que conecta a dispatchers y drivers para
                coordinar la asignación y el seguimiento de cargas de transporte. OSI presta servicios de
                despacho y herramientas de gestión; no es una aseguradora ni un transportista, y no es
                empleador de los drivers ni de los dispatchers que usan la plataforma.
              </p>
            </Section>

            <Section title="3. Cuentas">
              <ul className="list-disc pl-5 space-y-1">
                <li>La información que proporciones al registrarte debe ser veraz y estar actualizada.</li>
                <li>Las cuentas se activan solo después de verificar identidad y documentación (identificación, licencia, seguro).</li>
                <li>Eres responsable de la seguridad de tu contraseña y de la actividad en tu cuenta.</li>
                <li>Podemos rechazar, suspender o cerrar cuentas que incumplan estas condiciones o la ley.</li>
              </ul>
            </Section>

            <Section title="4. Responsabilidades del driver">
              <ul className="list-disc pl-5 space-y-1">
                <li>Contar con licencia, seguro y autorizaciones vigentes que exija la ley para operar su equipo.</li>
                <li>Cumplir las normas de tránsito, de horas de servicio y de seguridad aplicables.</li>
                <li>Entregar las cargas aceptadas en las condiciones acordadas con el cliente.</li>
                <li>Si activa el rastreo GPS, compartir su ubicación durante la ruta activa para el seguimiento de la entrega.</li>
              </ul>
            </Section>

            <Section title="5. Responsabilidades del dispatcher">
              <ul className="list-disc pl-5 space-y-1">
                <li>Gestionar las cargas con honestidad y sin prometer lo que no pueda cumplirse.</li>
                <li>Usar los datos de drivers y clientes únicamente para operar el servicio.</li>
                <li>No compartir su acceso con terceros.</li>
              </ul>
            </Section>

            <Section title="6. Tarifas y comisiones">
              <p>
                Las comisiones y tarifas del servicio son las que se indiquen en el acuerdo vigente con cada
                usuario o en la plataforma al momento de aceptar la carga. Los pagos se procesan según los
                plazos y métodos acordados. Cualquier cambio de tarifas se comunicará con anticipación
                razonable y no afectará a las cargas ya aceptadas.
              </p>
            </Section>

            <Section title="7. Programa de referidos">
              <p>
                Los beneficios del programa de referidos, si aplican, se rigen por las condiciones publicadas
                en la plataforma al momento de la recomendación. Nos reservamos el derecho de no otorgar
                beneficios en casos de fraude, cuentas falsas o uso indebido del programa.
              </p>
            </Section>

            <Section title="8. Uso aceptable">
              <p>No está permitido:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Suplantar a otra persona ni presentar documentos falsos o ajenos.</li>
                <li>Usar la plataforma para actividades ilegales, fraudulentas o engañosas.</li>
                <li>Intentar acceder sin autorización a cuentas, datos o sistemas, o interferir con su funcionamiento.</li>
                <li>Enviar mensajes no solicitados o abusivos a otros usuarios.</li>
              </ul>
            </Section>

            <Section title="9. Comunicaciones">
              <p>
                Podemos enviarte notificaciones operativas por correo electrónico, SMS o WhatsApp relacionadas
                con el servicio. Los correos informativos o promocionales incluyen siempre un enlace para dejar
                de recibirlos.
              </p>
            </Section>

            <Section title="10. Disponibilidad y límite de responsabilidad">
              <p>
                Trabajamos para mantener la plataforma disponible, pero se ofrece "tal cual" y puede haber
                interrupciones. En la medida que permita la ley, OSI no será responsable por daños indirectos,
                pérdida de ingresos, retrasos, daños a la carga o incidentes ocurridos durante el transporte,
                que son responsabilidad de las partes que los realizan y de sus seguros.
              </p>
            </Section>

            <Section title="11. Terminación">
              <p>
                Puedes dejar de usar el servicio y solicitar el cierre de tu cuenta en cualquier momento
                escribiendo al correo de contacto. Podemos suspender o terminar el acceso por incumplimiento
                de estas condiciones. Las obligaciones de pago pendientes se mantienen tras la terminación.
              </p>
            </Section>

            <Section title="12. Cambios">
              <p>
                Podemos actualizar estas condiciones. Publicaremos la versión vigente en esta página con la
                fecha de actualización. Seguir usando el servicio después de un cambio implica su aceptación.
              </p>
            </Section>

            <Section title="13. Ley aplicable">
              <p>
                Estas condiciones se rigen por las leyes del Estado de Florida, Estados Unidos, sin perjuicio
                de las normas imperativas de protección al usuario que apliquen en tu país de residencia.
              </p>
            </Section>

            <Section title="14. Contacto">
              <p>
                OSI Logistics · Miami, FL ·{' '}
                <a href="mailto:operations@osilogistics.com" className="text-orange-500 font-medium">operations@osilogistics.com</a>
              </p>
            </Section>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mt-2">
            <FileText className="w-4 h-4 text-orange-400" />
            <p className="text-xs text-gray-400">Al usar OSI Logistics aceptas estas condiciones.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
