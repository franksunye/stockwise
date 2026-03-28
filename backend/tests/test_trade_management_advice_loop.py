from __future__ import annotations

from unittest.mock import patch

from backend.management.domain.live_advice import UserTradePosition
from backend.management.domain.position_state import PositionState
from backend.management.live.card_formatter import build_action_plan, build_trade_card_markdown
from backend.management.live.service import run_trade_management_advice_loop


def _sample_snapshot(state_id: str = "ProfitProtection") -> PositionState:
    return PositionState(
        symbol="02171",
        trade_date="2026-03-27",
        entry_date="2025-12-31",
        entry_price=14.5,
        position_size=3000.0,
        holding_days=86,
        close=17.46,
        high=17.74,
        low=17.12,
        volume=10000000.0,
        unrealized_pnl_pct=0.2041,
        mfe_pct=0.25,
        mae_pct=-0.03,
        signal_state="TriggeredLong",
        confidence=0.85,
        support_price=14.79,
        resistance_price=17.74,
        discipline_price=14.79,
        breakout_confirmed=False,
        near_resistance=True,
        failed_breakout_risk=False,
        volume_followthrough=True,
        state_id=state_id,
    )


def _sample_position() -> UserTradePosition:
    return UserTradePosition(
        position_id="pos_demo",
        user_id="ADMIN",
        symbol="02171",
        market="HK",
        entry_date="2025-12-31",
        entry_price=14.5,
        position_size=3000.0,
        remaining_size=3000.0,
        stock_name="科济药业-B",
    )


def test_profit_protection_card_contains_core_fields() -> None:
    position = _sample_position()
    snapshot = _sample_snapshot()

    card = build_trade_card_markdown(
        position=position,
        snapshot=snapshot,
        next_trade_date="2026-03-30",
        lane_id="baseline_3d",
        recommended_policy="buy_and_hold_baseline",
    )

    assert "交易管理卡 | 科济药业-B 02171" in card
    assert "**当前状态**：已有明确浮盈，核心任务转为保护利润。" in card
    assert "**2026-03-30 建议**：继续持有，不追高" in card
    assert "17.74" in card
    assert "14.79" in card
    assert "TriggeredLong" not in card
    assert "baseline_3d" not in card


def test_failure_risk_plan_prefers_exit_when_policy_high_risk() -> None:
    snapshot = _sample_snapshot(state_id="FailureRisk")
    plan = build_action_plan(snapshot, "failure_risk_exit_all")

    assert "优先退出" in plan.summary
    assert "14.79" in plan.detail


def test_advice_loop_runs_with_mocked_dependencies() -> None:
    position = _sample_position()
    snapshot = _sample_snapshot()

    with patch("backend.management.live.service.init_db"), \
         patch("backend.management.live.service.list_active_trade_positions", return_value=[position]), \
         patch("backend.management.live.service.build_position_snapshots", return_value=[snapshot]), \
         patch(
             "backend.management.live.service.route_case_lanes",
             return_value={
                 "final": {
                     "lane_id": "baseline_3d",
                     "recommended_policy": "buy_and_hold_baseline",
                 }
             },
         ), \
         patch("backend.management.live.service.insert_trade_advice_log") as persist_mock:
        result = run_trade_management_advice_loop(persist_log=True, notify=False)

    assert result.processed_count == 1
    assert result.persisted_count == 1
    assert result.failed_count == 0
    assert result.delivered_count == 0
    assert result.suppressed_count == 0
    assert len(result.cards) == 1
    persist_mock.assert_called_once()


def test_advice_loop_persists_failed_webhook_status() -> None:
    position = _sample_position()
    snapshot = _sample_snapshot()

    with patch("backend.management.live.service.init_db"), \
         patch("backend.management.live.service.list_active_trade_positions", return_value=[position]), \
         patch("backend.management.live.service.build_position_snapshots", return_value=[snapshot]), \
         patch(
             "backend.management.live.service.route_case_lanes",
             return_value={
                 "final": {
                     "lane_id": "baseline_3d",
                     "recommended_policy": "buy_and_hold_baseline",
                 }
             },
         ), \
         patch("backend.management.live.service.send_wecom_notification", side_effect=RuntimeError("wecom down")), \
         patch("backend.management.live.service.insert_trade_advice_log") as persist_mock:
        result = run_trade_management_advice_loop(persist_log=True, notify=True)

    assert result.processed_count == 1
    assert result.persisted_count == 1
    assert result.delivered_count == 0
    assert result.suppressed_count == 0
    assert result.failed_count == 1
    assert "webhook 发送失败" in result.errors[0]
    assert persist_mock.call_count == 2


def test_advice_loop_uses_non_alert_followup_text_for_mentions() -> None:
    position = _sample_position()
    snapshot = _sample_snapshot()

    with patch("backend.management.live.service.init_db"), \
         patch("backend.management.live.service.list_active_trade_positions", return_value=[position]), \
         patch("backend.management.live.service.build_position_snapshots", return_value=[snapshot]), \
         patch(
             "backend.management.live.service.route_case_lanes",
             return_value={
                 "final": {
                     "lane_id": "baseline_3d",
                     "recommended_policy": "buy_and_hold_baseline",
                 }
             },
         ), \
         patch("backend.management.live.service.get_admin_mobiles", return_value=["13800000000"]), \
         patch("backend.management.live.service.send_wecom_notification", return_value=True) as notify_mock, \
         patch("backend.utils.send_wecom_notification", return_value=True), \
         patch("backend.management.live.service.insert_trade_advice_log"):
        result = run_trade_management_advice_loop(persist_log=True, notify=True)

    assert result.delivered_count == 1
    assert notify_mock.call_count == 1
    assert notify_mock.call_args.kwargs["mention_text"] == "交易管理提醒：请查收上一条持仓建议卡"


def test_advice_loop_suppresses_duplicate_sent_card() -> None:
    position = _sample_position()
    snapshot = _sample_snapshot()

    with patch("backend.management.live.service.init_db"), \
         patch("backend.management.live.service.list_active_trade_positions", return_value=[position]), \
         patch("backend.management.live.service.build_position_snapshots", return_value=[snapshot]), \
         patch(
             "backend.management.live.service.route_case_lanes",
             return_value={
                 "final": {
                     "lane_id": "baseline_3d",
                     "recommended_policy": "buy_and_hold_baseline",
                 }
             },
         ), \
         patch(
             "backend.management.live.service.fetch_latest_trade_advice",
             return_value={
                 "latest_trade_date": "2026-03-27",
                 "card_markdown": build_trade_card_markdown(
                     position=position,
                     snapshot=snapshot,
                     next_trade_date="2026-03-30",
                     lane_id="baseline_3d",
                     recommended_policy="buy_and_hold_baseline",
                 ),
                 "webhook_delivery_status": "sent",
                 "webhook_delivery_error": None,
             },
         ), \
         patch("backend.management.live.service.send_wecom_notification") as notify_mock, \
         patch("backend.management.live.service.insert_trade_advice_log") as persist_mock:
        result = run_trade_management_advice_loop(persist_log=True, notify=True)

    assert result.processed_count == 1
    assert result.persisted_count == 0
    assert result.delivered_count == 0
    assert result.suppressed_count == 1
    assert result.failed_count == 0
    notify_mock.assert_not_called()
    persist_mock.assert_not_called()
