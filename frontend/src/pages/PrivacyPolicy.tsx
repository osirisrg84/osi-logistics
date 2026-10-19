import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
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
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-10">
      <div className="w-full max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al inicio
        </Link>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-1">
            <img src={osiLogo} alt="OSI Logistics" className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Política de Privacidad</h1>
              <p className="text-xs text-gray-400">OSI Logistics · Última actualización: octubre de 2026</p>
            </div>
          </div>

          <div className="mt-6">
            <Section title="1. Quiénes somos">
              <p>
                OSI Logistics ("OSI", "nosotros") opera una plataforma de despacho de camiones que conecta
                dispatchers, drivers y clientes de transporte en Estados Unidos y otros países. Esta política
                explica qué información recopilamos a través de nuestras aplicaciones web (incluyendo
                osilogistics.com, dispatch.osilogistics.com y driver.osilogistics.com) y cómo la usamos,
                almacenamos y protegemos.
              </p>
            </Section>

            <Section title="2. Información que recopilamos">
              <p><strong>Datos de cuenta:</strong> nombre, correo electrónico, teléfono, fecha de nacimiento, ciudad y país, contraseña (almacenada de forma cifrada, nunca en texto plano).</p>
              <p><strong>Documentos de verificación:</strong> foto de identificación (cédula o pasaporte) para dispatchers, y licencia de conducir, certificado de seguro (COI) y foto del equipo (camión/trailer) para drivers. Estos documentos se usan únicamente para verificar identidad y cumplimiento antes de activar una cuenta.</p>
              <p><strong>Datos operativos:</strong> información de las cargas/órdenes gestionadas, comisiones, historial de pagos, y comunicación dentro de la plataforma (por ejemplo, el feed interno "Hub").</p>
              <p><strong>Ubicación:</strong> los drivers que activan el rastreo GPS comparten su ubicación en tiempo real mientras están en una ruta activa, para que el dispatcher asignado pueda hacer seguimiento de la entrega.</p>
              <p><strong>Datos técnicos:</strong> dirección IP, tipo de dispositivo y navegador, registrados automáticamente por motivos de seguridad y soporte técnico.</p>
            </Section>

            <Section title="3. Cómo usamos la información">
              <ul className="list-disc pl-5 space-y-1">
                <li>Crear y administrar cuentas de dispatchers y drivers.</li>
                <li>Verificar identidad y documentación antes de aprobar una cuenta.</li>
                <li>Coordinar la asignación y el seguimiento de cargas de transporte.</li>
                <li>Calcular y procesar comisiones y pagos.</li>
                <li>Enviar notificaciones operativas por correo electrónico, SMS o WhatsApp relacionadas con el servicio.</li>
                <li>Responder solicitudes de soporte y mejorar la plataforma.</li>
                <li>Cumplir con obligaciones legales y prevenir fraude.</li>
              </ul>
            </Section>

            <Section title="4. Con quién compartimos información">
              <p>
                No vendemos ni alquilamos tu información personal a terceros. Compartimos datos únicamente con
                proveedores que nos ayudan a operar el servicio (por ejemplo, proveedores de hosting y base de
                datos, autenticación, envío de correos/SMS, y procesamiento de pagos), bajo acuerdos que exigen
                proteger esa información, y solo en la medida necesaria para prestar el servicio.
              </p>
            </Section>

            <Section title="5. Seguridad">
              <p>
                Las contraseñas se almacenan con hash y sal, nunca en texto plano. Los documentos de
                verificación (identificación, licencia, COI) se almacenan de forma separada de los datos
                generales de la cuenta y solo son accesibles por personal administrativo autorizado, con el
                único fin de revisar y verificar la cuenta. El acceso a la plataforma administrativa requiere
                autenticación.
              </p>
            </Section>

            <Section title="6. Retención de datos">
              <p>
                Conservamos la información mientras la cuenta esté activa y el tiempo adicional necesario para
                cumplir obligaciones legales, resolver disputas o hacer cumplir nuestros acuerdos. Puedes
                solicitar la eliminación de tu cuenta y tus datos personales escribiendo al correo de contacto
                indicado abajo.
              </p>
            </Section>

            <Section title="7. Tus derechos">
              <p>
                Puedes solicitar acceso, corrección o eliminación de tu información personal, así como retirar
                tu consentimiento para el procesamiento de datos, escribiendo a{' '}
                <a href="mailto:operations@osilogistics.com" className="text-orange-500 font-medium">operations@osilogistics.com</a>.
                Atenderemos tu solicitud en un plazo razonable.
              </p>
            </Section>

            <Section title="8. Menores de edad">
              <p>
                Nuestros servicios están dirigidos a personas mayores de 18 años. No recopilamos a sabiendas
                información de menores de edad.
              </p>
            </Section>

            <Section title="9. Cambios a esta política">
              <p>
                Podemos actualizar esta política ocasionalmente. Publicaremos cualquier cambio en esta misma
                página con la fecha de la actualización.
              </p>
            </Section>

            <Section title="10. Contacto">
              <p>
                OSI Logistics · Miami, FL ·{' '}
                <a href="mailto:operations@osilogistics.com" className="text-orange-500 font-medium">operations@osilogistics.com</a>
              </p>
            </Section>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mt-2">
            <ShieldCheck className="w-4 h-4 text-orange-400" />
            <p className="text-xs text-gray-400">Tu información está protegida y solo se usa para operar el servicio.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
