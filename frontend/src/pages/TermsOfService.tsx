import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FileText, Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import OsiLogo from '../components/OsiLogo';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-base font-bold text-gray-900 mb-2">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function TermsOfService() {
  const { t } = useTranslation();
  const { lang, toggle: toggleLang } = useLanguage();
  // Texto legal largo: se elige por idioma activo (es / en).
  const T = (es: string, en: string) => (lang === 'en' ? en : es);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-10">
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> {t('legal.backHome')}
          </Link>
          <button type="button" onClick={toggleLang} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors">
            <Languages className="w-4 h-4 hidden sm:block" /> {lang.toUpperCase()}
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-1">
            <OsiLogo variant="light" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{T('Condiciones del Servicio', 'Terms of Service')}</h1>
              <p className="text-xs text-gray-400">OSI Logistics · {T('Última actualización: noviembre de 2026', 'Last updated: November 2026')}</p>
            </div>
          </div>

          <div className="mt-6">
            <Section title={T('1. Aceptación', '1. Acceptance')}>
              <p>
                {T(
                  'Al crear una cuenta o usar las aplicaciones de OSI Logistics ("OSI", "nosotros"), incluyendo osilogistics.com, app.osilogistics.com, dispatch.osilogistics.com y driver.osilogistics.com, aceptas estas condiciones y nuestra ',
                  'By creating an account or using the OSI Logistics applications ("OSI", "we", "us"), including osilogistics.com, app.osilogistics.com, dispatch.osilogistics.com and driver.osilogistics.com, you agree to these terms and to our '
                )}
                <Link to="/privacy" className="text-orange-500 font-medium">{t('legal.privacyLink')}</Link>
                {T(
                  '. Si no estás de acuerdo, no uses el servicio. Debes ser mayor de 18 años.',
                  '. If you do not agree, do not use the service. You must be at least 18 years old.'
                )}
              </p>
            </Section>

            <Section title={T('2. Qué es OSI Logistics', '2. What OSI Logistics Is')}>
              <p>
                {T(
                  'OSI es una plataforma de despacho de camiones que conecta a dispatchers y drivers para coordinar la asignación y el seguimiento de cargas de transporte. OSI presta servicios de despacho y herramientas de gestión; no es una aseguradora ni un transportista, y no es empleador de los drivers ni de los dispatchers que usan la plataforma.',
                  'OSI is a truck dispatch platform that connects dispatchers and drivers to coordinate the assignment and tracking of freight loads. OSI provides dispatch services and management tools; it is not an insurer or a motor carrier, and it is not the employer of the drivers or dispatchers who use the platform.'
                )}
              </p>
            </Section>

            <Section title={T('3. Cuentas', '3. Accounts')}>
              <ul className="list-disc pl-5 space-y-1">
                <li>{T('La información que proporciones al registrarte debe ser veraz y estar actualizada.', 'The information you provide when registering must be truthful and kept up to date.')}</li>
                <li>{T('Las cuentas se activan solo después de verificar identidad y documentación (identificación, licencia, seguro).', 'Accounts are activated only after identity and documentation (ID, license, insurance) have been verified.')}</li>
                <li>{T('Eres responsable de la seguridad de tu contraseña y de la actividad en tu cuenta.', 'You are responsible for the security of your password and for all activity on your account.')}</li>
                <li>{T('Podemos rechazar, suspender o cerrar cuentas que incumplan estas condiciones o la ley.', 'We may reject, suspend or close accounts that violate these terms or the law.')}</li>
              </ul>
            </Section>

            <Section title={T('4. Responsabilidades del driver', '4. Driver Responsibilities')}>
              <ul className="list-disc pl-5 space-y-1">
                <li>{T('Contar con licencia, seguro y autorizaciones vigentes que exija la ley para operar su equipo.', 'Hold the valid license, insurance and authorizations required by law to operate their equipment.')}</li>
                <li>{T('Cumplir las normas de tránsito, de horas de servicio y de seguridad aplicables.', 'Comply with applicable traffic, hours-of-service and safety rules.')}</li>
                <li>{T('Entregar las cargas aceptadas en las condiciones acordadas con el cliente.', 'Deliver accepted loads under the conditions agreed with the customer.')}</li>
                <li>{T('Si activa el rastreo GPS, compartir su ubicación durante la ruta activa para el seguimiento de la entrega.', 'If GPS tracking is enabled, share their location during the active route so the delivery can be tracked.')}</li>
              </ul>
            </Section>

            <Section title={T('5. Responsabilidades del dispatcher', '5. Dispatcher Responsibilities')}>
              <ul className="list-disc pl-5 space-y-1">
                <li>{T('Gestionar las cargas con honestidad y sin prometer lo que no pueda cumplirse.', 'Manage loads honestly and not promise what cannot be delivered.')}</li>
                <li>{T('Usar los datos de drivers y clientes únicamente para operar el servicio.', 'Use driver and customer data only to operate the service.')}</li>
                <li>{T('No compartir su acceso con terceros.', 'Not share their access with third parties.')}</li>
              </ul>
            </Section>

            <Section title={T('6. Tarifas y comisiones', '6. Fees and Commissions')}>
              <p>
                {T(
                  'Las comisiones y tarifas del servicio son las que se indiquen en el acuerdo vigente con cada usuario o en la plataforma al momento de aceptar la carga. Los pagos se procesan según los plazos y métodos acordados. Cualquier cambio de tarifas se comunicará con anticipación razonable y no afectará a las cargas ya aceptadas.',
                  'Service commissions and fees are those stated in the agreement in force with each user or on the platform at the time the load is accepted. Payments are processed according to the agreed schedules and methods. Any change in fees will be communicated with reasonable advance notice and will not affect loads that have already been accepted.'
                )}
              </p>
            </Section>

            <Section title={T('7. Programa de referidos', '7. Referral Program')}>
              <p>
                {T(
                  'Los beneficios del programa de referidos, si aplican, se rigen por las condiciones publicadas en la plataforma al momento de la recomendación. Nos reservamos el derecho de no otorgar beneficios en casos de fraude, cuentas falsas o uso indebido del programa.',
                  'Referral program benefits, if applicable, are governed by the conditions published on the platform at the time of the referral. We reserve the right to withhold benefits in cases of fraud, fake accounts or misuse of the program.'
                )}
              </p>
            </Section>

            <Section title={T('8. Uso aceptable', '8. Acceptable Use')}>
              <p>{T('No está permitido:', 'The following is not permitted:')}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{T('Suplantar a otra persona ni presentar documentos falsos o ajenos.', 'Impersonating another person or submitting false documents or documents belonging to someone else.')}</li>
                <li>{T('Usar la plataforma para actividades ilegales, fraudulentas o engañosas.', 'Using the platform for illegal, fraudulent or deceptive activities.')}</li>
                <li>{T('Intentar acceder sin autorización a cuentas, datos o sistemas, o interferir con su funcionamiento.', 'Attempting to gain unauthorized access to accounts, data or systems, or interfering with their operation.')}</li>
                <li>{T('Enviar mensajes no solicitados o abusivos a otros usuarios.', 'Sending unsolicited or abusive messages to other users.')}</li>
              </ul>
            </Section>

            <Section title={T('9. Comunicaciones', '9. Communications')}>
              <p>
                {T(
                  'Podemos enviarte notificaciones operativas por correo electrónico, SMS o WhatsApp relacionadas con el servicio. Los correos informativos o promocionales incluyen siempre un enlace para dejar de recibirlos.',
                  'We may send you service-related operational notifications by email, SMS or WhatsApp. Informational or promotional emails always include a link to unsubscribe.'
                )}
              </p>
            </Section>

            <Section title={T('10. Disponibilidad y límite de responsabilidad', '10. Availability and Limitation of Liability')}>
              <p>
                {T(
                  'Trabajamos para mantener la plataforma disponible, pero se ofrece "tal cual" y puede haber interrupciones. En la medida que permita la ley, OSI no será responsable por daños indirectos, pérdida de ingresos, retrasos, daños a la carga o incidentes ocurridos durante el transporte, que son responsabilidad de las partes que los realizan y de sus seguros.',
                  'We work to keep the platform available, but it is provided "as is" and interruptions may occur. To the extent permitted by law, OSI will not be liable for indirect damages, loss of income, delays, cargo damage or incidents occurring during transport, which are the responsibility of the parties performing the transport and their insurers.'
                )}
              </p>
            </Section>

            <Section title={T('11. Terminación', '11. Termination')}>
              <p>
                {T(
                  'Puedes dejar de usar el servicio y solicitar el cierre de tu cuenta en cualquier momento escribiendo al correo de contacto. Podemos suspender o terminar el acceso por incumplimiento de estas condiciones. Las obligaciones de pago pendientes se mantienen tras la terminación.',
                  'You may stop using the service and request the closure of your account at any time by writing to the contact email. We may suspend or terminate access for breach of these terms. Outstanding payment obligations remain in effect after termination.'
                )}
              </p>
            </Section>

            <Section title={T('12. Cambios', '12. Changes')}>
              <p>
                {T(
                  'Podemos actualizar estas condiciones. Publicaremos la versión vigente en esta página con la fecha de actualización. Seguir usando el servicio después de un cambio implica su aceptación.',
                  'We may update these terms. We will publish the current version on this page with the update date. Continuing to use the service after a change means you accept it.'
                )}
              </p>
            </Section>

            <Section title={T('13. Ley aplicable', '13. Governing Law')}>
              <p>
                {T(
                  'Estas condiciones se rigen por las leyes del Estado de Florida, Estados Unidos, sin perjuicio de las normas imperativas de protección al usuario que apliquen en tu país de residencia.',
                  'These terms are governed by the laws of the State of Florida, United States, without prejudice to any mandatory consumer protection rules that apply in your country of residence.'
                )}
              </p>
            </Section>

            <Section title={T('14. Contacto', '14. Contact')}>
              <p>
                OSI Logistics · Miami, FL ·{' '}
                <a href="mailto:operations@osilogistics.com" className="text-orange-500 font-medium">operations@osilogistics.com</a>
              </p>
            </Section>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mt-2">
            <FileText className="w-4 h-4 text-orange-400" />
            <p className="text-xs text-gray-400">{T('Al usar OSI Logistics aceptas estas condiciones.', 'By using OSI Logistics you accept these terms.')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
