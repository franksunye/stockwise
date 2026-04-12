'use client';

import React from 'react';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingHeader from '@/components/MarketingHeader';

export function PageShell({
  currentPage,
  children,
}: {
  currentPage: 'home' | 'about' | 'pricing' | 'privacy' | 'terms' | 'refund';
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden font-sans">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[120px] rounded-full" />
      </div>
      <MarketingHeader currentPage={currentPage} locale="es" />
      {children}
      <MarketingFooter locale="es" />
      <style jsx global>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 40px;
        }
      `}</style>
    </div>
  );
}

export const ES_FOUNDERS = [
  {
    label: 'Fundador / Jefe de Investigación',
    name: 'Andre Gu',
    description:
      'Lidera la dirección de investigación, la arquitectura de sistemas y la entrega de productos, convirtiendo la metodología de quant más IA en un flujo de trabajo estable orientado al usuario.',
  },
  {
    label: 'Cofundador',
    name: 'Frank Sun',
    description:
      'Responsable de la estrategia de producto, el diseño del marco de trading y los límites de riesgo, asegurando que cada resultado sea explicable, ejecutable y revisable.',
  },
] as const;

export const ES_AGENT_TEAM = [
  {
    name: 'DeepSeek',
    role: 'Analista Senior',
    description:
      'Produce la conclusión principal, análisis de escenarios profundos y juicios de riesgo clave, transformando ese trabajo en una narrativa táctica clara.',
    avatarSeed: 'gu-shen-deepseek',
    textColor: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    glowColor: 'bg-indigo-500',
    aboutGradient: 'from-indigo-500/20',
  },
  {
    name: 'Lin Xu (Hunyuan Lite)',
    role: 'Analista Junior',
    description:
      'Añade análisis de apoyo y ángulos alternativos, ayudando a traducir el comportamiento complejo del mercado en juicios más fáciles de entender y ejecutar.',
    avatarSeed: 'lin-xu-hunyuan-lite',
    textColor: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    glowColor: 'bg-cyan-500',
    aboutGradient: 'from-cyan-500/20',
  },
  {
    name: 'Cheng Ju (Rule Engine)',
    role: 'Analista de Reglas Quant',
    description:
      'Explica la visión basada en reglas, el estado de disciplina y las limitaciones estructurales, representando la perspectiva de reglas quant sin pretender juicios discrecionales.',
    avatarSeed: 'cheng-ju-quant-rules',
    textColor: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    glowColor: 'bg-rose-500',
    aboutGradient: 'from-rose-500/20',
  },
  {
    name: 'Shen Ce (Quant Engineer)',
    role: 'Ingeniero de Quant',
    description:
      'Construye la base del modelo quant, convirtiendo el manejo de datos, indicadores, reglas y parámetros en un sistema estable de grado de producción.',
    avatarSeed: 'shen-ce-quant-engineer',
    textColor: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    glowColor: 'bg-violet-500',
    aboutGradient: 'from-violet-500/20',
  },
  {
    name: 'Nora',
    role: 'Oficial de Contexto',
    description:
      'Filtra noticias y ruido macro, restaurando el contexto real alrededor de cada señal para que las decisiones tácticas no se tomen en el vacío.',
    avatarSeed: 'nora-context-desk',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    glowColor: 'bg-emerald-500',
    aboutGradient: 'from-emerald-500/20',
  },
  {
    name: 'Verifier',
    role: 'Auditor de Validación',
    description:
      'Revisa los resultados después del cierre, rastrea la tasa de acierto y la deriva del modelo, ayudando a mantener la responsabilidad del flujo de trabajo de investigación.',
    avatarSeed: 'verifier-audit-desk',
    textColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    glowColor: 'bg-amber-500',
    aboutGradient: 'from-amber-500/20',
  },
] as const;

export const ES_DEFAULT_SOURCES = [
  { name: 'ZISO AI Centro de Investigación', url: 'https://ziso.cc/learn' },
  { name: 'ZISO AI Centro de Soporte', url: 'https://ziso.cc/support' },
] as const;

export const ES_BOUNDARY_NOTICE =
  'Todo el contenido se proporciona únicamente con fines de investigación e información. Nada en este sitio constituye asesoramiento de inversión o una promesa de rentabilidad.';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export function LegalShell({
  icon: Icon,
  eyebrow,
  title,
  updatedAt,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  eyebrow: string;
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <PageShell currentPage="home">
      <main className="relative z-10 max-w-3xl mx-auto px-8 py-20">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-black uppercase tracking-widest">
            <Icon size={12} /> {eyebrow}
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter">{title}</h1>
          <p className="text-slate-400 text-sm">Última actualización: {updatedAt}</p>
        </div>

        <div className="glass-card p-8 md:p-12 space-y-8 border-white/5 bg-white/[0.01] mt-10 text-left">
          {children}
        </div>

        <div className="mt-10">
          <Link href="/es" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Volver al inicio en español
          </Link>
        </div>
      </main>
    </PageShell>
  );
}
