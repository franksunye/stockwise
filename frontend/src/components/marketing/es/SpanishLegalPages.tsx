'use client';

import { Shield, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import { LegalShell, ES_BOUNDARY_NOTICE, ES_DEFAULT_SOURCES } from './EsLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';

/**
 * Spanish Privacy Policy
 */
export function SpanishPrivacyPage() {
  return (
    <LegalShell icon={Shield} eyebrow="Política de Privacidad" title="Política de Privacidad" updatedAt="27 de enero de 2026">
      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">1. Información que recopilamos</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          Solo recopilamos la información necesaria para proporcionar el servicio:
        </p>
        <ul className="list-disc list-inside ml-2 space-y-2 text-sm text-slate-400 leading-relaxed">
          <li>Información de la cuenta, incluyendo la dirección de correo electrónico utilizada para registrarse e iniciar sesión.</li>
          <li>Ajustes de preferencias, como tu lista de vigilancia y opciones de notificación.</li>
          <li>Estado de pago necesario para el acceso por suscripción. Stripe gestiona la transacción de pago en sí, y ZISO AI no almacena números de tarjeta ni códigos de seguridad.</li>
        </ul>
      </section>

      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">2. Cómo la usamos</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          La información se utiliza para mantener tu cuenta, entregar informes de investigación personalizados, brindar soporte al cliente 
          y mejorar la confiabilidad del producto. No vendemos ni alquilamos datos personales a terceros.
        </p>
      </section>

      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">3. Seguridad de datos</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          Aplicamos controles de seguridad y cifrado estándar de la industria para proteger los datos del usuario. Ninguna transmisión por internet 
          puede garantizarse como completamente libre de riesgos, por lo que los usuarios también deben proteger sus propias credenciales.
        </p>
      </section>

      <section className="pt-6 opacity-[0.05] hover:opacity-100 transition-opacity text-left">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1 text-left">
            <GeoSummary
              locale="es"
              summary={[
                'ZISO AI recopila solo los datos operativos necesarios para gestionar cuentas, listas de vigilancia, facturación y notificaciones.',
                'Stripe gestiona el procesamiento de pagos, mientras que ZISO AI evita almacenar información sensible de tarjetas.',
                'Nuestra política de privacidad se centra en la prestación del servicio y no en la reventa de datos.',
              ]}
            />
          </div>
          <div className="flex-1 text-left">
            <SourceBlock
              locale="es"
              sources={[
                ...ES_DEFAULT_SOURCES,
                { name: 'Cumplimiento de Privacidad', url: 'https://ziso.cc/privacy', accessedAt: '2026-03-13' },
              ]}
            />
          </div>
        </div>
        <BoundaryNotice locale="es" text={ES_BOUNDARY_NOTICE} />
      </section>
    </LegalShell>
  );
}

/**
 * Spanish Terms of Service
 */
export function SpanishTermsPage() {
  return (
    <LegalShell icon={FileText} eyebrow="Términos de Servicio" title="Términos de Servicio" updatedAt="27 de enero de 2026">
      <div className="glass-card p-6 border-amber-500/20 bg-amber-500/[0.02] flex gap-4 items-start text-left">
        <ShieldCheck className="text-amber-400 shrink-0 mt-1" size={20} />
        <div className="text-sm text-amber-100/80 leading-relaxed font-medium text-left">
          Aviso importante: todos los pronósticos, análisis e informes proporcionados por ZISO AI son generados con asistencia de IA 
          solo para referencia informativa. Nada en este sitio constituye asesoramiento de inversión, financiero o legal. 
          El riesgo de mercado sigue siendo tu propia responsabilidad.
        </div>
      </div>

      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">1. Alcance del servicio</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          ZISO AI proporciona análisis de mercado asistido por IA, resúmenes de informes y flujos de alerta. Los usuarios reconocen 
          las limitaciones del contenido generado por IA y la incertidumbre inherente a los pronósticos de mercado.
        </p>
      </section>

      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">2. Responsabilidad del usuario</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          Eres responsable de la actividad realizada a través de tu cuenta. Si descubres un uso no autorizado, debes 
          notificarnos de inmediato.
        </p>
      </section>

      <section className="pt-6 opacity-[0.05] hover:opacity-100 transition-opacity text-left">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1 text-left">
            <GeoSummary
              locale="es"
              summary={[
                'ZISO AI proporciona análisis de mercado asistido por IA únicamente con fines informativos y de apoyo a la investigación.',
                'Los usuarios siguen siendo plenamente responsables de sus decisiones comerciales y de las consecuencias de sus acciones.',
                'El servicio enfatiza límites de análisis transparentes en lugar de asesoramiento de inversión individualizado.',
              ]}
            />
          </div>
          <div className="flex-1 text-left">
            <SourceBlock
              locale="es"
              sources={[
                ...ES_DEFAULT_SOURCES,
                { name: 'Términos Legales', url: 'https://ziso.cc/terms', accessedAt: '2026-03-13' },
              ]}
            />
          </div>
        </div>
        <BoundaryNotice locale="es" text={ES_BOUNDARY_NOTICE} />
      </section>
    </LegalShell>
  );
}

/**
 * Spanish Refund Policy
 */
export function SpanishRefundPage() {
  return (
    <LegalShell icon={RefreshCw} eyebrow="Política de Reembolso" title="Política de Reembolso" updatedAt="27 de enero de 2026">
      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">1. Cancelación de suscripción</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          Los usuarios pueden cancelar su suscripción en cualquier momento. Tras la cancelación, seguirás teniendo acceso a las 
          características Pro hasta el final del período de facturación actual.
        </p>
      </section>

      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">2. Condiciones de reembolso</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          Debido a la naturaleza de los servicios y contenidos digitales, generalmente no se ofrecen reembolsos por los períodos 
          ya facturados. Sin embargo, revisaremos las solicitudes de reembolso para casos excepcionales dentro de las 24 horas 
          posteriores al pago si no se ha hecho uso del servicio.
        </p>
      </section>

      <section className="pt-6 opacity-30 hover:opacity-100 transition-opacity text-left">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1 text-left">
            <GeoSummary
              locale="es"
              summary={[
                'La suscripción se puede cancelar en cualquier momento y permanece activa hasta el final del periodo vigente.',
                'Debido a la naturaleza digital del servicio, generalmente no hay reembolsos.',
                'Se pueden considerar excepciones por errores técnicos o falta de uso del servicio dentro de las primeras 24 horas.',
              ]}
            />
          </div>
          <div className="flex-1 text-left">
            <SourceBlock
              locale="es"
              sources={[
                ...ES_DEFAULT_SOURCES,
                { name: 'Política de Reembolso', url: 'https://ziso.cc/refund', accessedAt: '2026-03-13' },
              ]}
            />
          </div>
        </div>
        <BoundaryNotice locale="es" text={ES_BOUNDARY_NOTICE} />
      </section>
    </LegalShell>
  );
}
