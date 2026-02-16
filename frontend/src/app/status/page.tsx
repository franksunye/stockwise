"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { addDays, format, subDays } from 'date-fns';

type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'not_applicable';
type AgentState = 'working' | 'blocked' | 'active' | 'watching' | 'idle';
type HealthState = 'healthy' | 'watch' | 'active' | 'critical';

interface AgentProfile {
  name: string;
  persona: string;
  role: string;
  color: 'blue' | 'purple' | 'green' | 'gray' | 'amber';
}

interface ApiTask {
  name: string;
  display_name: string;
  agent_id: string;
  type: string;
  phase: 'pre_open' | 'intraday' | 'post_close';
  dimensions: Record<string, unknown>;
  expected_start: string | null;
  status: TaskStatus;
  start_time: string | null;
  end_time: string | null;
  message: string | null;
  triggered_by: string | null;
  run_count: number;
  agent: AgentProfile;
}

interface TeamCard {
  agent_id: string;
  agent: AgentProfile;
  state: AgentState;
  story: string;
  completed: number;
  running: number;
  failed: number;
  pending: number;
  next_task: string | null;
  last_event_at: string | null;
}

interface IncidentSummary {
  name: string;
  display_name: string;
  agent_id: string;
  latest_status: TaskStatus;
  failed_runs: number;
  running_runs: number;
  success_runs: number;
  total_runs: number;
  latest_time: string | null;
  latest_message: string | null;
  latest_triggered_by: string | null;
  agent: AgentProfile;
}

interface StatusPayload {
  date: string;
  market_context: {
    hk_closed: boolean;
    cn_closed: boolean;
    all_closed: boolean;
    label: string;
  };
  health: HealthState;
  summary: {
    planned_total: number;
    planned_applicable: number;
    completed: number;
    running: number;
    failed: number;
    pending: number;
  };
  team: TeamCard[];
  phases: Array<{ id: string; title: string; desc: string; tasks: ApiTask[] }>;
  incidents: IncidentSummary[];
  logs_total: number;
}

function getBjtToday(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 8 * 3600000);
}

function formatTime(raw: string | null): string {
  if (!raw) return '--:--';
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (raw.includes(' ')) {
    const time = raw.split(' ')[1];
    return time ? time.slice(0, 5) : '--:--';
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return format(dt, 'HH:mm');
}

function getHealthMeta(health: HealthState) {
  if (health === 'critical') return { label: '需要介入', className: 'text-rose-400 border-rose-500/30 bg-rose-500/10' };
  if (health === 'active') return { label: '高频执行中', className: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10' };
  if (health === 'watch') return { label: '按计划待命', className: 'text-amber-300 border-amber-500/30 bg-amber-500/10' };
  return { label: '运行稳定', className: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' };
}

function getTaskStatusMeta(status: TaskStatus) {
  if (status === 'running') return { label: '执行中', className: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10' };
  if (status === 'success') return { label: '已完成', className: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' };
  if (status === 'failed') return { label: '异常', className: 'text-rose-300 border-rose-500/30 bg-rose-500/10' };
  if (status === 'skipped') return { label: '跳过', className: 'text-slate-400 border-slate-500/30 bg-slate-500/10' };
  if (status === 'not_applicable') return { label: '休市待命', className: 'text-slate-300 border-slate-600/30 bg-slate-600/10' };
  return { label: '待执行', className: 'text-slate-300 border-slate-500/30 bg-slate-500/10' };
}

function getAgentStateMeta(state: AgentState) {
  if (state === 'working') return { label: '值班中', className: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10' };
  if (state === 'blocked') return { label: '处理中', className: 'text-rose-300 border-rose-500/30 bg-rose-500/10' };
  if (state === 'active') return { label: '已交付', className: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' };
  if (state === 'watching') return { label: '窗口待命', className: 'text-amber-300 border-amber-500/30 bg-amber-500/10' };
  return { label: '待命值守', className: 'text-slate-300 border-slate-500/30 bg-slate-500/10' };
}

export default function StatusPage() {
  const todayBjt = useMemo(() => getBjtToday(), []);
  const [date, setDate] = useState<Date>(todayBjt);
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        const dateStr = format(date, 'yyyy-MM-dd');
        const res = await fetch(`/api/status/tasks?date=${dateStr}`, { cache: 'no-store' });
        const result = await res.json();
        if (active) {
          setData(result);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch status', error);
        if (active) setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [date]);

  const dateStr = format(date, 'yyyy-MM-dd');
  const isToday = dateStr === format(todayBjt, 'yyyy-MM-dd');
  const healthMeta = getHealthMeta(data?.health || 'watch');

  return (
    <div className="min-h-screen bg-[#050508] text-white p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">知守委员会值班台</h1>
            <p className="text-slate-500 text-sm mt-1">用团队视角展示今天谁在执行、谁在待命、哪里需要人工关注。</p>
          </div>

          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-1.5">
            <button onClick={() => setDate(subDays(date, 1))} className="px-3 py-1 rounded-lg text-slate-300 hover:bg-white/10 transition">
              ←
            </button>
            <div className="text-sm font-mono w-28 text-center">{dateStr}</div>
            <button
              onClick={() => setDate(addDays(date, 1))}
              disabled={isToday}
              className={`px-3 py-1 rounded-lg transition ${isToday ? 'opacity-40 cursor-not-allowed text-slate-500' : 'text-slate-300 hover:bg-white/10'}`}
            >
              →
            </button>
          </div>
        </header>

        {loading && !data ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={`rounded-xl border px-4 py-3 ${healthMeta.className}`}>
                <p className="text-[10px] uppercase tracking-wider opacity-80">系统健康</p>
                <p className="text-lg font-black mt-1">{healthMeta.label}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-emerald-300/80">已完成</p>
                <p className="text-lg font-black mt-1 text-emerald-200">{data?.summary.completed ?? 0}</p>
              </div>
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-indigo-300/80">执行中</p>
                <p className="text-lg font-black mt-1 text-indigo-200">{data?.summary.running ?? 0}</p>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-rose-300/80">异常事件</p>
                <p className="text-lg font-black mt-1 text-rose-200">{data?.incidents.length ?? 0}</p>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400">市场模式</span>
              <span className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-xs">{data?.market_context.label || '加载中'}</span>
              <span className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-xs">港股: {data?.market_context.hk_closed ? '休市' : '交易'}</span>
              <span className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-xs">A股: {data?.market_context.cn_closed ? '休市' : '交易'}</span>
              <span className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-xs">日志: {data?.logs_total ?? 0}</span>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-black tracking-tight">今日值班团队</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data?.team.map((member) => {
                  const stateMeta = getAgentStateMeta(member.state);
                  return (
                    <article key={member.agent_id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black">{member.agent.name}</p>
                          <p className="text-[11px] text-slate-500">{member.agent.role}</p>
                        </div>
                        <span className={`text-[11px] px-2 py-0.5 rounded border ${stateMeta.className}`}>{stateMeta.label}</span>
                      </div>

                      <p className="text-sm text-slate-300 min-h-[40px]">{member.story}</p>

                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 py-1.5">
                          <p className="text-[10px] text-emerald-300/80">完成</p>
                          <p className="text-sm font-black text-emerald-200">{member.completed}</p>
                        </div>
                        <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 py-1.5">
                          <p className="text-[10px] text-indigo-300/80">进行</p>
                          <p className="text-sm font-black text-indigo-200">{member.running}</p>
                        </div>
                        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 py-1.5">
                          <p className="text-[10px] text-rose-300/80">异常</p>
                          <p className="text-sm font-black text-rose-200">{member.failed}</p>
                        </div>
                        <div className="rounded-lg bg-slate-500/10 border border-slate-500/20 py-1.5">
                          <p className="text-[10px] text-slate-300/80">待命</p>
                          <p className="text-sm font-black text-slate-200">{member.pending}</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-black tracking-tight">今日作战板</h2>
              <div className="grid lg:grid-cols-3 gap-3">
                {data?.phases.map((phase) => (
                  <article key={phase.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                    <div>
                      <h3 className="font-black">{phase.title}</h3>
                      <p className="text-xs text-slate-500">{phase.desc}</p>
                    </div>

                    <div className="space-y-2">
                      {phase.tasks.map((task) => {
                        const statusMeta = getTaskStatusMeta(task.status);
                        return (
                          <div key={task.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold">{task.display_name}</p>
                                <p className="text-[11px] text-slate-500">{task.agent.name}</p>
                              </div>
                              <div className="text-right">
                                <span className={`inline-flex text-[10px] px-2 py-0.5 rounded border ${statusMeta.className}`}>{statusMeta.label}</span>
                                <p className="text-[11px] text-slate-400 mt-1">{formatTime(task.start_time || task.expected_start)}</p>
                              </div>
                            </div>
                            {task.message && <p className="text-xs text-slate-400 mt-2">{task.message}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-black tracking-tight">事件流 (聚合)</h2>
              {data?.incidents.length ? (
                <div className="space-y-2">
                  {data.incidents.map((incident) => {
                    const statusMeta = getTaskStatusMeta(incident.latest_status);
                    return (
                      <article key={`${incident.name}-${incident.agent_id}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">{incident.display_name}</p>
                            <p className="text-xs text-slate-500">{incident.agent.name}</p>
                            {incident.latest_message && <p className="text-sm text-slate-400 mt-2">{incident.latest_message}</p>}
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex text-[10px] px-2 py-0.5 rounded border ${statusMeta.className}`}>{statusMeta.label}</span>
                            <p className="text-xs text-slate-400 mt-1">{formatTime(incident.latest_time)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">失败 {incident.failed_runs}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">成功 {incident.success_runs}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-500/10 border border-slate-500/20 text-slate-300">总计 {incident.total_runs}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">今日暂无异常聚合事件。</div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
