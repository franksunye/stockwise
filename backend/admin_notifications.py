import os
from typing import Any, Dict, Optional


REPO_ACTIONS_URL = "https://github.com/franksunye/stockwise/actions/workflows"

WORKFLOW_LABELS = {
    "acceptance_weekly.yml": "周验收快照",
    "ai_analyze_cn.yml": "A股 AI 分析",
    "ai_analyze_hk.yml": "港股 AI 分析",
    "ai_backfill.yml": "AI 历史补跑",
    "almanac_maintenance.yml": "黄历历史补跑",
    "daily_brief_push.yml": "每日简报推送",
    "daily_morning_call.yml": "早盘计划提醒",
    "daily_validation_check.yml": "每日验证巡检",
    "data_sync_cn.yml": "A股盘后同步",
    "data_sync_hk.yml": "港股盘后同步",
    "data_sync_realtime.yml": "盘中实时同步",
    "data_sync_single.yml": "单票按需补数",
    "layer1_consistency_daily.yml": "Layer1 一致性巡检",
    "meta_sync.yml": "元数据同步",
    "tradeability_postclose_pipeline.yml": "Tradeability 夜间编排",
    "tradeability_promotion_gate.yml": "Tradeability 晋级判定",
    "user_maintenance.yml": "用户维护",
    "verify_predictions.yml": "预测验证",
}

METADATA_LABELS = {
    "candidate_version": "候选版本",
    "action": "操作",
    "calibration_cn": "CN 周校准",
    "calibration_hk": "HK 周校准",
    "count": "数量",
    "date": "日期",
    "dry_run": "演练模式",
    "delivered_users": "已送达用户",
    "duration": "耗时",
    "error": "错误",
    "failed_count": "失败数量",
    "force": "强制模式",
    "gate_cn": "CN 交易日闸门",
    "gate_hk": "HK 交易日闸门",
    "market": "市场",
    "message": "说明",
    "mode": "模式",
    "pipeline_run_id": "流水线运行 ID",
    "run_url": "运行链接",
    "records": "记录数",
    "sample_sync_cn": "CN 样本同步",
    "sample_sync_hk": "HK 样本同步",
    "skipped_count": "跳过数量",
    "sidecar_cn": "CN Sidecar",
    "sidecar_hk": "HK Sidecar",
    "success_count": "成功数量",
    "symbol": "股票代码",
    "symbols": "股票列表",
    "target_date": "目标日期",
    "triggered_by": "触发来源",
    "trigger_source": "触发方式",
    "user_id": "用户 ID",
    "warning_count": "告警数量",
    "workflow": "工作流",
}


def build_workflow_url(workflow_file: Optional[str]) -> Optional[str]:
    if not workflow_file:
        return None
    return f"{REPO_ACTIONS_URL}/{workflow_file}"


def workflow_display_name(workflow_file: Optional[str]) -> Optional[str]:
    if not workflow_file:
        return None
    return WORKFLOW_LABELS.get(workflow_file, workflow_file)


def format_metadata_lines(metadata: Optional[Dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    if not metadata:
        return lines

    for key, value in metadata.items():
        if value is None:
            continue
        label = METADATA_LABELS.get(key, str(key).replace("_", " ").title())
        lines.append(f"- **{label}**: {value}")
    return lines


def build_success_message(task_name: str, duration: Optional[float] = None, metadata: Optional[Dict[str, Any]] = None) -> str:
    lines = [f"### ✅ StockWise 后台任务成功", f"> **任务**: {task_name}", "> **状态**: 已完成"]
    if duration is not None:
        lines.append(f"- **耗时**: {duration:.1f}s")
    lines.extend(format_metadata_lines(metadata))
    return "\n".join(lines)


def build_failure_message(
    task_name: str,
    error_message: Optional[str],
    duration: Optional[float] = None,
    metadata: Optional[Dict[str, Any]] = None,
    rerun_workflow: Optional[str] = None,
) -> str:
    lines = [f"### ❌ StockWise 后台任务失败", f"> **任务**: {task_name}", "> **状态**: 失败"]
    if duration is not None:
        lines.append(f"- **耗时**: {duration:.1f}s")
    lines.append(f"- **错误**: `{error_message or '未知错误'}`")
    lines.extend(format_metadata_lines(metadata))

    rerun_url = build_workflow_url(rerun_workflow)
    rerun_label = workflow_display_name(rerun_workflow)
    if rerun_url and rerun_label:
        lines.append(f"- **重试入口**: [{rerun_label}]({rerun_url})")

    return "\n".join(lines)


def get_wecom_robot_key() -> Optional[str]:
    return os.getenv("WECOM_ROBOT_KEY")


def get_admin_mobiles() -> list[str]:
    raw = os.getenv("ADMIN_MOBILES", "").strip()
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]
