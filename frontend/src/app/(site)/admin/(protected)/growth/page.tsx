'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Globe2, Languages, RefreshCw, Search, Users } from 'lucide-react';

type LanguageSegment = {
  language: string;
  raw_locale: string;
  new_user_rows: number;
  activated_users: number;
  activation_rate: number;
  paid_rows: number;
  with_watchlist: number;
};

type GrowthPayload = {
  internal?: {
    language_segments?: Record<string, LanguageSegment[]>;
    channel_quality?: Array<{ channel: string; user_rows: number; onboarded: number; access_granted: number; stripe_linked: number }>;
    referral_conversion?: Record<string, {
      invited_user_rows: number;
      invited_onboarded: number;
      invite_onboarding_rate: number;
      invited_access_granted: number;
      invited_with_watchlist: number;
    }>;
    referral_language_segments?: Array<{
      language: string;
      raw_locale: string;
      invited_user_rows: number;
      invited_onboarded: number;
      invite_onboarding_rate: number;
      invited_access_granted: number;
    }>;
    referral_by_referrer?: Array<{
      referrer_user_id: string;
      referrer_label: string;
      referrer_language: string;
      invited_user_rows: number;
      invited_onboarded: number;
      invite_onboarding_rate: number;
      invited_access_granted: number;
      invited_with_watchlist: number;
    }>;
    referral_trend?: Array<{
      day: string;
      invited_user_rows: number;
      invited_onboarded: number;
      invite_onboarding_rate: number;
    }>;
  };
  ga4?: {
    top_sources?: Array<{ source_medium: string; sessions: number; users: number }>;
    top_pages?: Array<{ path: string; sessions: number; users: number }>;
    language_mix?: Array<{ language: string; raw_language: string; sessions: number; users: number }>;
  } | null;
  errors?: Record<string, string>;
};

type Snapshot = {
  snapshot_date: string;
  generated_at: string | null;
  status: string;
  sessions_24h: number;
  active_users_24h: number;
  page_views_24h: number;
  new_user_rows_24h: number;
  activated_users_24h: number;
  activation_rate_24h: number;
  paid_rows_24h: number;
  active_watchers_24h: number;
  total_users: number;
  access_granted_users: number;
  active_paid_users: number;
  stripe_linked_users: number;
  payload: GrowthPayload;
  errors: Record<string, string>;
};

type GrowthResponse = {
  generated_at: string;
  db_strategy: string;
  latest: Snapshot | null;
  trend: Array<{
    date: string;
    sessions: number;
    active_users: number;
    new_user_rows: number;
    activated_users: number;
    activation_rate: number;
    active_watchers: number;
  }>;
  snapshots: Snapshot[];
};

type SeoSearchApiResponse = {
  generated_at: string;
  db_strategy: string;
  normalized_path: string;
  days: number;
  sources: string[];
  scopes_for_path: string[];
  page_daily: Array<{
    report_date: string;
    source: string;
    site_scope: string;
    impressions: number;
    clicks: number;
    ctr: number | null;
    position: number | null;
  }>;
  query_rows: Array<{
    report_date: string;
    source: string;
    site_scope: string;
    search_query: string;
    impressions: number;
    clicks: number;
    ctr: number | null;
    position: number | null;
  }>;
};

type TrendPoint = GrowthResponse['trend'][number];

function fmt(value: number | null | undefined): string {
  return Number(value || 0).toLocaleString('zh-CN');
}

function pct(value: number | null | undefined): string {
  return `${Number(value || 0).toFixed(1)}%`;
}

function labelLanguage(value: string): string {
  if (value === 'zh') return '中文';
  if (value === 'en') return '英文';
  if (value === 'ko') return '韩文';
  if (value === 'es') return '西语';
  if (value === 'unknown') return '未知';
  return value.toUpperCase();
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '--';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-t border-white/10 py-4">
      <p className="text-[11px] text-slate-500 font-bold tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function BarRow({ label, value, max, aside }: { label: string; value: number; max: number; aside?: string }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[88px_1fr_70px] items-center gap-3 text-xs">
      <span className="truncate text-slate-300">{label}</span>
      <div className="h-2 rounded bg-white/5">
        <div className="h-2 rounded bg-cyan-400/80" style={{ width: `${width}%` }} />
      </div>
      <span className="text-right text-slate-500">{aside || fmt(value)}</span>
    </div>
  );
}

function SeoSearchPanel() {
  const [pathInput, setPathInput] = useState('/tools/position-budget');
  const [daysInput, setDaysInput] = useState('56');
  const [loading, setLoading] = useState(false);
  const [seo, setSeo] = useState<SeoSearchApiResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadSeo = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const days = Math.min(Math.max(Number(daysInput) || 56, 1), 400);
      const q = new URLSearchParams({
        path: pathInput.trim() || '/',
        days: String(days),
        query_limit: '120',
        sources: 'gsc,bing',
      });
      const res = await fetch(`/api/admin/seo-search?${q.toString()}`, { cache: 'no-store' });
      const json = await res.json() as SeoSearchApiResponse & { error?: string };
      if (!res.ok) {
        setSeo(null);
        setFetchError(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`);
        return;
      }
      setFetchError(null);
      setSeo(json);
    } catch (error) {
      console.error('Failed to load SEO search performance', error);
      setSeo(null);
      setFetchError('请求失败');
    } finally {
      setLoading(false);
    }
  };

  const pageTail = seo?.page_daily?.length
    ? [...seo.page_daily].slice(-14)
    : [];
  const topQueries = seo?.query_rows?.slice(0, 24) ?? [];

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-amber-300" />
            <h2 className="text-sm font-semibold">搜索表现（GSC / Bing）</h2>
          </div>
          <p className="text-xs text-slate-500 max-w-xl">
            读取表 <span className="font-mono text-slate-400">seo_search_performance</span>
            ：按 canonical path 的近窗口展示；数据由离线任务 POST 入库（与 GA4 growth 快照分列）。
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-slate-500">
            path
            <input
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              className="h-9 min-w-[220px] rounded border border-white/10 bg-black/30 px-2 font-mono text-xs text-slate-200"
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-500">
            days
            <input
              value={daysInput}
              onChange={(e) => setDaysInput(e.target.value)}
              className="h-9 w-16 rounded border border-white/10 bg-black/30 px-2 font-mono text-xs text-slate-200"
              inputMode="numeric"
            />
          </label>
          <button
            type="button"
            onClick={loadSeo}
            disabled={loading}
            className="h-9 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition disabled:opacity-50"
          >
            {loading ? '加载中…' : '加载'}
          </button>
        </div>
      </div>

      {fetchError ? (
        <p className="mt-4 text-sm text-rose-300">{fetchError}</p>
      ) : null}

      {seo ? (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span>
              归一：<span className="font-mono text-slate-300">{seo.normalized_path}</span>
            </span>
            <span>
              scopes：
              {seo.scopes_for_path?.length
                ? seo.scopes_for_path.map((s) => (
                  <span key={s} className="ml-1 font-mono text-slate-400">{s}</span>
                ))
                : '暂无'}
            </span>
            <span>strategy：{seo.db_strategy}</span>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-slate-400">页面级日序（至多最近 14 条记录）</h3>
            <div className="overflow-x-auto rounded border border-white/5">
              <table className="w-full min-w-[640px] text-left text-[11px]">
                <thead className="bg-white/[0.03] text-slate-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">date</th>
                    <th className="px-2 py-2 font-medium">src</th>
                    <th className="px-2 py-2 font-medium">scope</th>
                    <th className="px-2 py-2 font-medium text-right">impr.</th>
                    <th className="px-2 py-2 font-medium text-right">clk</th>
                    <th className="px-2 py-2 font-medium text-right">CTR</th>
                    <th className="px-2 py-2 font-medium text-right">pos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pageTail.length ? pageTail.map((row, idx) => (
                    <tr key={`${row.report_date}-${row.source}-${row.site_scope}-${idx}`} className="text-slate-300">
                      <td className="px-2 py-1.5 font-mono">{row.report_date.slice(5)}</td>
                      <td className="px-2 py-1.5">{row.source}</td>
                      <td className="px-2 py-1.5 font-mono text-slate-500 truncate max-w-[120px]" title={row.site_scope}>{row.site_scope}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(row.impressions)}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(row.clicks)}</td>
                      <td className="px-2 py-1.5 text-right">{row.ctr === null ? '—' : pct(row.ctr * 100)}</td>
                      <td className="px-2 py-1.5 text-right">{row.position === null ? '—' : row.position.toFixed(1)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="px-2 py-4 text-center text-slate-500">
                        暂无页面级序列。确认离线任务已向该 path 写入 <span className="font-mono">granularity=&apos;page&apos;</span> 行。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-slate-400">Top queries（按 impressions）</h3>
            <div className="divide-y divide-white/5">
              {topQueries.length ? topQueries.map((row) => (
                <div key={`${row.report_date}-${row.source}-${row.search_query}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-xs">
                  <span className="font-mono text-slate-200 break-all">{row.search_query}</span>
                  <span className="shrink-0 text-slate-500">
                    {fmt(row.impressions)} impr · pos {row.position === null ? '—' : row.position.toFixed(1)}
                  </span>
                </div>
              )) : (
                <p className="text-sm text-slate-500 py-2">暂无查询明细。需在入库时写入 <span className="font-mono">granularity=&apos;query&apos;</span> 行。</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!seo && !fetchError && !loading ? (
        <p className="mt-4 text-sm text-slate-500">点击「加载」从数据库拉取该路径的搜索表现。</p>
      ) : null}
    </section>
  );
}

function TrendChart({ rows }: { rows: TrendPoint[] }) {
  const width = 920;
  const height = 220;
  const padding = { top: 18, right: 22, bottom: 34, left: 38 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...rows.map((row) => Math.max(row.sessions, row.new_user_rows)), 1);
  const latest = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  const visitDelta = latest && previous ? latest.sessions - previous.sessions : 0;
  const userDelta = latest && previous ? latest.new_user_rows - previous.new_user_rows : 0;
  const xFor = (index: number) => padding.left + (rows.length <= 1 ? chartWidth / 2 : (index / (rows.length - 1)) * chartWidth);
  const yFor = (value: number) => padding.top + chartHeight - (value / maxValue) * chartHeight;
  const lineFor = (selector: (row: TrendPoint) => number) => rows
    .map((row, index) => `${xFor(index).toFixed(1)},${yFor(selector(row)).toFixed(1)}`)
    .join(' ');
  const areaFor = (selector: (row: TrendPoint) => number) => {
    if (!rows.length) return '';
    const firstX = xFor(0).toFixed(1);
    const lastX = xFor(rows.length - 1).toFixed(1);
    const bottomY = (padding.top + chartHeight).toFixed(1);
    return `${firstX},${bottomY} ${lineFor(selector)} ${lastX},${bottomY}`;
  };
  const tickIndexes = rows
    .map((_, index) => index)
    .filter((index) => index === 0 || index === rows.length - 1 || index % 7 === 0);
  const yTicks = Array.from(new Set([0, 0.5, 1].map((ratio) => Math.round(maxValue * ratio))));

  if (!rows.length) {
    return <p className="text-sm text-slate-500">暂无 30 天趋势数据。</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border-l border-cyan-300/50 pl-3">
          <p className="text-xs text-slate-500">最新访问</p>
          <p className="mt-1 text-2xl font-semibold">{fmt(latest?.sessions)}</p>
          <p className={`mt-1 text-xs ${visitDelta >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
            较前日 {visitDelta >= 0 ? '+' : ''}{fmt(visitDelta)}
          </p>
        </div>
        <div className="border-l border-violet-300/50 pl-3">
          <p className="text-xs text-slate-500">最新新用户</p>
          <p className="mt-1 text-2xl font-semibold">{fmt(latest?.new_user_rows)}</p>
          <p className={`mt-1 text-xs ${userDelta >= 0 ? 'text-violet-300' : 'text-rose-300'}`}>
            较前日 {userDelta >= 0 ? '+' : ''}{fmt(userDelta)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="30 天 visits 和 new users 趋势图" className="h-[240px] w-full">
          <defs>
            <linearGradient id="visitsFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />
                <text x={padding.left - 10} y={y + 4} textAnchor="end" className="fill-slate-600 text-[11px]">{tick}</text>
              </g>
            );
          })}
          <polygon points={areaFor((row) => row.sessions)} fill="url(#visitsFill)" />
          <polyline points={lineFor((row) => row.sessions)} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={lineFor((row) => row.new_user_rows)} fill="none" stroke="#c084fc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {rows.map((row, index) => (
            <g key={row.date}>
              <circle cx={xFor(index)} cy={yFor(row.sessions)} r="3.5" fill="#22d3ee" />
              <circle cx={xFor(index)} cy={yFor(row.new_user_rows)} r="3.5" fill="#c084fc" />
            </g>
          ))}
          {tickIndexes.map((index) => (
            <text key={rows[index].date} x={xFor(index)} y={height - 10} textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'} className="fill-slate-600 text-[11px]">
              {rows[index].date.slice(5)}
            </text>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-cyan-400" /> visits</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-violet-400" /> new users</span>
        <span>范围：{rows[0]?.date} 至 {latest?.date}</span>
      </div>

      <div className="grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-5">
        {rows.slice(-5).map((row) => (
          <div key={row.date} className="text-xs">
            <p className="text-slate-500">{row.date.slice(5)}</p>
            <p className="mt-1 text-slate-300">{fmt(row.sessions)} visits</p>
            <p className="text-slate-500">{fmt(row.new_user_rows)} users</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GrowthPage() {
  const [data, setData] = useState<GrowthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/growth?range=30', { cache: 'no-store' });
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to load growth data', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const latest = data?.latest ?? null;
  const languageSegments = latest?.payload?.internal?.language_segments?.last_30d ?? [];
  const sourceRows = latest?.payload?.ga4?.top_sources ?? [];
  const pageRows = latest?.payload?.ga4?.top_pages ?? [];
  const externalLanguages = latest?.payload?.ga4?.language_mix ?? [];
  const referral30d = latest?.payload?.internal?.referral_conversion?.last_30d;
  const referral7d = latest?.payload?.internal?.referral_conversion?.last_7d;
  const referralLanguages = latest?.payload?.internal?.referral_language_segments ?? [];
  const referralByReferrer = latest?.payload?.internal?.referral_by_referrer ?? [];
  const referralTrend = latest?.payload?.internal?.referral_trend ?? [];
  const maxLang = Math.max(...languageSegments.map((row) => row.new_user_rows), 0);
  const maxSource = Math.max(...sourceRows.map((row) => row.sessions), 0);
  const maxReferralLang = Math.max(...referralLanguages.map((row) => row.invited_user_rows), 0);
  const trendRows = data?.trend || [];

  const statusText = useMemo(() => {
    if (!latest) return '暂无快照';
    const errors = latest.errors || latest.payload?.errors || {};
    return Object.keys(errors).length ? '部分数据缺失' : '正常';
  }, [latest]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-300 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between border-b border-white/10 pb-6">
          <div>
            <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-xs text-slate-500 hover:text-cyan-300 transition">
              <ArrowLeft className="w-4 h-4" />
              返回管理中心
            </Link>
            <div className="flex items-center gap-2 text-cyan-300">
              <BarChart3 className="w-5 h-5" />
              <span className="text-[11px] font-black tracking-[0.24em] uppercase">Growth</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">增长看板</h1>
            <p className="mt-2 text-sm text-slate-500">每日快照，按语言拆分用户增长和外部流量结构。</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-slate-500">
              <p>状态：<span className="text-slate-300">{statusText}</span></p>
              <p>更新：{formatTime(latest?.generated_at)}</p>
            </div>
            <button
              onClick={load}
              disabled={refreshing}
              className="h-10 w-10 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center hover:bg-white/[0.06] transition"
              aria-label="刷新"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {!latest ? (
          <section className="rounded-lg border border-white/10 bg-white/[0.02] p-8">
            <p className="text-sm text-slate-400">还没有增长快照。先运行 daily growth snapshot job 后，这里会显示数据。</p>
          </section>
        ) : (
          <>
            <section className="grid md:grid-cols-4 gap-6">
              <Metric label="24h 访问会话" value={fmt(latest.sessions_24h)} sub={`${fmt(latest.active_users_24h)} active users`} />
              <Metric label="24h 新用户行" value={fmt(latest.new_user_rows_24h)} sub={`${fmt(latest.activated_users_24h)} activated`} />
              <Metric label="24h 激活率" value={pct(latest.activation_rate_24h)} sub={`${fmt(latest.active_watchers_24h)} active watchers`} />
              <Metric label="总授权用户" value={fmt(latest.access_granted_users)} sub={`${fmt(latest.active_paid_users)} active paid`} />
            </section>

            <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Languages className="w-4 h-4 text-cyan-300" />
                  <h2 className="text-sm font-semibold">内部用户语言（30 天）</h2>
                </div>
                <div className="space-y-3">
                  {languageSegments.length ? languageSegments.map((row) => (
                    <BarRow
                      key={`${row.language}-${row.raw_locale}`}
                      label={labelLanguage(row.language)}
                      value={row.new_user_rows}
                      max={maxLang}
                      aside={`${fmt(row.activated_users)} / ${pct(row.activation_rate)}`}
                    />
                  )) : <p className="text-sm text-slate-500">暂无内部语言分组。</p>}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs text-slate-500">
                  <span>语言</span>
                  <span className="text-right">新用户</span>
                  <span className="text-right">激活 / 激活率</span>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Globe2 className="w-4 h-4 text-cyan-300" />
                  <h2 className="text-sm font-semibold">外部流量语言（GA4 30 天）</h2>
                </div>
                <div className="space-y-3">
                  {externalLanguages.length ? externalLanguages.slice(0, 6).map((row) => (
                    <div key={`${row.raw_language}-${row.sessions}`} className="flex items-center justify-between border-b border-white/5 pb-2 text-sm">
                      <span className="text-slate-300">{labelLanguage(row.language)}</span>
                      <span className="text-slate-500">{fmt(row.sessions)} sessions</span>
                    </div>
                  )) : <p className="text-sm text-slate-500">GA4 语言数据暂不可用。</p>}
                </div>
              </div>
            </section>

            <section className="grid lg:grid-cols-3 gap-8">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Users className="w-4 h-4 text-cyan-300" />
                  <h2 className="text-sm font-semibold">邀请转化</h2>
                </div>
                {referral30d ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">30 天邀请进入</p>
                        <p className="mt-1 text-2xl font-semibold">{fmt(referral30d.invited_user_rows)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">完成 onboarding</p>
                        <p className="mt-1 text-2xl font-semibold">{fmt(referral30d.invited_onboarded)}</p>
                      </div>
                    </div>
                    <div className="border-t border-white/10 pt-4">
                      <p className="text-xs text-slate-500">30 天邀请 onboarding 转化率</p>
                      <p className="mt-1 text-3xl font-semibold text-cyan-200">{pct(referral30d.invite_onboarding_rate)}</p>
                      <p className="mt-2 text-xs text-slate-600">
                        7 天：{fmt(referral7d?.invited_user_rows)} invited / {fmt(referral7d?.invited_onboarded)} onboarded
                      </p>
                    </div>
                    <div className="text-xs text-slate-500">
                      已授权 {fmt(referral30d.invited_access_granted)} · 已加自选 {fmt(referral30d.invited_with_watchlist)}
                    </div>
                  </div>
                ) : <p className="text-sm text-slate-500">暂无邀请转化数据。</p>}
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
                <h2 className="mb-5 text-sm font-semibold">邀请用户语言（30 天）</h2>
                <div className="space-y-3">
                  {referralLanguages.length ? referralLanguages.map((row) => (
                    <BarRow
                      key={`${row.language}-${row.raw_locale}`}
                      label={labelLanguage(row.language)}
                      value={row.invited_user_rows}
                      max={maxReferralLang}
                      aside={`${fmt(row.invited_onboarded)} / ${pct(row.invite_onboarding_rate)}`}
                    />
                  )) : <p className="text-sm text-slate-500">暂无邀请语言分组。</p>}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
                <h2 className="mb-5 text-sm font-semibold">邀请来源（30 天）</h2>
                <div className="space-y-3">
                  {referralByReferrer.length ? referralByReferrer.slice(0, 8).map((row) => (
                    <div key={row.referrer_user_id} className="border-b border-white/5 pb-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-mono text-slate-200">{row.referrer_label}</span>
                        <span className="shrink-0 text-slate-500">{fmt(row.invited_onboarded)} / {fmt(row.invited_user_rows)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {labelLanguage(row.referrer_language)} · 转化 {pct(row.invite_onboarding_rate)}
                      </p>
                    </div>
                  )) : <p className="text-sm text-slate-500">暂无邀请来源数据。</p>}
                </div>
              </div>
            </section>

            <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
                <h2 className="mb-5 text-sm font-semibold">邀请 7 天趋势</h2>
                <div className="space-y-3">
                  {referralTrend.length ? referralTrend.map((row) => (
                    <div key={row.day} className="grid grid-cols-[88px_1fr_92px] items-center gap-3 text-xs">
                      <span className="text-slate-500">{row.day.slice(5)}</span>
                      <div className="h-2 rounded bg-white/5">
                        <div className="h-2 rounded bg-cyan-400/80" style={{ width: `${referral30d?.invited_user_rows ? Math.max(4, (row.invited_user_rows / referral30d.invited_user_rows) * 100) : 0}%` }} />
                      </div>
                      <span className="text-right text-slate-400">{fmt(row.invited_onboarded)} / {fmt(row.invited_user_rows)}</span>
                    </div>
                  )) : <p className="text-sm text-slate-500">暂无 7 天邀请趋势。</p>}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
                <h2 className="mb-5 text-sm font-semibold">Top Sources（GA4 7 天）</h2>
                <div className="space-y-3">
                  {sourceRows.length ? sourceRows.slice(0, 6).map((row) => (
                    <BarRow key={row.source_medium} label={row.source_medium} value={row.sessions} max={maxSource} />
                  )) : <p className="text-sm text-slate-500">GA4 来源数据暂不可用。</p>}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
              <h2 className="mb-5 text-sm font-semibold">30 天趋势</h2>
              <TrendChart rows={trendRows} />
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
              <h2 className="mb-4 text-sm font-semibold">Top Pages（GA4 7 天）</h2>
              <div className="divide-y divide-white/5">
                {pageRows.length ? pageRows.slice(0, 8).map((row) => (
                  <div key={row.path} className="grid grid-cols-[1fr_120px_120px] gap-4 py-2 text-sm">
                    <span className="truncate font-mono text-slate-300">{row.path}</span>
                    <span className="text-right text-slate-500">{fmt(row.sessions)} sessions</span>
                    <span className="text-right text-slate-500">{fmt(row.users)} users</span>
                  </div>
                )) : <p className="text-sm text-slate-500">GA4 页面数据暂不可用。</p>}
              </div>
            </section>
          </>
        )}

        <SeoSearchPanel />
      </div>
    </div>
  );
}
