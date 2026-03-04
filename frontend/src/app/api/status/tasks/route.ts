import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'not_applicable';
type PhaseId = 'pre_open' | 'intraday' | 'post_close';

interface AgentProfile {
    name: string;
    persona: string;
    role: string;
    color: 'blue' | 'purple' | 'green' | 'gray' | 'amber';
}

interface PlanTask {
    name: string;
    display_name: string;
    agent_id: string;
    type: string;
    phase: PhaseId;
    dimensions: Record<string, unknown>;
    expected_start: string | null;
}

interface NormalizedLog {
    id: number;
    agent_id: string;
    task_name: string;
    display_name: string;
    task_type: string;
    status: TaskStatus;
    triggered_by: string | null;
    start_time: string | null;
    end_time: string | null;
    updated_at: string | null;
    dimensions: Record<string, unknown>;
    message: string | null;
    metadata: Record<string, unknown> | null;
}

interface ApiTask extends PlanTask {
    status: TaskStatus;
    start_time: string | null;
    end_time: string | null;
    message: string | null;
    metadata: Record<string, unknown> | null;
    triggered_by: string | null;
    run_count: number;
    is_planned: boolean;
    agent: AgentProfile;
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

interface TeamCard {
    agent_id: string;
    agent: AgentProfile;
    state: 'working' | 'blocked' | 'active' | 'watching' | 'idle';
    story: string;
    completed: number;
    running: number;
    failed: number;
    pending: number;
    next_task: string | null;
    last_event_at: string | null;
}

const AGENTS: Record<string, AgentProfile> = {
    market_observer: { name: '林见微（混元 Lite）', persona: 'lin-jianwei-hunyuan-lite', role: '初级量化分析师', color: 'blue' },
    quant_mind: { name: '顾深（DeepSeek）', persona: 'gu-shen-deepseek', role: '资深量化分析师', color: 'purple' },
    news_desk: { name: '诺岚（Nora）', persona: 'nora-context-desk', role: '情报上下文官', color: 'green' },
    system_guardian: { name: '程矩（量化规则）', persona: 'cheng-ju-quant-rules', role: '规则量化分析师', color: 'gray' },
    validation_auditor: { name: '维尔（Verifier）', persona: 'verifier-audit-desk', role: '验证审计官', color: 'amber' },
};

const DAILY_PLAN_TEMPLATE: PlanTask[] = [
    {
        name: 'meta_sync',
        display_name: '股票元数据刷新',
        agent_id: 'market_observer',
        type: 'ingestion',
        phase: 'pre_open',
        dimensions: {},
        expected_start: '06:00',
    },
    {
        name: 'morning_call',
        display_name: '每日早报与策略提醒',
        agent_id: 'news_desk',
        type: 'delivery',
        phase: 'pre_open',
        dimensions: {},
        expected_start: '08:30',
    },
    {
        name: 'market_sentinel',
        display_name: '盘中实时行情监控 (10m)',
        agent_id: 'market_observer',
        type: 'monitoring',
        phase: 'intraday',
        dimensions: { interval: '10分' },
        expected_start: '09:30',
    },
    {
        name: 'ingestion_cn',
        display_name: 'A股行情数据同步',
        agent_id: 'market_observer',
        type: 'ingestion',
        phase: 'post_close',
        dimensions: { market: 'A股' },
        expected_start: '16:00',
    },
    {
        name: 'ingestion_hk',
        display_name: '港股行情数据同步',
        agent_id: 'market_observer',
        type: 'ingestion',
        phase: 'post_close',
        dimensions: { market: '港股' },
        expected_start: '16:30',
    },
    {
        name: 'validation',
        display_name: '预测准确性验证与战报',
        agent_id: 'validation_auditor',
        type: 'maintenance',
        phase: 'post_close',
        dimensions: {},
        expected_start: '16:45',
    },
    {
        name: 'ai_analysis',
        display_name: '次日交易策略制定 (AI)',
        agent_id: 'quant_mind',
        type: 'reasoning',
        phase: 'post_close',
        dimensions: { model: 'DeepSeek' },
        expected_start: '17:00',
    },
    {
        name: 'risk_gate',
        display_name: '规则闸门与风险否决校验',
        agent_id: 'system_guardian',
        type: 'maintenance',
        phase: 'post_close',
        dimensions: { gate: 'rule-quant' },
        expected_start: '17:10',
    },
    {
        name: 'brief_gen',
        display_name: '每日深度复盘与推送',
        agent_id: 'news_desk',
        type: 'delivery',
        phase: 'post_close',
        dimensions: {},
        expected_start: '17:30',
    },
];

const PHASE_META: Record<PhaseId, { title: string; desc: string }> = {
    pre_open: { title: '开盘前准备', desc: '情报预热与数据校准' },
    intraday: { title: '盘中值守', desc: '实时巡检与风险监控' },
    post_close: { title: '收盘后复盘', desc: '验证回写与次日策略生成' },
};

const PHASE_ORDER: PhaseId[] = ['pre_open', 'intraday', 'post_close'];

function getBjtDateStr(): string {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const bjt = new Date(utc + 8 * 3600000);
    return bjt.toISOString().slice(0, 10);
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function normalizeStatus(status: string | null | undefined): TaskStatus {
    if (status === 'running' || status === 'success' || status === 'failed' || status === 'skipped') return status;
    return 'pending';
}

function parseTimeKey(log: Pick<NormalizedLog, 'start_time' | 'end_time' | 'updated_at'>): string {
    return log.end_time || log.start_time || log.updated_at || '';
}

function isWeekend(date: string): boolean {
    const d = new Date(`${date}T00:00:00+08:00`);
    const day = d.getUTCDay();
    return day === 0 || day === 6;
}

function notApplicableReason(task: PlanTask, hkClosed: boolean, cnClosed: boolean): string | null {
    const market = String(task.dimensions.market || '');
    if (market === '港股' && hkClosed) return '港股休市，今日该任务不执行。';
    if (market === 'A股' && cnClosed) return 'A股休市，今日该任务不执行。';
    if (task.name === 'market_sentinel' && hkClosed && cnClosed) return '全市场休市，盘中值守自动转为待命。';
    return null;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || getBjtDateStr();

    try {
        const url = process.env.TURSO_DB_URL;
        const authToken = process.env.TURSO_AUTH_TOKEN;
        if (!url || !authToken) {
            return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
        }

        const client = createClient({ url, authToken });

        const logsRs = await client.execute({
            sql: `
                SELECT id, agent_id, task_name, display_name, task_type, status, triggered_by,
                       start_time, end_time, updated_at, dimensions, message, metadata
                FROM task_logs
                WHERE date = ?
                ORDER BY id DESC
            `,
            args: [date],
        });

        let holidayRows: Array<{ market: string }> = [];
        try {
            const holidayRs = await client.execute({
                sql: 'SELECT market FROM market_holidays WHERE date = ?',
                args: [date],
            });
            holidayRows = holidayRs.rows as unknown as Array<{ market: string }>;
        } catch {
            holidayRows = [];
        }

        const rawLogs = logsRs.rows as Array<Record<string, unknown>>;
        const logs: NormalizedLog[] = rawLogs.map((row) => ({
            id: Number(row.id || 0),
            agent_id: String(row.agent_id || 'system_guardian'),
            task_name: String(row.task_name || 'unknown_task'),
            display_name: String(row.display_name || row.task_name || 'Unknown Task'),
            task_type: String(row.task_type || 'unknown'),
            status: normalizeStatus(String(row.status || 'pending')),
            triggered_by: row.triggered_by ? String(row.triggered_by) : null,
            start_time: row.start_time ? String(row.start_time) : null,
            end_time: row.end_time ? String(row.end_time) : null,
            updated_at: row.updated_at ? String(row.updated_at) : null,
            dimensions: safeJsonParse<Record<string, unknown>>(row.dimensions as string | null, {}),
            message: row.message ? String(row.message) : null,
            metadata: safeJsonParse<Record<string, unknown> | null>(row.metadata as string | null, null),
        }));

        const isWknd = isWeekend(date);
        const holidaySet = new Set(holidayRows.map((r) => String(r.market)));
        const hkClosed = isWknd || holidaySet.has('HK');
        const cnClosed = isWknd || holidaySet.has('CN');
        const allClosed = hkClosed && cnClosed;

        const logsByName = new Map<string, NormalizedLog[]>();
        for (const log of logs) {
            const bucket = logsByName.get(log.task_name) || [];
            bucket.push(log);
            logsByName.set(log.task_name, bucket);
        }

        const planNames = new Set(DAILY_PLAN_TEMPLATE.map((t) => t.name));

        const plannedTasks: ApiTask[] = DAILY_PLAN_TEMPLATE.map((task) => {
            const related = logsByName.get(task.name) || [];
            const latest = related[0];
            const reason = notApplicableReason(task, hkClosed, cnClosed);

            let status: TaskStatus = latest ? latest.status : 'pending';
            let message: string | null = latest?.message || null;
            if (!latest && reason) {
                status = 'not_applicable';
                message = reason;
            }

            return {
                ...task,
                status,
                start_time: latest?.start_time || null,
                end_time: latest?.end_time || null,
                message,
                metadata: latest?.metadata || null,
                triggered_by: latest?.triggered_by || null,
                run_count: related.length,
                is_planned: true,
                agent: AGENTS[task.agent_id] || AGENTS.system_guardian,
            };
        });

        const adhocMap = new Map<string, NormalizedLog[]>();
        for (const log of logs) {
            if (planNames.has(log.task_name)) continue;
            const key = `${log.task_name}::${log.agent_id}`;
            const bucket = adhocMap.get(key) || [];
            bucket.push(log);
            adhocMap.set(key, bucket);
        }

        const incidents: IncidentSummary[] = Array.from(adhocMap.values())
            .map((group) => {
                const latest = group[0];
                const failedRuns = group.filter((g) => g.status === 'failed').length;
                const runningRuns = group.filter((g) => g.status === 'running').length;
                const successRuns = group.filter((g) => g.status === 'success').length;
                return {
                    name: latest.task_name,
                    display_name: latest.display_name || latest.task_name,
                    agent_id: latest.agent_id,
                    latest_status: latest.status,
                    failed_runs: failedRuns,
                    running_runs: runningRuns,
                    success_runs: successRuns,
                    total_runs: group.length,
                    latest_time: parseTimeKey(latest) || null,
                    latest_message: latest.message,
                    latest_triggered_by: latest.triggered_by,
                    agent: AGENTS[latest.agent_id] || AGENTS.system_guardian,
                };
            })
            .sort((a, b) => (b.latest_time || '').localeCompare(a.latest_time || ''));

        const team: TeamCard[] = Object.entries(AGENTS).map(([agentId, agent]) => {
            const planned = plannedTasks.filter((t) => t.agent_id === agentId);
            const agentIncidents = incidents.filter((i) => i.agent_id === agentId);
            const latestLog = logs.find((l) => l.agent_id === agentId);

            const completed = planned.filter((t) => t.status === 'success').length;
            const running = planned.filter((t) => t.status === 'running').length + agentIncidents.reduce((acc, cur) => acc + cur.running_runs, 0);
            const failed = planned.filter((t) => t.status === 'failed').length + agentIncidents.reduce((acc, cur) => acc + cur.failed_runs, 0);
            const pending = planned.filter((t) => t.status === 'pending').length;

            const nextTask = planned
                .filter((t) => t.status === 'pending' && t.expected_start)
                .sort((a, b) => String(a.expected_start).localeCompare(String(b.expected_start)))[0];

            let state: TeamCard['state'] = 'idle';
            let story = '当前处于待命值守状态。';
            if (running > 0) {
                state = 'working';
                const activeTask = planned.find((t) => t.status === 'running') || nextTask;
                story = activeTask ? `${activeTask.display_name} 正在推进中。` : '当前有任务正在执行。';
            } else if (failed > 0) {
                state = 'blocked';
                story = `发现 ${failed} 个异常事件，正在排查。`;
            } else if (completed > 0) {
                state = 'active';
                story = `今日已完成 ${completed} 项核心任务。`;
            } else if (pending > 0) {
                state = 'watching';
                story = nextTask ? `下一项任务：${nextTask.display_name} (${nextTask.expected_start})。` : '等待任务窗口开启。';
            }

            return {
                agent_id: agentId,
                agent,
                state,
                story,
                completed,
                running,
                failed,
                pending,
                next_task: nextTask ? nextTask.display_name : null,
                last_event_at: latestLog ? parseTimeKey(latestLog) || null : null,
            };
        });

        const phases = PHASE_ORDER.map((phaseId) => ({
            id: phaseId,
            title: PHASE_META[phaseId].title,
            desc: PHASE_META[phaseId].desc,
            tasks: plannedTasks
                .filter((t) => t.phase === phaseId)
                .sort((a, b) => String(a.expected_start || '').localeCompare(String(b.expected_start || ''))),
        }));

        const applicablePlanned = plannedTasks.filter((t) => t.status !== 'not_applicable');
        const summary = {
            planned_total: plannedTasks.length,
            planned_applicable: applicablePlanned.length,
            completed: applicablePlanned.filter((t) => t.status === 'success').length,
            running: applicablePlanned.filter((t) => t.status === 'running').length,
            failed: applicablePlanned.filter((t) => t.status === 'failed').length,
            pending: applicablePlanned.filter((t) => t.status === 'pending').length,
        };

        const health: 'healthy' | 'watch' | 'active' | 'critical' =
            summary.failed > 0 ? 'critical' : summary.running > 0 ? 'active' : summary.pending > 0 ? 'watch' : 'healthy';

        return NextResponse.json({
            date,
            market_context: {
                hk_closed: hkClosed,
                cn_closed: cnClosed,
                all_closed: allClosed,
                label: allClosed ? '全市场休市值守模式' : hkClosed || cnClosed ? '部分市场休市模式' : '标准交易日模式',
            },
            health,
            summary,
            team,
            phases,
            incidents,
            logs_total: logs.length,
            tasks: plannedTasks, // legacy compatibility
        });
    } catch (error) {
        console.error('Status API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
    }
}
