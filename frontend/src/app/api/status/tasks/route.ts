import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

// Reusing the Backend's plan definition logic
const DAILY_PLAN_TEMPLATE = [
    {
        name: "meta_sync",
        display_name: "Metadata Refresh",
        agent_id: "market_observer",
        type: "ingestion",
        dimensions: {},
        expected_start: "06:00"
    },
    {
        name: "morning_call",
        display_name: "Daily Morning Call",
        agent_id: "news_desk",
        type: "delivery",
        dimensions: {},
        expected_start: "08:30"
    },
    {
        name: "market_sentinel",
        display_name: "Real-time Market Watch",
        agent_id: "market_observer",
        type: "monitoring",
        dimensions: { interval: "10m" },
        expected_start: "09:30"
    },
    {
        name: "ingestion_cn",
        display_name: "A-Share Data Sync",
        agent_id: "market_observer",
        type: "ingestion",
        dimensions: { market: "CN" },
        expected_start: "16:00"
    },
    {
        name: "validation",
        display_name: "Accuracy Validation & Glory",
        agent_id: "system_guardian",
        type: "maintenance",
        dimensions: {},
        expected_start: "16:15"
    },
    {
        name: "ingestion_hk",
        display_name: "HK Stock Data Sync",
        agent_id: "market_observer",
        type: "ingestion",
        dimensions: { market: "HK" },
        expected_start: "16:30"
    },
    {
        name: "ai_analysis",
        display_name: "Next-Day Strategy Formulation",
        agent_id: "quant_mind",
        type: "reasoning",
        dimensions: { model: "mixed" },
        expected_start: "16:45"
    },
    {
        name: "brief_gen",
        display_name: "Daily Briefing & Push",
        agent_id: "news_desk",
        type: "delivery",
        dimensions: {},
        expected_start: "17:30"
    }
];

const AGENTS = {
    "market_observer": { name: "Market Observer", persona: "Marcus", avatar: "/avatars/marcus.png", color: "blue" },
    "quant_mind": { name: "Quant Mind", persona: "Quinn", avatar: "/avatars/quinn.png", color: "purple" },
    "news_desk": { name: "News Desk", persona: "Nora", avatar: "/avatars/nora.png", color: "green" },
    "system_guardian": { name: "System Guardian", persona: "Sylar", avatar: "/avatars/sylar.png", color: "gray" }
};

// Output Interface matching frontend Task
interface ApiTask {
    name: string;
    display_name: string;
    agent_id: string;
    type: string;
    dimensions: Record<string, unknown>;
    expected_start: string | null;
    status: string;
    start_time: string | null;
    end_time: string | null;
    message: string | null;
    metadata: Record<string, unknown> | null;
    triggered_by: string | null;
    is_planned: boolean;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    try {
        const url = process.env.TURSO_DB_URL;
        const authToken = process.env.TURSO_AUTH_TOKEN;

        if (!url || !authToken) {
            console.error("Missing Turso Credentials");
            return NextResponse.json({ error: "Database configuration missing" }, { status: 500 });
        }

        const client = createClient({
            url: url,
            authToken: authToken,
        });

        // Query Logs
        const rs = await client.execute({
            sql: "SELECT * FROM task_logs WHERE date = ? ORDER BY start_time ASC",
            args: [date]
        });

        // Map generic rows to our known structure
        // LibSQL client usually returns rows as objects matching column names
        const logs = rs.rows.map(row => ({
            id: row.id,
            agent_id: row.agent_id as string,
            task_name: row.task_name as string,
            display_name: row.display_name as string,
            task_type: row.task_type as string,
            date: row.date as string,
            status: row.status as string,
            triggered_by: row.triggered_by as string,
            start_time: row.start_time as string | null,
            end_time: row.end_time as string | null,
            dimensions: row.dimensions as string,
            message: row.message as string | null,
            metadata: row.metadata as string | null
        }));

        // Merge Plan + Actual

        // 0. Determine if it's a trading day (Simple Weekend Check)
        // Note: Ideally we'd check holidays too, but this covers 90% of cases.
        // We treat the input 'date' (YYYY-MM-DD) as local date to check day of week.
        const targetDate = new Date(date);
        const dayOfWeek = targetDate.getUTCDay(); // 0=Sun, 6=Sat (Using UTC to avoid TZ shifts on pure date strings)
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const effectivePlan = isWeekend ? [] : DAILY_PLAN_TEMPLATE;

        // 1. Start with Plan
        const result: ApiTask[] = effectivePlan.map(planItem => {
            const logEntry = logs.find((l) => l.task_name === planItem.name);

            return {
                ...planItem,
                status: logEntry ? logEntry.status : 'pending',
                start_time: logEntry ? logEntry.start_time : null,
                end_time: logEntry ? logEntry.end_time : null,
                message: logEntry ? logEntry.message : null,
                metadata: logEntry && logEntry.metadata ? JSON.parse(logEntry.metadata) : null,
                triggered_by: logEntry ? logEntry.triggered_by : null,
                is_planned: true
            };
        });

        // 2. Add Ad-hoc tasks
        logs.forEach((log) => {
            const inPlan = DAILY_PLAN_TEMPLATE.find(p => p.name === log.task_name);
            if (!inPlan) {
                result.push({
                    name: log.task_name,
                    display_name: log.display_name || log.task_name,
                    agent_id: log.agent_id,
                    type: log.task_type || 'unknown',
                    dimensions: log.dimensions ? JSON.parse(log.dimensions) : {},
                    expected_start: null,
                    status: log.status,
                    start_time: log.start_time,
                    end_time: log.end_time,
                    message: log.message,
                    metadata: log.metadata ? JSON.parse(log.metadata) : null,
                    triggered_by: log.triggered_by,
                    is_planned: false
                });
            }
        });

        // 3. Attach Agent Info to everything
        const finalResponse = result.map(task => ({
            ...task,
            agent: AGENTS[task.agent_id as keyof typeof AGENTS] || AGENTS["system_guardian"]
        }));

        // Sort: Earliest Start Time first, then Expected Start Time
        finalResponse.sort((a, b) => {
            const timeA = a.start_time || a.expected_start;
            const timeB = b.start_time || b.expected_start;
            if (!timeA) return 1;
            if (!timeB) return -1;
            if (timeA === null && timeB === null) return 0;
            if (timeA === null) return 1;
            if (timeB === null) return -1;
            return timeA.localeCompare(timeB);
        });

        return NextResponse.json({ date, tasks: finalResponse });

    } catch (error) {
        console.error("Database Error:", error);
        return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
    }
}
