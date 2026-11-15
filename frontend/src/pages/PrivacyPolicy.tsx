import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ShieldCheck, Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import osiLogo from '../assets/osi-logo.jpeg';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-base font-bold text-gray-900 mb-2">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
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
            <img src={osiLogo} alt="OSI Logistics" className="h-10 w-auto object-contain rounded-md" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{T('Política de Privacidad', 'Privacy Policy')}</h1>
              <p className="text-xs text-gray-400">OSI Logistics · {T('Última actualización: octubre de 2026', 'Last updated: October 2026')}</p>
            </div>
          </div>

          <div className="mt-6">
            <Section title={T('1. Quiénes somos', '1. Who We Are')}>
              <p>
                {T(
                  'OSI Logistics ("OSI", "nosotros") opera una plataforma de despacho de camiones que conecta dispatchers, drivers y clientes de transporte en Estados Unidos y otros países. Esta política explica qué información recopilamos a través de nuestras aplicaciones web (incluyendo osilogistics.com, dispatch.osilogistics.com y driver.osilogistics.com) y cómo la usamos, almacenamos y protegemos.',
                  'OSI Logistics ("OSI", "we", "us") operates a truck dispatch platform that connects dispatchers, drivers and freight customers in the United States and other countries. This policy explains what information we collect through our web applications (including osilogistics.com, dispatch.osilogistics.com and driver.osilogistics.com) and how we use, store and protect it.'
                )}
              </p>
            </Section>

            <Section title={T('2. Información que recopilamos', '2. Information We Collect')}>
              <p><strong>{T('Datos de cuenta:', 'Account data:')}</strong> {T('nombre, correo electrónico, teléfono, fecha de nacimiento, ciudad y país, contraseña (almacenada de forma cifrada, nunca en texto plano).', 'name, email address, phone number, date of birth, city and country, and password (stored encrypted, never in plain text).')}</p>
              <p><strong>{T('Documentos de verificación:', 'Verification documents:')}</strong> {T('foto de identificación (cédula o pasaporte) para dispatchers, y licencia de conducir, certificado de seguro (COI) y foto del equipo (camión/trailer) para drivers. Estos documentos se usan únicamente para verificar identidad y cumplimiento antes de activar una cuenta.', 'a photo of an ID (national ID card or passport) for dispatchers, and a driver license, certificate of insurance (COI) and a photo of the equipment (truck/trailer) for drivers. These documents are used only to verify identity and compliance before an account is activated.')}</p>
              <p><strong>{T('Datos operativos:', 'Operational data:')}</strong> {T('información de las cargas/órdenes gestionadas, comisiones, historial de pagos, y comunicación dentro de la plataforma (por ejemplo, el feed interno "Hub").', 'information about the loads/orders handled, commissions, payment history, and communications within the platform (for example, the internal "Hub" feed).')}</p>
              <p><strong>{T('Ubicación:', 'Location:')}</strong> {T('los drivers que activan el rastreo GPS comparten su ubicación en tiempo real mientras están en una ruta activa, para que el dispatcher asignado pueda hacer seguimiento de la entrega.', 'drivers who enable GPS tracking share their real-time location while on an active route, so the assigned dispatcher can track the delivery.')}</p>
              <p><strong>{T('Datos técnicos:', 'Technical data:')}</strong> {T('dirección IP, tipo de dispositivo y navegador, registrados automáticamente por motivos de seguridad y soporte técnico.', 'IP address, device type and browser, recorded automatically for security and technical support purposes.')}</p>
            </Section>

            <Section title={T('3. Cómo usamos la información', '3. How We Use Information')}>
              <ul className="list-disc pl-5 space-y-1">
                <li>{T('Crear y administrar cuentas de dispatchers y drivers.', 'Create and manage dispatcher and driver accounts.')}</li>
                <li>{T('Verificar identidad y documentación antes de aprobar una cuenta.', 'Verify identity and documentation before approving an account.')}</li>
                <li>{T('Coordinar la asignación y el seguimiento de cargas de transporte.', 'Coordinate the assignment and tracking of freight loads.')}</li>
                <li>{T('Calcular y procesar comisiones y pagos.', 'Calculate and process commissions and payments.')}</li>
                <li>{T('Enviar notificaciones operativas por correo electrónico, SMS o WhatsApp relacionadas con el servicio.', 'Send service-related operational notifications by email, SMS or WhatsApp.')}</li>
                <li>{T('Responder solicitudes de soporte y mejorar la plataforma.', 'Respond to support requests and improve the platform.')}</li>
                <li>{T('Cumplir con obligaciones legales y prevenir fraude.', 'Comply with legal obligations and prevent fraud.')}</li>
              </ul>
            </Section>

            <Section title={T('4. Con quién compartimos información', '4. Who We Share Information With')}>
              <p>
                {T(
                  'No vendemos ni alquilamos tu información personal a terceros. Compartimos datos únicamente con proveedores que nos ayudan a operar el servicio (por ejemplo, proveedores de hosting y base de datos, autenticación, envío de correos/SMS, y procesamiento de pagos), bajo acuerdos que exigen proteger esa información, y solo en la medida necesaria para prestar el servicio.',
                  'We do not sell or rent your personal information to third parties. We share data only with providers that help us operate the service (for example, hosting and database providers, authentication, email/SMS delivery, and payment processing), under agreements that require them to protect that information, and only to the extent necessary to provide the service.'
                )}
              </p>
            </Section>

            <Section title={T('5. Seguridad', '5. Security')}>
              <p>
                {T(
                  'Las contraseñas se almacenan con hash y sal, nunca en texto plano. Los documentos de verificación (identificación, licencia, COI) se almacenan de forma separada de los datos generales de la cuenta y solo son accesibles por personal administrativo autorizado, con el único fin de revisar y verificar la cuenta. El acceso a la plataforma administrativa requiere autenticación.',
                  'Passwords are stored hashed and salted, never in plain text. Verification documents (ID, license, COI) are stored separately from general account data and are accessible only to authorized administrative staff, solely for the purpose of reviewing and verifying the account. Access to the administrative platform requires authentication.'
                )}
              </p>
            </Section>

            <Section title={T('6. Retención de datos', '6. Data Retention')}>
              <p>
                {T(
                  'Conservamos la información mientras la cuenta esté activa y el tiempo adicional necesario para cumplir obligaciones legales, resolver disputas o hacer cumplir nuestros acuerdos. Puedes solicitar la eliminación de tu cuenta y tus datos personales escribiendo al correo de contacto indicado abajo.',
                  'We keep information while the account is active and for any additional time needed to comply with legal obligations, resolve disputes or enforce our agreements. You may request the deletion of your account and personal data by writing to the contact email below.'
                )}
              </p>
            </Section>

            <Section title={T('7. Tus derechos', '7. Your Rights')}>
              <p>
                {T(
                  'Puedes solicitar acceso, corrección o eliminación de tu información personal, así como retirar tu consentimiento para el procesamiento de datos, escribiendo a ',
                  'You may request access to, correction of or deletion of your personal information, and you may withdraw your consent to data processing, by writing to '
                )}
                <a href="mailto:operations@osilogistics.com" className="text-orange-500 font-medium">operations@osilogistics.com</a>
                {T('. Atenderemos tu solicitud en un plazo razonable.', '. We will respond to your request within a reasonable time.')}
              </p>
            </Section>

            <Section title={T('8. Menores de edad', '8. Minors')}>
              <p>
                {T(
                  'Nuestros servicios están dirigidos a personas mayores de 18 años. No recopilamos a sabiendas información de menores de edad.',
                  'Our services are intended for people over 18 years of age. We do not knowingly collect information from minors.'
                )}
              </p>
            </Section>

            <Section title={T('9. Cambios a esta política', '9. Changes to This Policy')}>
              <p>
                {T(
                  'Podemos actualizar esta política ocasionalmente. Publicaremos cualquier cambio en esta misma página con la fecha de la actualización.',
                  'We may update this policy from time to time. We will publish any change on this same page with the update date.'
                )}
              </p>
            </Section>

            <Section title={T('10. Contacto', '10. Contact')}>
              <p>
                OSI Logistics · Miami, FL ·{' '}
                <a href="mailto:operations@osilogistics.com" className="text-orange-500 font-medium">operations@osilogistics.com</a>
              </p>
            </Section>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mt-2">
            <ShieldCheck className="w-4 h-4 text-orange-400" />
            <p className="text-xs text-gray-400">{T('Tu información está protegida y solo se usa para operar el servicio.', 'Your information is protected and is used only to operate the service.')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
