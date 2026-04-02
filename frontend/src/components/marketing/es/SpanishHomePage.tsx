'use client';

import { ShieldCheck, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { PageShell, ES_BOUNDARY_NOTICE, ES_DEFAULT_SOURCES } from './EsLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';
import { JsonLd } from '@/components/seo/JsonLd';

export function SpanishHomePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "¿Qué es exactamente ZISO AI?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Es un asistente de investigación profesional que se encarga de la agotadora tarea de analizar el mercado. Combinando modelos históricos profundos con un consejo de razonamiento multi-agente, transforma el ruido del mercado en un guion de decisión estructurado."
        }
      },
      {
        "@type": "Question",
        "name": "¿Cómo funciona el razonamiento de la IA?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ZISO AI utiliza una arquitectura de 'Consejo de Agentes'. Combina el razonamiento lógico profundo de DeepSeek con el matiz contextual de Hunyuan y motores de reglas quant fijos para asegurar que cada informe táctico sea explicable y fundamentado."
        }
      },
      {
        "@type": "Question",
        "name": "¿Por qué el límite de confianza del 75%?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Priorizamos la disciplina sobre la frecuencia. Si la confianza en los setups estructurales de una sesión cae por debajo del 75%, se activa un disyuntor rígido. Sobrevivir primero, luego ganar. Esto evita el 'over-trading' emocional que atrapa a la mayoría de los inversores."
        }
      },
      {
        "@type": "Question",
        "name": "¿Son auténticos los registros históricos?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "La transparencia es nuestra moneda principal. Todos los informes nocturnos y sus resultados posteriores se archivan y son verificables. No solo entregamos consejos; mantenemos un historial de auditoría transparente para cada sesión táctica."
        }
      }
    ]
  };

  return (
    <PageShell currentPage="home">
      <JsonLd data={faqSchema} />
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40 flex flex-col items-center text-center">
        <div className="space-y-6 max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-black uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            ZISO AI | Investigación de mercado post-cierre para inversores serios
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight">
            La IA investiga.
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
              Tú tomas la decisión.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            ZISO AI convierte los datos de mercado post-cierre en un informe disciplinado con niveles clave, estados de acción, contexto 
            y límites de riesgo, para que los inversores minoristas puedan prepararse para la próxima sesión en lugar de reaccionar dentro de ella.
          </p>
          <div className="pt-10 flex flex-col md:flex-row items-center justify-center gap-4">
            <Link
              href="https://app.ziso.cc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-5 rounded-3xl bg-indigo-500 text-white font-black text-lg shadow-[0_20px_40px_rgba(99,102,241,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              Abrir la App <ChevronRight size={20} />
            </Link>
            <Link href="/es/pricing" className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-white font-black text-lg hover:bg-white/10 transition-all">
              Ver Precios
            </Link>
          </div>
        </div>

        <div className="w-full max-w-5xl relative mt-20">
          <div className="relative h-[500px] md:h-[700px] w-full flex items-center justify-center">
            <div className="absolute left-[5%] md:left-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 -rotate-12 origin-bottom-right hidden sm:flex items-center justify-center p-2 transition-transform hover:-translate-x-2">
              <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                <Image src="/images/landing/analysis-depth.png" alt="Detalle de análisis de IA" fill sizes="(min-width: 768px) 25vw, 45vw" className="object-cover" />
              </div>
            </div>

            <div className="absolute right-[5%] md:right-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 rotate-12 origin-bottom-left hidden sm:flex items-center justify-center p-2 transition-transform hover:translate-x-2">
              <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                <Image src="/images/landing/alert-popup.png" alt="Alerta de disciplina en tiempo real" fill sizes="(min-width: 768px) 25vw, 45vw" className="object-cover" />
              </div>
            </div>

            <div className="relative w-[70%] sm:w-[50%] md:w-[32%] aspect-[9/19] bg-[#1A1A25] rounded-[40px] border border-white/20 shadow-[0_0_100px_rgba(99,102,241,0.2)] z-30 flex items-center justify-center p-2 md:p-3 transition-transform hover:scale-[1.02]">
              <div className="w-full h-full bg-[#050508] rounded-[30px] border border-white/10 overflow-hidden relative">
                <Image src="/images/landing/main-dashboard.png" alt="Vista previa del panel principal" fill priority sizes="(min-width: 1024px) 32vw, (min-width: 640px) 50vw, 70vw" className="object-cover" />
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full border border-white/5 z-20" />
              </div>
            </div>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] -z-10 rounded-full" />
        </div>

        <section id="features" className="pt-48 w-full grid md:grid-cols-2 gap-20 items-center text-left">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em]">
              Construye el plan de mañana
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              Revisa cuando el mercado esté en calma.
              <br />
              <span className="text-indigo-400">Escribe el guion de mañana antes de que llegue el mañana.</span>
            </h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              Los traders profesionales no se definen solo por su instinto rápido intradía. Su verdadera ventaja proviene del trabajo
              que realizan después del cierre. ZISO AI conecta los datos del mercado y las noticias cada noche, convirtiéndolos en un
              guion de decisión estructurado. No fabrica predicciones aleatorias. Define límites ejecutables.
            </p>
            <ul className="space-y-4">
              {[
                'Resonancia de tendencia en múltiples plazos a través de MA, RSI y MACD',
                'Rastreo de anomalías de precio-volumen con explicación contextual',
                'Puntuación de confianza basada en la lógica de tasa de acierto histórica',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm font-bold text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <ChevronRight size={14} />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-card aspect-square bg-[#0A0A10] rounded-[40px] overflow-hidden border border-white/5 relative">
            <Image src="/images/landing/prediction-card-detail.png" alt="Informe táctico detallado" fill className="object-cover opacity-80 hover:opacity-100 transition-opacity duration-700" />
          </div>
        </section>

        <section className="pt-32 w-full grid md:grid-cols-2 gap-20 items-center text-left">
          <div className="order-2 md:order-1 glass-card aspect-square bg-[#0A0A10] rounded-[40px] overflow-hidden border border-white/5 relative">
            <Image src="/images/landing/circuit-breaker-logic.png" alt="Lógica de disyuntor de riesgo" fill sizes="(min-width: 768px) 45vw, 100vw" className="object-cover opacity-80 hover:opacity-100 transition-opacity duration-700" />
            <ShieldCheck size={120} className="absolute bottom-4 right-4 opacity-[0.1] text-red-500 pointer-events-none" />
          </div>
          <div className="order-1 md:order-2 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-[0.2em]">
              Sistema de control de riesgos
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              Incluso en el mercado más volátil,
              <br />
              <span className="text-red-400">la puerta del 75% se mantiene firme.</span>
            </h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              Comprender el juego no es suficiente. También necesitas defender tus límites. Si la confianza del sistema
              en la próxima sesión cae por debajo del 75%, ZISO AI activa un disyuntor rígido y bloquea acciones agresivas.
              Observar primero. Sobrevivir primero. No perder la disciplina es la primera regla para permanecer en el 
              mercado el tiempo suficiente para ganar algo significativo.
            </p>
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
              <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                <span className="text-slate-500">Puntuación de confianza de IA</span>
                <span className="text-red-400">Disyuntor activado</span>
              </div>
              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full w-[64%] bg-red-500/50" />
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                Estado actual: sin configuración, modo de defensa activo
              </p>
            </div>
          </div>
        </section>

        <section className="pt-32 w-full">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              <span className="text-indigo-400">3 pasos</span> hacia un sistema de trading más independiente
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-12 text-left">
            {[
              {
                num: '01',
                title: 'Fija tu lista de vigilancia',
                desc: 'Añade los activos que te interesan. El sistema comienza inmediatamente a sincronizar y modelar aproximadamente 250 días de historial de trading.',
              },
              {
                num: '02',
                title: 'Recibe el informe nocturno',
                desc: 'Unos 30 minutos después del cierre, el asistente de investigación entrega un informe con soporte, resistencia, marco táctico y lógica de decisión.',
              },
              {
                num: '03',
                title: 'Ejecuta con disciplina intradía',
                desc: 'Deja de permitir que el movimiento aleatorio intradía dicte tu operación. Cuando el precio alcance el guion establecido la noche anterior, el consejo ayuda a restaurar la disciplina de ejecución.',
              },
            ].map((step) => (
              <div key={step.num} className="space-y-6 relative group">
                <div className="text-7xl font-black text-white/[0.03] group-hover:text-indigo-500/10 transition-colors absolute -top-10 -left-4">
                  {step.num}
                </div>
                <h3 className="font-extrabold text-2xl relative z-10">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium relative z-10">{step.desc}</p>
                <div className="w-12 h-1 bg-white/5 rounded-full group-hover:w-20 group-hover:bg-indigo-500/30 transition-all duration-500" />
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="pt-40 pb-10 w-full max-w-4xl space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase mb-2"> Preguntas frecuentes <span className="text-indigo-500 uppercase">FAQ</span> </h2>
            <p className="text-slate-400 font-medium italic text-lg">Profundiza en la metodología de ZISO AI</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">¿Qué es exactamente ZISO AI?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Es un asistente de investigación profesional que se encarga de la agotadora tarea de analizar el mercado. Combinando modelos históricos profundos con un consejo de razonamiento multi-agente, transforma el ruido del mercado en un guion de decisión estructurado.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">¿Cómo funciona el razonamiento de la IA?</p>
              <p className="text-slate-400 text-sm leading-relaxed">A diferencia de los bots de predicción simples, ZISO AI utiliza una arquitectura de &quot;Consejo de Agentes&quot;. Combina el razonamiento lógico profundo de DeepSeek con el matiz contextual de Hunyuan y motores de reglas quant fijos para asegurar que cada informe táctico sea explicable y fundamentado.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">¿Por qué el límite de confianza del 75%?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Priorizamos la disciplina sobre la frecuencia. Si la confianza en los setups estructurales de una sesión cae por debajo del 75%, se activa un disyuntor rígido. Sobrevivir primero, luego ganar. Esto evita el &quot;over-trading&quot; emocional que atrapa a la mayoría de los inversores.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">¿Son auténticos los registros históricos?</p>
              <p className="text-slate-400 text-sm leading-relaxed">La transparencia es nuestra moneda principal. Todos los informes nocturnos y sus resultados posteriores se archivan y son verificables. No solo entregamos consejos; mantenemos un historial de auditoría transparente para cada sesión táctica.</p>
            </div>
          </div>
        </section>

        <section className="w-full max-w-4xl pt-10 pb-20 opacity-[0.05] hover:opacity-100 transition-opacity">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="flex-1 text-left">
              <GeoSummary
                locale="es"
                summary={[
                  'Investigación principal: Revisión post-cierre basada en resonancia de tendencias multi-plazo (MA, RSI, MACD).',
                  'Lógica de decisión: Arquitectura de sinergia multi-agente que separa razonamiento, análisis de contexto y reglas quant.',
                  'Protocolo de riesgo: Disyuntor de confianza del 75% para límites de decisión, asegurando disciplina institucional.',
                ]}
              />
            </div>
            <div className="flex-1 text-left">
              <SourceBlock
                locale="es"
                sources={[
                  ...ES_DEFAULT_SOURCES,
                  { name: 'Posicionamiento del producto', url: 'https://ziso.cc/es', accessedAt: '2026-03-25' },
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
