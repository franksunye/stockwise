'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, Gauge, ShieldAlert, Waves } from 'lucide-react';

interface TrendLatency {
  date: string;
  avg_ms: number;
  p95_proxy_ms: number;
  samples: number;
}

interface TrendConfidence {
  date: string;
  avg_confidence: number;
  high_ratio: number;
  low_ratio: number;
  samples: number;
}

interface TrendMode {
  date: string;
  total_runs: number;
  success_runs: number;
  failed_runs: number;
  success_rate: number;
}

interface ObservabilityPayload {
  generated_at: string;
  db_strategy: string;
  overall_state: 'ok' | 'warn' | 'critical';
  alerts: Array<{
    metric: string;
    state: 'ok' | 'warn' | 'critical';
    value: number;
    threshold: { warn: number; critical: number };
    definition: string;
    sample_guard?: { min_samples: number; samples: number };
  }>;
  api_latency: {
    avg_ms_24h: number;
    p50_ms_24h: number;
    p95_ms_24h: number;
    samples_24h: number;
    trend_7d: TrendLatency[];
  };
  ai_confidence: {
    avg_7d: number;
    high_ratio_7d: number;
    low_ratio_7d: number;
    samples_7d: number;
    trend_7d: TrendConfidence[];
  };
  mode_pipeline: {
    success_rate_14d: number;
    total_runs_14d: number;
    success_runs_14d: number;
    failed_runs_14d: number;
    last_run_at: string | null;
    trend_14d: TrendMode[];
  };
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function stateBadge(state?: 'ok' | 'warn' | 'critical') {
  if (state === 'critical') return 'text-rose-300 border-rose-500/30 bg-rose-500/10';
  if (state === 'warn') return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
}

export default function ObservabilityPage() {
  const [data, setData] = useState<ObservabilityPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await fetch('/api/admin/observability', { cache: 'no-store' });
        const json = await res.json();
        if (active) setData(json);
      } catch (e) {
        console.error('Failed to fetch observability', e);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    const timer = setInterval(run, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const headline = useMemo(() => {
    if (!data) return null;
    return {
      latency: `${data.api_latency.avg_ms_24h.toFixed(0)} ms`,
      confidence: pct(data.ai_confidence.avg_7d),
      modeSuccess: pct(data.mode_pipeline.success_rate_14d),
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-[#050508] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
              <ArrowLeft className="w-4 h-4 text-slate-300" />
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight">OBSERVABILITY</h1>
              <p className="text-xs text-slate-500">API 延迟 / AI 置信度 / Mode Pipeline 成功率</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded border ${stateBadge(data?.overall_state)}`}>
              {data?.overall_state ? `State: ${data.overall_state.toUpperCase()}` : 'State: --'}
            </span>
            <div className="text-xs text-slate-500">
              {data?.generated_at ? `Updated: ${new Date(data.generated_at).toLocaleString('zh-CN', { hour12: false })}` : '--'}
            </div>
          </div>
        </header>

        {loading && !data ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <section className="grid md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5">
                <div className="flex items-center gap-2 text-indigo-300 text-xs uppercase tracking-widest font-black">
                  <Gauge className="w-4 h-4" />
                  API Latency (24h)
                </div>
                <p className="mt-3 text-3xl font-black">{headline?.latency || '--'}</p>
                <p className="text-xs text-slate-400 mt-2">P50: {data?.api_latency.p50_ms_24h ?? 0}ms | P95: {data?.api_latency.p95_ms_24h ?? 0}ms</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                <div className="flex items-center gap-2 text-emerald-300 text-xs uppercase tracking-widest font-black">
                  <Waves className="w-4 h-4" />
                  AI Confidence (7d)
                </div>
                <p className="mt-3 text-3xl font-black">{headline?.confidence || '--'}</p>
                <p className="text-xs text-slate-400 mt-2">High: {data ? pct(data.ai_confidence.high_ratio_7d) : '--'} | Low: {data ? pct(data.ai_confidence.low_ratio_7d) : '--'}</p>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                <div className="flex items-center gap-2 text-amber-300 text-xs uppercase tracking-widest font-black">
                  <ShieldAlert className="w-4 h-4" />
                  Mode Pipeline (14d)
                </div>
                <p className="mt-3 text-3xl font-black">{headline?.modeSuccess || '--'}</p>
                <p className="text-xs text-slate-400 mt-2">
                  Total: {data?.mode_pipeline.total_runs_14d ?? 0} | Failed: {data?.mode_pipeline.failed_runs_14d ?? 0}
                </p>
              </div>
            </section>

            <section className="grid lg:grid-cols-3 gap-4">
              <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-black mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-400" /> API 延迟趋势（7天）</h2>
                <div className="space-y-2 text-xs">
                  {(data?.api_latency.trend_7d || []).map((row) => (
                    <div key={row.date} className="flex justify-between bg-black/20 border border-white/5 rounded-lg px-3 py-2">
                      <span className="text-slate-400">{row.date}</span>
                      <span className="font-mono text-white">{row.avg_ms.toFixed(0)}ms / {row.p95_proxy_ms.toFixed(0)}ms</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-black mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400" /> 置信度趋势（7天）</h2>
                <div className="space-y-2 text-xs">
                  {(data?.ai_confidence.trend_7d || []).map((row) => (
                    <div key={row.date} className="flex justify-between bg-black/20 border border-white/5 rounded-lg px-3 py-2">
                      <span className="text-slate-400">{row.date}</span>
                      <span className="font-mono text-white">{pct(row.avg_confidence)} (H {pct(row.high_ratio)} / L {pct(row.low_ratio)})</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-black mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-amber-400" /> Mode Pipeline 趋势（14天）</h2>
                <div className="space-y-2 text-xs">
                  {(data?.mode_pipeline.trend_14d || []).map((row) => (
                    <div key={row.date} className="flex justify-between bg-black/20 border border-white/5 rounded-lg px-3 py-2">
                      <span className="text-slate-400">{row.date}</span>
                      <span className="font-mono text-white">{pct(row.success_rate)} ({row.success_runs}/{row.total_runs})</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-sm font-black mb-3">阈值告警与异常定义</h2>
              <div className="space-y-2 text-xs">
                {(data?.alerts || []).map((a) => (
                  <div key={a.metric} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-slate-300">{a.metric}</span>
                      <span className={`px-2 py-0.5 rounded border ${stateBadge(a.state)}`}>{a.state.toUpperCase()}</span>
                    </div>
                    <p className="text-slate-400 mt-1">{a.definition}</p>
                    <p className="text-slate-500 mt-1">value={a.value} | warn={a.threshold.warn} | critical={a.threshold.critical}</p>
                    {a.sample_guard && (
                      <p className="text-slate-500">samples={a.sample_guard.samples} / min={a.sample_guard.min_samples}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
