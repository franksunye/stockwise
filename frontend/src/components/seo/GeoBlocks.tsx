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
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-8">
      <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">TL;DR</p>
      <ul className="list-disc list-inside space-y-1 text-sm text-slate-300">
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
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mt-8">
      <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">来源</p>
      <ul className="space-y-1 text-sm text-slate-300">
        {sources.map((source) => (
          <li key={`${source.name}-${source.url || "local"}`}>
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                {source.name}
              </a>
            ) : (
              source.name
            )}
            {source.accessedAt ? `（访问时间: ${source.accessedAt}）` : ""}
            {source.claimScope ? `（主张范围: ${source.claimScope}）` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BoundaryNotice({ text }: BoundaryNoticeProps) {
  return (
    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 mt-8">
      <p className="text-xs uppercase tracking-wider text-amber-200 mb-1">边界声明</p>
      <p className="text-sm text-amber-100/90">{text}</p>
    </section>
  );
}

export function FreshnessBlock({ updatedAt }: FreshnessBlockProps) {
  if (!updatedAt) return null;

  return (
    <p className="text-xs text-slate-500 mt-6">更新时间：{updatedAt}</p>
  );
}
