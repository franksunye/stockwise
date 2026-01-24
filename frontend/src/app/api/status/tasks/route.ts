import { NextResponse } from 'next/server';
import path from 'path';
import Database from 'better-sqlite3';

// Reusing the Backend's plan definition logic (Re-implemented in TS or fetched?
// For simpler syncing, we can define the plan structure here too, 
// OR simpler: query DB for logs, and if no log exists for a "Known Plan Item", return it as pending.

// Let's define the static plan here to match `task_registry.py`
// In a real microservice we'd fetch this from the backend, but shared config is fine for now.
const DAILY_PLAN_TEMPLATE = [
    {
        name: "ingestion_cn",
        display_name: "A-Share Data Sync",
        agent_id: "market_observer",
        type: "ingestion",
        dimensions: { market: "CN" },
        expected_start: "16:00"
    },
    {
        name: "ingestion_hk",
        display_name: "HK Stock Data Sync",
        agent_id: "market_observer",
        type: "ingestion",
        dimensions: { market: "HK" },
        expected_start: "16:15"
    },
    {
        name: "meta_sync",
        display_name: "Metadata Refresh",
        agent_id: "market_observer",
        type: "ingestion",
        dimensions: {},
        expected_start: "16:30"
    },
    {
        name: "ai_analysis_pro",
        display_name: "DeepSeek Analysis (PRO)",
        agent_id: "quant_mind",
        type: "reasoning",
        dimensions: { tier: "PRO", model: "mixed" },
        expected_start: "17:00"
    },
    {
        name: "ai_analysis_free",
        display_name: "Standard Analysis (Free)",
        agent_id: "quant_mind",
        type: "reasoning",
        dimensions: { tier: "Free", model: "rule-engine" },
        expected_start: "17:30"
    },
    {
        name: "brief_gen",
        display_name: "Daily Brief Generation",
        agent_id: "news_desk",
        type: "delivery",
        dimensions: {},
        expected_start: "08:00"
    },
    {
        name: "push_dispatch",
        display_name: "Push Notifications",
        agent_id": "news_desk",
        type: "delivery",
        dimensions: {},
        expected_start: "08:30"
    }
];

const AGENTS = {
    "market_observer": { name: "Market Observer", persona: "Marcus", avatar: "/avatars/marcus.png", color: "blue" },
    "quant_mind": { name: "Quant Mind", persona: "Quinn", avatar: "/avatars/quinn.png", color: "purple" },
    "news_desk": { name: "News Desk", persona: "Nora", avatar: "/avatars/nora.png", color: "green" },
    "system_guardian": { name: "System Guardian", persona: "Sylar", avatar: "/avatars/sylar.png", color: "gray" }
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    try {
        // Path to backend DB
        // Assuming relative path from frontend to backend
        // c:\cygwin64\home\frank\StockWise\backend\StockWise.db (from config)
        // Let's guess standard location or use env
        const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), '../../backend/StockWise.db');
        const db = new Database(dbPath, { readonly: true });

        // Query Logs
        // task_logs: agent_id, task_name, display_name, status, start_time, end_time, message
        const stmt = db.prepare(`
            SELECT * FROM task_logs 
            WHERE date = ? 
            ORDER BY start_time ASC
        `);
        const logs = stmt.all(date);

        // Merge Plan + Actual
        // 1. Start with Plan
        const result = DAILY_PLAN_TEMPLATE.map(planItem => {
            // Find execution log for this plan item
            // Matching by task_name
            const logEntry = logs.find((l: any) => l.task_name === planItem.name);
            
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

        // 2. Add Ad-hoc tasks (Manual syncs, Validation, etc that are NOT in plan)
        logs.forEach((log: any) => {
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
            return timeA.localeCompare(timeB);
        });

        return NextResponse.json({ date, tasks: finalResponse });
        
    } catch (error) {
        console.error("Database Error:", error);
        return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
    }
}
