'use client';

import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageShell, ES_BOUNDARY_NOTICE, ES_DEFAULT_SOURCES } from './EsLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';
import { JsonLd } from '@/components/seo/JsonLd';

const ES_PRICING_PLANS = [
  {
    name: 'Gratis',
    eyebrow: 'Acceso inicial',
    price: '0',
    period: 'Para siempre',
    description: 'Para inversores que exploran por primera vez la revisión del mercado asistida por IA.',
    features: [
      'Capa de señales de tendencia basada en reglas',
      'Resumen diario del mercado',
      'Almanaque del mercado y tarjeta de humor macro',
      '3 verificaciones de acciones por IA al día',
      'Acceso a la comunidad',
    ],
    cta: 'Empezar Gratis',
    href: 'https://app.ziso.cc',
    highlight: false,
    accent: 'text-slate-300',
  },
  {
    name: 'Go',
    eyebrow: 'Producto principal',
    price: '4.99',
    period: 'Mensual / $49.9 anual',
    description: 'Para inversores que buscan una investigación nocturna profunda y una disciplina de ejecución más fuerte.',
    features: [
      'Capa de razonamiento DeepSeek',
      'Informes tácticos estilo entrenador',
      '10 nombres de lista de vigilancia monitoreados',
      'Niveles clave y unlocks de sentimiento',
      'Alertas de disciplina en tiempo real',
      'Insignia de identidad Go',
    ],
    cta: 'Abrir App',
    href: 'https://app.ziso.cc',
    highlight: true,
    accent: 'text-indigo-300',
  },
  {
    name: 'Alpha',
    eyebrow: 'Flujo de trabajo avanzado',
    price: '1,999',
    period: 'Al año',
    description: 'Para usuarios avanzados que necesitan monitoreo profundo y soporte prioritario.',
    features: [
      'Análisis de eventos intradía',
      'Panel de estrategia dedicado',
      'Informes detallados automatizados',
      'Acceso a datos crudos nivel API',
      'Soporte prioritario',
    ],
    cta: 'Contactar Soporte',
    href: 'mailto:hi@ziso.cc',
    highlight: false,
    accent: 'text-emerald-300',
  },
] as const;

const ES_FEATURE_COMPARISON = [
  { label: 'Profundidad de razonamiento de IA', gratis: 'Motor de reglas + IA básica', pro: 'Capa de razonamiento profundo (Go)', highlight: true },
  { label: 'Capacidad de lista de vigilancia', gratis: '3 nombres', pro: '10 nombres', highlight: true },
  { label: 'Cobertura de mercado', gratis: 'Acciones de China + Hong Kong', pro: 'Acciones de China + Hong Kong', highlight: false },
  { label: 'Alertas de disciplina en tiempo real', gratis: 'No', pro: 'Sí, para cambios importantes de setup', highlight: true },
  { label: 'Ritmo de datos', gratis: 'Post-cierre', pro: 'Post-cierre + alertas selectivas en tiempo real', highlight: false },
] as const;

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
      "highPrice": "1999",
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
          "text": "Una suscripción es para el cómputo continuo y el razonamiento multi-agente necesario para entregar un informe nocturno. Estás contratando a un consejo disciplinado que trabaja cuando el mercado está cerrado."
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
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
            Nombra a tu propio
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">Consejo de investigación ZISO.</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium max-w-3xl mx-auto leading-relaxed mt-6">
            Una suscripción aquí no es solo comprar características. Es más parecido a contratar a un consejo de investigación 24/7.
            El producto está diseñado para reducir la interferencia emocional, fortalecer tu hábito de revisión nocturna y hacer 
            que la toma de decisiones sea más tranquila y consistente.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-20">
          {ES_PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`glass-card p-8 flex flex-col relative overflow-hidden ${
                plan.highlight ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-white/5'
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-5 right-[-35px] rotate-45 bg-indigo-600 text-white text-[10px] font-black px-10 py-1 uppercase tracking-tighter">
                  Plan principal
                </div>
              )}

              <div className="mb-8">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${plan.accent}`}>{plan.eyebrow}</p>
                <h3 className="text-3xl font-black mt-4">{plan.name}</h3>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold">$</span>
                  <span className="text-5xl font-black tracking-tighter">{plan.price}</span>
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
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black transition-all active:scale-95 ${
                  plan.highlight
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white'
                }`}
              >
                {plan.cta}
                <ChevronRight size={18} />
              </Link>
            </div>
          ))}
        </div>

        <section className="mb-24 hidden md:block">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black tracking-tighter">Comparativa de profundidad</h2>
            <p className="text-slate-500 text-sm mt-2">Una visión más clara de qué cambia cuando pasas de la exploración a la disciplina diaria.</p>
          </div>

          <div className="glass-card overflow-hidden border-white/5 bg-white/[0.01]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="py-6 px-8 text-sm font-black uppercase tracking-widest text-slate-500">Capacidad</th>
                  <th className="py-6 px-8 text-sm font-black text-slate-300">Gratis</th>
                  <th className="py-6 px-8 text-sm font-black text-indigo-300">Go</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {ES_FEATURE_COMPARISON.map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                    <td className="py-5 px-8 text-slate-400 font-bold">{row.label}</td>
                    <td className="py-5 px-8 text-slate-500 font-bold">{row.gratis}</td>
                    <td className={`py-5 px-8 font-black ${row.highlight ? 'text-indigo-400' : 'text-slate-400'}`}>{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="faq" className="pt-24 pb-10 w-full max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black tracking-tighter uppercase mb-2"> Precios <span className="text-indigo-500 uppercase">FAQ</span> </h2>
            <p className="text-slate-400 font-medium italic text-lg">Comprendiendo el valor de tu consejo de investigación ZISO</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">¿Por qué es una suscripción?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Una suscripción no es solo por software; es por el cómputo continuo y el razonamiento multi-agente necesario para entregar un informe nocturno. Estás contratando a un consejo disciplinado que trabaja mientras el mercado está cerrado.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">¿En qué se diferencia Go de Gratis?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Gratis se basa en reglas. Go se basa en razonamiento. Go desbloquea la capa lógica profunda de DeepSeek, proporcionando informes tácticos más profundos, niveles clave y el disyuntor de riesgo del 75%.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">¿El límite del 75% está disponible para usuarios Gratis?</p>
              <p className="text-slate-400 text-sm leading-relaxed">No. El protocolo de control de riesgos y las alertas de modo defensa son parte de nuestra suite de ejecución disciplinada premium. Los usuarios gratis reciben el resumen de datos, pero no la aplicación de límites tácticos.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">¿Puedo cambiar o cancelar mi plan en cualquier momento?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Por supuesto. Todo el proceso se gestiona a través de un portal seguro, lo que te permite cambiar de nivel o cancelar tu suscripción mensual en cualquier momento sin cargos ocultos.</p>
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
                  'Nivel Gratis: Resumen basado en reglas para identificación básica de tendencias.',
                  'Nivel Go: Informes de razonamiento impulsados por DeepSeek, incluyendo la lógica de disyuntor del 75%.',
                ]}
              />
            </div>
            <div className="flex-1 text-left">
              <SourceBlock
                locale="es"
                sources={[
                  ...ES_DEFAULT_SOURCES,
                  { name: 'Precios de Suscripción', url: 'https://ziso.cc/es/pricing', accessedAt: '2026-03-25' },
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
