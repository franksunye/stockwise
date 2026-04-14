'use client';

import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageShell, ES_BOUNDARY_NOTICE, ES_DEFAULT_SOURCES } from './EsLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';
import { JsonLd } from '@/components/seo/JsonLd';
import { type FeatureComparisonRow } from '@/lib/pricing-data';

const ES_PRICING_PLANS = [
  {
    name: 'Gratis Estándar',
    eyebrow: 'Acceso Inicial',
    price: '0',
    period: 'Gratis por Siempre',
    description: 'Para inversores que exploran por primera vez la revisión del mercado asistida por IA.',
    features: [
      '3 Acciones en Lista (con Informes/día)',
      'Modelo de Servicio: Hunyuan Lite',
      'Notificaciones Básicas del Sistema',
      'Academia ZISO (101/Maestros)',
    ],
    cta: 'Empezar Gratis',
    href: 'https://app.ziso.cc',
    highlight: false,
    accent: 'text-slate-300',
  },
  {
    name: 'Miembro Go',
    eyebrow: 'BLOQUEO EARLY BIRD',
    price: '6.99',
    msrp: '9.99',
    period: 'Mensual / $69.9 Anual',
    description: 'Desbloquea los insights accionables de DeepSeek, 10 acciones en lista, 200 informes mensuales y alertas en tiempo real.',
    features: [
      '10 Acciones en Lista (con Informes/día)',
      'Modelo de Servicio: DeepSeek',
      'Notificaciones en Tiempo Real',
      'Academia ZISO (101/Maestros)',
      'Insignia de identidad Go',
    ],
    cta: 'Abrir app para suscribirte',
    href: 'https://app.ziso.cc',
    note: 'Completa la suscripción dentro de la app.',
    highlight: true,
    accent: 'text-indigo-300',
  },
  {
    name: 'Plus Prestige',
    eyebrow: 'BLOQUEO EARLY BIRD',
    price: '12.99',
    msrp: '19.99',
    period: 'Mensual / $129 Anual',
    description: 'Razonamiento avanzado por consenso y soporte prioritario de expertos.',
    features: [
      '10 Acciones en Lista (con Informes/día)',
      'Modelo de Servicio: DeepSeek + Gemini',
      'Notificaciones en Tiempo Real',
      'Academia ZISO (101/Maestros)',
      'Insignia de identidad Plus',
    ],
    cta: 'Unirse a la Lista',
    href: 'mailto:hi@ziso.cc',
    highlight: false,
    accent: 'text-emerald-300',
  },
] as const;

const ES_FEATURE_COMPARISON = [
  { isGroup: true, label: 'Informes de Investigación (Actionable Insights)' },
  { label: 'Modelo de Servicio', free: 'Hunyuan Lite', go: 'DeepSeek', plus: 'DeepSeek + Gemini', highlight: true },
  { label: 'Acciones en Lista', free: '3 Acciones', go: '10 Acciones', plus: '10 Acciones', highlight: true },
  { label: 'Cuota Mensual de Informes', free: '60 / Mes', go: '200 / Mes', plus: '200 / Mes' },
  { label: 'Señales Tácticas (Tactical Anchors)', free: '✅', go: '✅', plus: '✅' },
  { label: 'Niveles Clave / Presión Corta', free: '✅', go: '✅', plus: '✅' },
  { label: 'Rastro Lógico (Logical Trace)', free: '❌', go: '✅', plus: '✅' },
  { label: 'Auditoría de Fundamentos (Rationale Audit)', free: '❌', go: '✅', plus: '✅' },
  { label: 'Compartir Informes', free: '❌', go: 'Ilimitado', plus: 'Ilimitado' },
  { label: 'Cobertura de Mercado', free: 'US / HK / CN', go: 'US / HK / CN', plus: 'US / HK / CN' },
  
  { isGroup: true, label: 'Notificaciones del Sistema (Notifications)' },
  { label: 'Frecuencia en Tiempo Real', free: 'Limitado', go: 'Full Tiempo Real', plus: 'Full Tiempo Real', highlight: true },
  { label: 'Categorías de Notificación', free: 'Básico', go: 'Todas las Categorías', plus: 'Todas las Categorías' },

  { isGroup: true, label: 'Academia ZISO (Academy)' },
  { label: 'Guías 101', free: 'Incluido', go: 'Incluido', plus: 'Incluido' },
  { label: 'Lógicas Maestras', free: 'Incluido', go: 'Incluido', plus: 'Incluido' },
  { label: 'Contenido Adicional', free: 'Incluido', go: 'Included', plus: 'Included' },
] as FeatureComparisonRow[];

export function SpanishPricingPage() {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "ZISO AI",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "AggregateOffer",
      "offerCount": "3",
      "lowPrice": "0",
      "highPrice": "69.9",
      "priceCurrency": "USD"
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "¿Por qué es una suscripción?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Una suscripción es para el cómputo continuo y el razonamiento multi-agente necesario para entregar Análisis Accionables y tácticos profesionales."
        }
      }
    ]
  };

  return (
    <PageShell currentPage="pricing">
      <JsonLd data={softwareSchema} />
      <JsonLd data={faqSchema} />
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40">
        <div className="text-center space-y-4 mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            Precios estructurados para inversores disciplinados
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight italic">
            Nombra a tu propio
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent italic">Consejo de investigación ZISO.</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium max-w-3xl mx-auto leading-relaxed mt-6">
            Una suscripción aquí no es solo comprar funciones. Es más parecido a contratar un consejo de investigación las 24 horas.
            Nuestro plan &quot;Go&quot; está diseñado para reducir la interferencia emocional, fortalecer su hábito de revisión nocturna y hacer que la toma de decisiones sea más tranquila, limpia y consistente.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-20">
          {ES_PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`glass-card p-8 flex flex-col relative overflow-hidden text-left ${
                plan.highlight ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-white/5'
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-5 right-[-35px] rotate-45 bg-indigo-600 text-white text-[10px] font-black px-10 py-1 uppercase tracking-tighter">
                  Recomendado
                </div>
              )}

              <div className="mb-8">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${plan.accent}`}>{plan.eyebrow}</p>
                <h3 className="text-3xl font-black mt-4 italic">{plan.name}</h3>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold">$</span>
                    <span className="text-5xl font-black tracking-tighter">{plan.price}</span>
                  </div>
                  {'msrp' in plan && plan.msrp && (
                    <div className="flex items-baseline gap-0.5 text-slate-500/50 line-through decoration-indigo-500/30">
                      <span className="text-[10px] font-bold">$</span>
                      <span className="text-xl font-bold tracking-tighter">{plan.msrp}</span>
                    </div>
                  )}
                </div>
                <p className="text-slate-500 text-sm mt-2">{plan.period}</p>
                <p className="text-slate-400 text-sm mt-4 leading-relaxed italic">{plan.description}</p>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm">
                    <div className="mt-1 w-4 h-4 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Check size={10} className={plan.highlight ? 'text-indigo-400' : 'text-slate-500'} />
                    </div>
                    <span className="text-slate-300 font-medium">{feature}</span>
                  </div>
                ))}
              </div>

              <Link
                href={plan.href}
                target={plan.href.startsWith('mailto:') ? undefined : '_blank'}
                rel={plan.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black italic transition-all active:scale-95 ${
                  plan.highlight
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white'
                }`}
              >
                {plan.cta}
                <ChevronRight size={18} />
              </Link>
              {'note' in plan && plan.note && (
                <p className="mt-3 text-[11px] text-slate-500">{plan.note}</p>
              )}
            </div>
          ))}
        </div>

        <section className="mb-24 hidden md:block">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black tracking-tighter italic uppercase">Comparativa de profundidad</h2>
            <p className="text-slate-500 text-sm mt-2">Una visión más clara de qué cambia cuando pasas de la exploración a la disciplina diaria.</p>
          </div>

          <div className="glass-card overflow-hidden border-white/5 bg-white/[0.01]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="py-6 px-8 text-sm font-black uppercase tracking-widest text-slate-500">Capacidad</th>
                  <th className="py-6 px-8 text-sm font-black italic">Gratis</th>
                  <th className="py-6 px-8 text-sm font-black italic text-indigo-300">Go (Principal)</th>
                  <th className="py-6 px-8 text-sm font-black italic text-emerald-400/60">Plus (Próximamente)</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {ES_FEATURE_COMPARISON.map((row: FeatureComparisonRow, i: number) => {
                  if ('isGroup' in row) {
                    return (
                      <tr key={i} className="bg-white/[0.03]">
                        <td colSpan={4} className="py-4 px-8 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400/80">
                          {row.label}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                      <td className="py-5 px-8 text-slate-400 font-bold">{row.label}</td>
                      <td className="py-5 px-8 text-slate-500">{row.free}</td>
                      <td className={`py-5 px-8 ${row.highlight ? 'text-indigo-100 font-black bg-indigo-500/5' : 'text-slate-300'}`}>{row.go}</td>
                      <td className="py-5 px-8 text-slate-500 italic opacity-60">{row.plus}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section id="faq" className="pt-24 pb-10 w-full max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black tracking-tighter uppercase mb-2 italic"> Precios <span className="text-indigo-500 uppercase">FAQ</span> </h2>
            <p className="text-slate-400 font-medium italic text-lg text-center">Comprendiendo el valor de tu consejo de investigación ZISO</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter italic text-indigo-400">¿Por qué es una suscripción?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Una suscripción no es solo por software; es por el cómputo continuo y el razonamiento multi-agente necesario para entregar Análisis Accionables profesionales. Estás contratando a un consejo disciplinado que trabaja mientras el mercado está cerrado.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter italic text-indigo-400">¿En qué se diferencia Go de Gratis?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Gratis se basa en reglas con 3 verificaciones al día. Go se basa en razonamiento con 10 verificaciones al día. Go desbloquea la capa lógica profunda de DeepSeek, proporcionando informes tácticos más profundos, notificaciones completas en tiempo real y niveles clave de precios.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter italic text-indigo-400">¿Qué es &quot;Plus&quot;?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Plus es nuestro próximo nivel de alta gama. Contará con &quot;Razonamiento por Consenso&quot; donde múltiples modelos (DeepSeek + Gemini) se validan entre sí para proporcionar los niveles de confianza más altos para traders profesionales.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter italic text-indigo-400">¿Puedo cambiar o cancelar mi plan en cualquier momento?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Por supuesto. Todo el proceso se gestiona a través del portal seguro de Stripe, lo que te permite cambiar de nivel o cancelar tu suscripción mensual en cualquier momento sin cargos ocultos.</p>
            </div>
          </div>
        </section>

        <section className="w-full pt-10 pb-20 opacity-[0.05] hover:opacity-100 transition-opacity">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="flex-1 text-left">
              <GeoSummary
                locale="es"
                summary={[
                  'Suscripción: Acceso a una mesa de investigación de IA multi-agente para informes tácticos nocturnos.',
                  'Nivel Gratis: 3 Análisis Accionables por día usando motores de reglas básicos.',
                  'Nivel Go: 10 Análisis Accionables por día impulsados por el razonamiento de DeepSeek.',
                  'Nivel Plus: Perspectivas impulsadas por consenso con validación multi-modelo (DeepSeek + Gemini).',
                ]}
              />
            </div>
            <div className="flex-1 text-left">
              <SourceBlock
                locale="es"
                sources={[
                  ...ES_DEFAULT_SOURCES,
                  { name: 'Precios de Suscripción', url: 'https://ziso.cc/es/pricing', accessedAt: '2026-04-03' },
                ]}
              />
            </div>
          </div>
          <BoundaryNotice locale="es" text={ES_BOUNDARY_NOTICE} />
        </section>
      </main>
    </PageShell>
  );
}
