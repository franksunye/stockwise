from typing import List, Dict, Any

# Define the Agent Personas
AGENTS = {
    "market_observer": {
        "name": "Market Observer",
        "persona_name": "Marcus",
        "role": "Data Ingestion & Monitoring",
        "color": "blue",
        "avatar": "/avatars/marcus.png",
        "description": "Watches global markets and manages data ingestion."
    },
    "quant_mind": {
        "name": "Quant Mind",
        "persona_name": "Quinn",
        "role": "Core Analysis & Strategy",
        "color": "purple",
        "avatar": "/avatars/quinn.png",
        "description": "Runs sophisticated AI models and rule engines."
    },
    "news_desk": {
        "name": "News Desk",
        "persona_name": "Nora",
        "role": "Editorial & Communication",
        "color": "green",
        "avatar": "/avatars/nora.png",
        "description": "Synthesizes intelligence into briefs and alerts."
    },
    "system_guardian": {
        "name": "System Guardian",
        "persona_name": "Sylar",
        "role": "Maintenance & Ops",
        "color": "gray",
        "avatar": "/avatars/sylar.png",
        "description": "Ensures system health, backups, and validation."
    }
}

# Define the granular daily schedule
# This is the "Plan" - what we expect to happen every day.
DAILY_TASK_PLAN_TEMPLATE = [
    # --- News Desk Tasks (Morning Engagement) ---
    {
        "name": "morning_call",
        "display_name": "Daily Morning Call",
        "agent_id": "news_desk",
        "type": "delivery",
        "expected_start": "08:30",
        "dependencies": [],
        "dimensions": {}
    },

    # --- Market Observer Tasks (Metadata & Data) ---
    {
        "name": "meta_sync",
        "display_name": "Metadata Refresh",
        "agent_id": "market_observer",
        "type": "ingestion",
        "expected_start": "06:00",
        "dependencies": [],
        "dimensions": {}
    },
    {
        "name": "ingestion_cn",
        "display_name": "A-Share Data Sync",
        "agent_id": "market_observer",
        "type": "ingestion",
        "expected_start": "16:00",
        "dependencies": [],
        "dimensions": {"market": "CN"}
    },
    {
        "name": "ingestion_hk",
        "display_name": "HK Stock Data Sync",
        "agent_id": "market_observer",
        "type": "ingestion",
        "expected_start": "16:30",
        "dependencies": [],
        "dimensions": {"market": "HK"}
    },

    # --- System Guardian Tasks ---
    {
        "name": "validation",
        "display_name": "Post-Market Verification",
        "agent_id": "system_guardian",
        "type": "maintenance",
        "expected_start": "16:15",
        "dependencies": ["ingestion_cn"],
        "dimensions": {}
    },

    # --- Quant Mind Tasks ---
    {
        "name": "ai_analysis",
        "display_name": "DeepSeek AI Analysis",
        "agent_id": "quant_mind",
        "type": "reasoning",
        "expected_start": "16:45",
        "dependencies": ["validation"],
        "dimensions": {"model": "mixed"}
    },

    # --- News Desk Tasks (Evening Delivery) ---
    {
        "name": "brief_gen",
        "display_name": "Daily Brief Generation",
        "agent_id": "news_desk",
        "type": "delivery",
        "expected_start": "17:30",
        "dependencies": ["ai_analysis"],
        "dimensions": {}
    },
    {
        "name": "push_dispatch",
        "display_name": "Final Push Notification",
        "agent_id": "news_desk",
        "type": "delivery",
        "expected_start": "17:45",
        "dependencies": ["brief_gen"],
        "dimensions": {}
    }
]

def get_daily_plan(date_str: str) -> List[Dict[str, Any]]:
    """
    Returns the task plan for a specific date.
    """
    plan = []
    for task in DAILY_TASK_PLAN_TEMPLATE:
        t = task.copy()
        t['date'] = date_str
        t['status'] = 'pending' 
        # Default dimensions if not present
        if 'dimensions' not in t:
            t['dimensions'] = {}
        plan.append(t)
    return plan
