import type { SourceRef } from "@/lib/geo";

interface GeoSummaryProps {
  summary: string[];
}

interface SourceBlockProps {
  sources: SourceRef[];
}

interface BoundaryNoticeProps {
  text: string;
}

interface FreshnessBlockProps {
  updatedAt?: string;
}

export function GeoSummary({ summary }: GeoSummaryProps) {
  if (!summary.length) return null;

  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 mb-4 group/geo transition-colors hover:bg-white/[0.03] hover:border-white/10">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 mb-3 font-black">TL;DR</p>
      <ul className="list-disc list-inside space-y-2 text-sm text-slate-500 group-hover/geo:text-slate-300 transition-colors leading-relaxed">
        {summary.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function SourceBlock({ sources }: SourceBlockProps) {
  if (!sources.length) return null;

  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 mb-4 group/geo transition-colors hover:bg-white/[0.03] hover:border-white/10">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 mb-3 font-black">来源记录</p>
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
            {source.accessedAt ? <span className="opacity-50 text-[10px]">（访问: {source.accessedAt}）</span> : ""}
            {source.claimScope ? <span className="opacity-50 text-[10px]">（领域: {source.claimScope}）</span> : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BoundaryNotice({ text }: BoundaryNoticeProps) {
  return (
    <section className="rounded-2xl border border-amber-500/5 bg-amber-500/[0.01] p-5 group/geo transition-colors hover:bg-amber-500/[0.03] hover:border-amber-500/10">
      <p className="text-[10px] uppercase tracking-[0.2em] text-amber-900/40 mb-2 font-black group-hover/geo:text-amber-700/60 transition-colors">边界声明</p>
      <p className="text-sm text-amber-900/30 group-hover/geo:text-amber-200/50 transition-colors leading-relaxed">{text}</p>
    </section>
  );
}

export function FreshnessBlock({ updatedAt }: FreshnessBlockProps) {
  if (!updatedAt) return null;

  return (
    <p className="text-xs text-slate-500 mt-6">更新时间：{updatedAt}</p>
  );
}
