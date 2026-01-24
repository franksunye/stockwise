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
    # --- News Desk Tasks (Morning Phase) ---
    {
        "name": "morning_call",
        "display_name": "Daily Morning Call",
        "agent_id": "news_desk",
        "type": "delivery",
        "expected_start": "08:00",
        "dependencies": [],
        "dimensions": {}
    },

    # --- Market Observer Tasks (Post-Market) ---
    {
        "name": "ingestion_cn",
        "display_name": "A-Share Data Sync",
        "agent_id": "market_observer",
        "type": "ingestion",
        "expected_start": "15:30",
        "dependencies": [],
        "dimensions": {"market": "CN"}
    },
    {
        "name": "ingestion_hk",
        "display_name": "HK Stock Data Sync",
        "agent_id": "market_observer",
        "type": "ingestion",
        "expected_start": "15:45",
        "dependencies": [],
        "dimensions": {"market": "HK"}
    },
    {
        "name": "meta_sync",
        "display_name": "Metadata Refresh",
        "agent_id": "market_observer",
        "type": "ingestion",
        "expected_start": "16:00",
        "dependencies": ["ingestion_cn"],
        "dimensions": {}
    },

    # --- System Guardian Tasks ---
    {
        "name": "validation",
        "display_name": "Prediction Result Verification",
        "agent_id": "system_guardian",
        "type": "maintenance",
        "expected_start": "16:15",
        "dependencies": ["meta_sync"],
        "dimensions": {}
    },

    # --- Quant Mind Tasks ---
    {
        "name": "ai_analysis_pro",
        "display_name": "DeepSeek Analysis (PRO)",
        "agent_id": "quant_mind",
        "type": "reasoning",
        "expected_start": "16:30",
        "dependencies": ["validation"],
        "dimensions": {"tier": "PRO", "model": "mixed"}
    },
    {
        "name": "ai_analysis_free",
        "display_name": "Standard Analysis (Free)",
        "agent_id": "quant_mind",
        "type": "reasoning",
        "expected_start": "17:00",
        "dependencies": ["validation"],
        "dimensions": {"tier": "Free", "model": "rule-engine"}
    },

    # --- News Desk Tasks (Evening Phase) ---
    {
        "name": "brief_gen",
        "display_name": "Daily Brief Generation",
        "agent_id": "news_desk",
        "type": "delivery",
        "expected_start": "18:00",
        "dependencies": ["ai_analysis_pro"],
        "dimensions": {}
    },
    {
        "name": "push_dispatch",
        "display_name": "Push Notifications",
        "agent_id": "news_desk",
        "type": "delivery",
        "expected_start": "18:30",
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
