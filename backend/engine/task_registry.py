from typing import List, Dict, Any

# Define the Agent Personas
AGENTS = {
    "market_observer": {
        "name": "市场观察员",
        "persona_name": "马库斯 (Marcus)",
        "role": "数据接入与实时监控",
        "color": "blue",
        "avatar": "/avatars/marcus.png",
        "description": "监控全球市场动态，管理海量行情数据接入。"
    },
    "quant_mind": {
        "name": "量化大脑",
        "persona_name": "奎因 (Quinn)",
        "role": "核心分析与策略建模",
        "color": "purple",
        "avatar": "/avatars/quinn.png",
        "description": "运行复杂的 AI 多模态预测模型与量化规则引擎。"
    },
    "news_desk": {
        "name": "新闻编辑部",
        "persona_name": "诺拉 (Nora)",
        "role": "内容合成与用户交付",
        "color": "green",
        "avatar": "/avatars/nora.png",
        "description": "将碎片化情报合成为高价值简报，负责全渠道推送。"
    },
    "system_guardian": {
        "name": "系统守护者",
        "persona_name": "塞拉 (Sylar)",
        "role": "运维监控与合规验证",
        "color": "gray",
        "avatar": "/avatars/sylar.png",
        "description": "确保系统健康运行、数据备份以及预测结果的准确性回测。"
    }
}

# Define the granular daily schedule
# This is the "Plan" - what we expect to happen every day.
DAILY_TASK_PLAN_TEMPLATE = [
    # --- News Desk Tasks (Morning Engagement) ---
    {
        "name": "morning_call",
        "display_name": "每日早报与策略提醒",
        "agent_id": "news_desk",
        "type": "delivery",
        "expected_start": "08:30",
        "dependencies": [],
        "dimensions": {}
    },

    # --- Market Observer Tasks (Metadata & Watch) ---
    {
        "name": "meta_sync",
        "display_name": "股票元数据刷新",
        "agent_id": "market_observer",
        "type": "ingestion",
        "expected_start": "06:00",
        "dependencies": [],
        "dimensions": {}
    },
    {
        "name": "market_sentinel",
        "display_name": "盘中实时行情监控 (10m)",
        "agent_id": "market_observer",
        "type": "monitoring",
        "expected_start": "09:30",
        "dependencies": [],
        "dimensions": {"interval": "10分"}
    },
    {
        "name": "ingestion_cn",
        "display_name": "A股行情数据同步",
        "agent_id": "market_observer",
        "type": "ingestion",
        "expected_start": "16:00",
        "dependencies": [],
        "dimensions": {"market": "A股"}
    },
    {
        "name": "ingestion_hk",
        "display_name": "港股行情数据同步",
        "agent_id": "market_observer",
        "type": "ingestion",
        "expected_start": "16:30",
        "dependencies": [],
        "dimensions": {"market": "港股"}
    },

    # --- System Guardian Tasks ---
    {
        "name": "validation",
        "display_name": "预测准确性验证与战报",
        "agent_id": "system_guardian",
        "type": "maintenance",
        "expected_start": "16:45",
        "dependencies": ["ingestion_hk"],
        "dimensions": {}
    },

    # --- Quant Mind Tasks ---
    {
        "name": "ai_analysis",
        "display_name": "次日交易策略制定 (AI)",
        "agent_id": "quant_mind",
        "type": "reasoning",
        "expected_start": "17:00",
        "dependencies": ["validation"],
        "dimensions": {"model": "混合模型"}
    },

    # --- News Desk Tasks (Evening Delivery) ---
    {
        "name": "brief_gen",
        "display_name": "每日深度复盘与推送",
        "agent_id": "news_desk",
        "type": "delivery",
        "expected_start": "17:30",
        "dependencies": ["ai_analysis"],
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
