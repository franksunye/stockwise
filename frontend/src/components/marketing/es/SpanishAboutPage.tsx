'use client';

import { Sparkles, Target, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Multiavatar from '@/components/Multiavatar';
import { PageShell, ES_FOUNDERS, ES_AGENT_TEAM } from './EsLayout';

export function SpanishAboutPage() {
  return (
    <PageShell currentPage="about">
      <main className="relative z-10 max-w-5xl mx-auto px-8 pt-20 pb-32">
        <div className="space-y-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest">
            <Sparkles size={12} /> Sobre ZISO AI
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
            Disciplina de investigación institucional,
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
              adaptada para inversores minoristas expertos.
            </span>
          </h1>
          <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-3xl">
            ZISO AI es un socio de investigación de bolsillo y un entrenador de ejecución práctica. Se hace cargo de la agotadora
            tarea de analizar el mercado y ayuda a los inversores a ver la lógica profunda detrás de cada decisión.
          </p>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 max-w-3xl">
            Servicio de primera línea por un equipo de investigación, respaldado por modelos de análisis, modelos quant y flujos de trabajo automatizados.
          </p>
        </div>

        <section className="pt-24 grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Target className="text-indigo-400" />
            </div>
            <h2 className="text-3xl font-black tracking-tighter">Nuestra misión</h2>
            <p className="text-slate-400 leading-relaxed font-bold">
              ZISO AI se construyó en torno a un objetivo directo: <span className="text-white">ayudar a los inversores ordinarios a operar con una disciplina de investigación de grado institucional.</span>
            </p>
            <p className="text-slate-500 text-sm leading-relaxed">
              Los inversores minoristas suelen estar atrapados por información fragmentada, hábitos de revisión deficientes y
              toma de decisiones reactiva. ZISO AI utiliza múltiples agentes cooperativos para procesar las entradas diarias
              del mercado, estructurar el ciclo de revisión y ayudar a los usuarios a dejar atrás el trading basado en la
              intuición en favor de decisiones más calmadas y defendibles.
            </p>
          </div>
          <div className="glass-card p-1 relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 rounded-[38px] blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="bg-[#0a0a0f] rounded-[38px] p-8 relative z-10 space-y-4">
              <div className="text-indigo-300 font-black text-xl leading-tight">
                &ldquo;Mira lo que es visible. Guarda lo que debe permanecer disciplinado.&rdquo;
              </div>
              <p className="text-slate-500 text-sm text-justify leading-relaxed">
                Ese es el espíritu detrás del nombre ZISO. La primera parte (知) es el trabajo de investigación profunda que
                ayuda a los inversores a ver la estructura del mercado con mayor claridad. La segunda parte (守) es la 
                disciplina perdurable que protege el capital cuando la certeza es débil. Comprende el juego, pero mantén 
                la línea. Eso es lo que hace posible la ejecución racional.
              </p>
            </div>
          </div>
        </section>

        <section className="pt-24 space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black tracking-tighter">Equipo y estructura operativa</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm">
              Separamos la dirección de investigación, la expresión del análisis, la ingeniería quant, la inteligencia de contexto 
              y la auditoría de resultados en roles claros, entregando la experiencia como si una mesa de investigación 
              trabajara junto al usuario.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {ES_FOUNDERS.map((founder) => (
              <div key={founder.name} className="glass-card p-8 space-y-4 border-white/10 bg-white/[0.02]">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">{founder.label}</div>
                <h3 className="text-2xl font-black">{founder.name}</h3>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">{founder.description}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {ES_AGENT_TEAM.map((member) => (
              <div key={member.name} className={`p-6 rounded-[32px] bg-gradient-to-b ${member.aboutGradient} to-transparent border border-white/5 flex flex-col items-center text-center space-y-4`}>
                <div className="w-16 h-16 rounded-full bg-black/40 border border-white/10 overflow-hidden">
                  <Multiavatar name={member.avatarSeed} className="w-full h-full" />
                </div>
                <div>
                  <div className={`font-black ${member.textColor}`}>{member.name}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{member.role}</div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{member.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pt-32 text-center space-y-12 border-b border-white/5 pb-32">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight">
            Deja de operar solo.
            <br />
            <span className="text-indigo-400">Activa el soporte de decisiones mejorado por IA.</span>
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="https://app.ziso.cc"
              className="px-10 py-5 rounded-3xl bg-indigo-500 text-white font-black shadow-lg hover:scale-105 transition-all"
            >
              Abrir la App
            </Link>
            <Link
              href="/es"
              className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-slate-400 font-black hover:text-white transition-all flex items-center gap-2"
            >
              <ArrowLeft size={18} /> Volver al Inicio
            </Link>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
