from typing import Any, Dict, List

# Agent Persona Registry (single source for backend task attribution)
AGENTS = {
    "market_observer": {
        "name": "市场观察员",
        "persona_name": "马库斯 (Marcus)",
        "role": "数据接入与实时监控",
        "color": "blue",
        "avatar": "/avatars/marcus.png",
        "description": "监控全市场动态，管理行情接入与盘中巡检。",
    },
    "quant_mind": {
        "name": "量化大脑",
        "persona_name": "奎因 (Quinn)",
        "role": "核心分析与策略建模",
        "color": "purple",
        "avatar": "/avatars/quinn.png",
        "description": "运行多模型推演与策略生成，输出次日交易剧本。",
    },
    "news_desk": {
        "name": "新闻编辑部",
        "persona_name": "诺拉 (Nora)",
        "role": "内容合成与用户交付",
        "color": "green",
        "avatar": "/avatars/nora.png",
        "description": "整合情报与结论，形成可读战报并完成分发。",
    },
    "system_guardian": {
        "name": "系统守护者",
        "persona_name": "塞拉 (Sylar)",
        "role": "运维监控与系统健康",
        "color": "gray",
        "avatar": "/avatars/sylar.png",
        "description": "负责系统稳定性、告警治理与日常维护。",
    },
    "validation_auditor": {
        "name": "验证审计官",
        "persona_name": "维尔 (Verifier)",
        "role": "收盘验证与审计回写",
        "color": "amber",
        "avatar": "/avatars/verifier.png",
        "description": "专职追踪历史判断兑现情况，并回写验证结果与表现审计。",
    },
}


# Daily execution plan template
DAILY_TASK_PLAN_TEMPLATE = [
    {
        "name": "morning_call",
        "display_name": "每日早报与策略提醒",
        "agent_id": "news_desk",
        "type": "delivery",
        "expected_start": "08:30",
        "dependencies": [],
        "dimensions": {},
    },
    {
        "name": "meta_sync",
        "display_name": "股票元数据刷新",
        "agent_id": "market_observer",
        "type": "ingestion",
        "expected_start": "06:00",
        "dependencies": [],
        "dimensions": {},
    },
    {
        "name": "market_sentinel",
        "display_name": "盘中实时行情监控 (10m)",
        "agent_id": "market_observer",
        "type": "monitoring",
        "expected_start": "09:30",
        "dependencies": [],
        "dimensions": {"interval": "10分"},
    },
    {
        "name": "ingestion_cn",
        "display_name": "A股行情数据同步",
        "agent_id": "market_observer",
        "type": "ingestion",
        "expected_start": "16:00",
        "dependencies": [],
        "dimensions": {"market": "A股"},
    },
    {
        "name": "ingestion_hk",
        "display_name": "港股行情数据同步",
        "agent_id": "market_observer",
        "type": "ingestion",
        "expected_start": "16:30",
        "dependencies": [],
        "dimensions": {"market": "港股"},
    },
    {
        "name": "validation",
        "display_name": "历史回看验证与战报",
        "agent_id": "validation_auditor",
        "type": "maintenance",
        "expected_start": "16:45",
        "dependencies": ["ingestion_hk"],
        "dimensions": {},
    },
    {
        "name": "ai_analysis",
        "display_name": "次日交易策略制定 (AI)",
        "agent_id": "quant_mind",
        "type": "reasoning",
        "expected_start": "17:00",
        "dependencies": ["validation"],
        "dimensions": {"model": "混合模型"},
    },
    {
        "name": "brief_gen",
        "display_name": "每日深度复盘与推送",
        "agent_id": "news_desk",
        "type": "delivery",
        "expected_start": "17:30",
        "dependencies": ["ai_analysis"],
        "dimensions": {},
    },
]


def get_daily_plan(date_str: str) -> List[Dict[str, Any]]:
    """Return the expected daily task plan for a given business date."""
    plan = []
    for task in DAILY_TASK_PLAN_TEMPLATE:
        item = task.copy()
        item["date"] = date_str
        item["status"] = "pending"
        if "dimensions" not in item:
            item["dimensions"] = {}
        plan.append(item)
    return plan
