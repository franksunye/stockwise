import type { SourceRef } from "@/lib/geo";

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

export function GeoSummary({ summary, locale = "zh" }: GeoSummaryProps) {
  if (!summary.length) return null;

  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 mb-4 group/geo transition-colors hover:bg-white/[0.03] hover:border-white/10">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 mb-3 font-black">
        {locale === "es" ? "Resumen" : locale === "ko" ? "요약" : locale === "en" ? "Summary" : "TL;DR"}
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm text-slate-500 group-hover/geo:text-slate-300 transition-colors leading-relaxed">
        {summary.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function SourceBlock({ sources, locale = "zh" }: SourceBlockProps) {
  if (!sources.length) return null;

  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 mb-4 group/geo transition-colors hover:bg-white/[0.03] hover:border-white/10">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 mb-3 font-black">
        {locale === "es" ? "Fuentes" : locale === "ko" ? "출처 기록" : locale === "en" ? "Sources" : "来源记录"}
      </p>
      <ul className="space-y-2 text-sm text-slate-500 group-hover/geo:text-slate-300 transition-colors">
        {sources.map((source) => (
          <li key={`${source.name}-${source.url || "local"}`} className="flex flex-wrap items-center gap-x-2">
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-900 group-hover/geo:text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
              >
                {source.name}
              </a>
            ) : (
              <span className="font-bold">{source.name}</span>
            )}
            {source.accessedAt ? (
              <span className="opacity-50 text-[10px]">
                {locale === "es"
                  ? `(Accedido: ${source.accessedAt})`
                  : locale === "ko" 
                    ? `(조회일: ${source.accessedAt})`
                    : locale === "en" ? `(Accessed: ${source.accessedAt})` : `（访问: ${source.accessedAt}）`}
              </span>
            ) : ""}
            {source.claimScope ? (
              <span className="opacity-50 text-[10px]">
                {locale === "es"
                  ? `(Alcance: ${source.claimScope})`
                  : locale === "ko"
                    ? `(영역: ${source.claimScope})`
                    : locale === "en" ? `(Scope: ${source.claimScope})` : `（领域: ${source.claimScope}）`}
              </span>
            ) : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BoundaryNotice({ text, locale = "zh" }: BoundaryNoticeProps) {
  return (
    <section className="rounded-2xl border border-amber-500/5 bg-amber-500/[0.01] p-5 group/geo transition-colors hover:bg-amber-500/[0.03] hover:border-amber-500/10">
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
    <p className="text-xs text-slate-500 mt-6">
      {locale === "es" ? `Actualizado: ${updatedAt}` : locale === "ko" ? `업데이트: ${updatedAt}` : locale === "en" ? `Updated: ${updatedAt}` : `更新时间：${updatedAt}`}
    </p>
  );
}
