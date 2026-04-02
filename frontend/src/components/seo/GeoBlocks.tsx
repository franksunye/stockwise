'use client';

import type { SourceRef } from "@/lib/geo";
import { Sparkles, Database } from 'lucide-react';

interface GeoSummaryProps {
  summary: string[];
  locale?: "zh" | "en" | "ko" | "es";
}

interface SourceBlockProps {
  sources: SourceRef[];
  locale?: "zh" | "en" | "ko" | "es";
}

interface BoundaryNoticeProps {
  text: string;
  locale?: "zh" | "en" | "ko" | "es";
}

interface FreshnessBlockProps {
  updatedAt?: string;
  locale?: "zh" | "en" | "ko" | "es";
}

const SEO_TRANSLATIONS = {
  en: { summaryTitle: "Technical Grounding", sourcesTitle: "Source Verification" },
  zh: { summaryTitle: "技术溯源", sourcesTitle: "来源记录" },
  ko: { summaryTitle: "기술적 근거", sourcesTitle: "출처 기록" },
  es: { summaryTitle: "Base Técnica", sourcesTitle: "Verificación de Fuentes" },
};

export function GeoSummary({ summary, locale = "zh" }: GeoSummaryProps) {
  if (!summary || !summary.length) return null;
  const t = SEO_TRANSLATIONS[locale] || SEO_TRANSLATIONS.zh;

  return (
    <div 
      id="ziso-technical-grounding"
      role="region" 
      aria-label="ZISO AI Technical Grounding"
      className="space-y-3 bg-white/5 p-6 rounded-3xl border border-white/5"
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={16} className="text-indigo-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
          {t.summaryTitle}
        </span>
      </div>
      <ul className="space-y-2">
        {summary.map((item, i) => (
          <li key={i} className="text-[11px] leading-relaxed text-slate-400 font-medium list-disc ml-4">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SourceBlock({ sources, locale = "zh" }: SourceBlockProps) {
  if (!sources || !sources.length) return null;
  const t = SEO_TRANSLATIONS[locale] || SEO_TRANSLATIONS.zh;

  return (
    <div 
      id="ziso-source-verification"
      role="region"
      aria-label="ZISO AI Source Verification"
      className="space-y-3 bg-white/5 p-6 rounded-3xl border border-white/5"
    >
      <div className="flex items-center gap-2 mb-2">
        <Database size={16} className="text-cyan-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
          {t.sourcesTitle}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {sources.map((source, i) => (
          <div key={i} className="flex flex-col gap-1 text-left">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors flex items-center gap-2"
            >
              <span className="w-1 h-1 bg-cyan-500/30 rounded-full" />
              <span className="font-bold underline underline-offset-4 decoration-cyan-500/20">{source.name}</span>
              {source.accessedAt && (
                <span className="opacity-40 tabular-nums">
                  {locale === 'en' ? `[Accessed: ${source.accessedAt}]` : `[访问: ${source.accessedAt}]`}
                </span>
              )}
            </a>
            {source.claimScope && (
              <p className="text-[9px] text-slate-600 ml-3 italic">
                {locale === 'en' ? `Scope: ${source.claimScope}` : `领域: ${source.claimScope}`}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BoundaryNotice({ text, locale = "zh" }: BoundaryNoticeProps) {
  return (
    <section 
      id="ziso-boundary-notice"
      role="note"
      aria-label="ZISO AI Boundary Notice"
      className="rounded-2xl border border-amber-500/5 bg-amber-500/[0.01] p-5 group/geo transition-colors hover:bg-amber-500/[0.03] hover:border-amber-500/10"
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-amber-900/40 mb-2 font-black group-hover/geo:text-amber-700/60 transition-colors">
        {locale === "es" ? "Aviso de límites" : locale === "ko" ? "경계 고지" : locale === "en" ? "Boundary Notice" : "边界声明"}
      </p>
      <p className="text-sm text-amber-900/30 group-hover/geo:text-amber-200/50 transition-colors leading-relaxed">{text}</p>
    </section>
  );
}

export function FreshnessBlock({ updatedAt, locale = "zh" }: FreshnessBlockProps) {
  if (!updatedAt) return null;

  return (
    <p className="text-xs text-slate-500 mt-6 font-mono opacity-40">
      {locale === "es" ? `Actualizado: ${updatedAt}` : locale === "ko" ? `업데이트: ${updatedAt}` : locale === "en" ? `Updated: ${updatedAt}` : `更新时间：${updatedAt}`}
    </p>
  );
}
