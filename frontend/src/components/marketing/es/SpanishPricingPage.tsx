'use client';

import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageShell } from './EsLayout';

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
    name: 'Pro',
    eyebrow: 'Producto principal',
    price: '29.9',
    period: 'Al mes / ¥299 al año',
    description: 'Para inversores que desean una investigación nocturna más profunda y una mayor disciplina.',
    features: [
      'Capa de razonamiento DeepSeek (Go)',
      'Informes tácticos estilo coach',
      '10 nombres de lista de vigilancia monitoreados',
      'Niveles clave y análisis de sentimiento',
      'Alertas de disciplina en tiempo real (cambios de setup)',
      'Insignia de identidad Pro',
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
  { label: 'Estilo de informe', gratis: 'Resumen básico', pro: 'Narrativa estilo coach y atribución', highlight: true },
  { label: 'Capacidad de lista de vigilancia', gratis: '3 nombres', pro: '10 nombres', highlight: true },
  { label: 'Cobertura de mercado', gratis: 'Acciones de China + Hong Kong', pro: 'Acciones de China + Hong Kong', highlight: false },
  { label: 'Alertas de disciplina en tiempo real', gratis: 'No', pro: 'Sí, para cambios importantes de setup', highlight: true },
  { label: 'Ritmo de datos', gratis: 'Post-cierre', pro: 'Post-cierre + alertas selectivas en tiempo real', highlight: false },
] as const;

export function SpanishPricingPage() {
  return (
    <PageShell currentPage="pricing">
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
                  <span className="text-sm font-bold">¥</span>
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
                  <th className="py-6 px-8 text-sm font-black text-indigo-300">Pro</th>
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
      </main>
    </PageShell>
  );
}
