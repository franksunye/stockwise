import json
from typing import Any, Dict

from .base import BasePredictionModel
from backend.logger import logger
from backend.engine.signal_semantics import canonical_signal_from_layer1


class RuleAdapter(BasePredictionModel):
    @staticmethod
    def _is_en(locale: str) -> bool:
        return str(locale or "").strip().lower() == "en"

    @staticmethod
    def _build_en_reason(close: float, ma20: float, rsi: float, macd: float) -> str:
        trend_part = "Price action is neutral."
        if ma20 > 0:
            if close >= ma20:
                trend_part = "Price is holding above MA20."
            else:
                trend_part = "Price is below MA20."

        if rsi >= 65:
            momentum_part = "Momentum is relatively strong."
        elif rsi <= 35:
            momentum_part = "Momentum is weak and risk-sensitive."
        else:
            momentum_part = "Momentum is balanced."

        macd_part = "MACD histogram is improving." if macd >= 0 else "MACD histogram remains negative."
        return f"{trend_part} {momentum_part} {macd_part}"

    @staticmethod
    def _layer1_action_profile(setup_state: str, locale: str = "cn") -> Dict[str, str]:
        if RuleAdapter._is_en(locale):
            profiles = {
                "TriggeredLong": {
                    "summary_prefix": "Setup is constructive for a controlled long attempt",
                    "holding_profit_action": "Monitor and hold",
                    "holding_loss_action": "Exit if discipline level breaks",
                    "empty_action": "Consider staged entry",
                },
                "Watch": {
                    "summary_prefix": "Current state favors observation",
                    "holding_profit_action": "Monitor and hold",
                    "holding_loss_action": "Trim on weak rebound",
                    "empty_action": "Stay on watch",
                },
                "RiskOff": {
                    "summary_prefix": "Risk-off state is active",
                    "holding_profit_action": "Reduce existing exposure",
                    "holding_loss_action": "Exit if discipline level breaks",
                    "empty_action": "Pause new entries",
                },
                "NoSetup": {
                    "summary_prefix": "No actionable setup for now",
                    "holding_profit_action": "Monitor and hold",
                    "holding_loss_action": "Trim if weakness persists",
                    "empty_action": "No entry",
                },
            }
            return profiles.get(setup_state, profiles["NoSetup"])

        profiles = {
            "TriggeredLong": {
                "summary_prefix": "当前进入可尝试建仓区间",
                "holding_profit_action": "持仓观察",
                "holding_loss_action": "跌破纪律位应退出",
                "empty_action": "可尝试建仓",
            },
            "Watch": {
                "summary_prefix": "当前仅适合继续观察",
                "holding_profit_action": "持仓观察",
                "holding_loss_action": "反弹减仓",
                "empty_action": "继续观察",
            },
            "RiskOff": {
                "summary_prefix": "当前进入风险收缩区",
                "holding_profit_action": "已有仓位应收缩",
                "holding_loss_action": "跌破纪律位应退出",
                "empty_action": "暂停新增仓位",
            },
            "NoSetup": {
                "summary_prefix": "当前不建议出手",
                "holding_profit_action": "持仓观察",
                "holding_loss_action": "触发减仓",
                "empty_action": "不建议出手",
            },
        }
        return profiles.get(setup_state, profiles["NoSetup"])

    async def predict(self, symbol: str, date: str, data: Dict[str, Any], locale: str = 'cn') -> Dict[str, Any]:
        """
        Rule Engine based on quant indicators.
        In the two-layer architecture, Layer-1 owns final direction authority.
        """
        logger.info(f"Running Rule Engine for {symbol} on {date}")
        prices = data.get("daily_prices", [])
        if not prices:
            return {
                "signal": "NoSetup",
                "confidence": 0.0,
                "reasoning": self._build_reasoning(
                    signal="NoSetup",
                    summary="Data unavailable" if self._is_en(locale) else "数据缺失",
                    analysis="Unable to load price data" if self._is_en(locale) else "无法获取价格数据",
                    factors={},
                    locale=locale,
                ),
            }

        try:
            latest = prices[-1] if isinstance(prices, list) and prices else prices

            # Use Pandas Series for compatibility with QuantEngine
            import pandas as pd

            daily_series = pd.Series(latest)

            # Optional context (weekly/monthly). If unavailable, engine still runs with daily.
            from backend.database import get_connection

            conn = get_connection()
            cursor = conn.cursor()
            weekly_series = None
            monthly_series = None
            try:
                cursor.execute(
                    "SELECT * FROM weekly_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1",
                    (symbol,),
                )
                w_row = cursor.fetchone()
                if w_row:
                    w_cols = [d[0] for d in cursor.description]
                    weekly_series = pd.Series(dict(zip(w_cols, w_row)))
            except Exception:
                weekly_series = None

            try:
                cursor.execute(
                    "SELECT * FROM monthly_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1",
                    (symbol,),
                )
                m_row = cursor.fetchone()
                if m_row:
                    m_cols = [d[0] for d in cursor.description]
                    monthly_series = pd.Series(dict(zip(m_cols, m_row)))
            except Exception:
                monthly_series = None
            finally:
                conn.close()

            from backend.quant.engine import QuantEngine

            engine = QuantEngine()
            result = engine.run(
                symbol,
                {
                    "daily_row": daily_series,
                    "weekly_row": weekly_series,
                    "monthly_row": monthly_series,
                },
                "trend",
            )
            sig = result.signal

            raw_action = sig.action
            layer1 = data.get("layer1") or {}
            layer1_status = str(layer1.get("status") or "")
            final_action = self._align_signal_with_layer1(raw_action, layer1_status)

            close_val = latest.get("close", 0)
            ma20 = sig.factors.get("ma20", 0)

            rsi = float(sig.factors.get("rsi", 0) or 0)
            macd = float(sig.factors.get("macd_hist", 0) or 0)
            summary_text = sig.reason
            analysis_text = sig.reason
            if self._is_en(locale):
                en_reason = self._build_en_reason(close_val, float(ma20 or 0), rsi, macd)
                summary_text = en_reason
                analysis_text = en_reason

            reasoning_json = self._build_reasoning(
                signal=final_action,
                summary=summary_text,
                analysis=analysis_text,
                factors=sig.factors,
                close=close_val,
                raw_signal=raw_action,
                layer1_status=layer1_status,
                locale=locale,
            )

            return {
                "signal": final_action,
                "confidence": sig.confidence,
                "reasoning": reasoning_json,
                "support_price": ma20,
                "pressure_price": ma20 * 1.1,
                "token_usage_input": 0,
                "token_usage_output": 0,
                "execution_time_ms": 15,
            }
        except Exception as e:
            logger.error(f"Rule Engine Error: {e}")
            return None

    @staticmethod
    def _layer1_to_signal(setup_state: str) -> str:
        return canonical_signal_from_layer1(setup_state, "NoSetup")

    def _align_signal_with_layer1(self, raw_signal: str, layer1_status: str) -> str:
        if not layer1_status:
            return raw_signal
        expected = self._layer1_to_signal(layer1_status)
        if expected != raw_signal:
            logger.warning(
                f"RuleEngine aligned by Layer-1: raw={raw_signal} -> {expected} "
                f"(status={layer1_status})"
            )
        return expected

    def _build_reasoning(
        self,
        signal: str,
        summary: str,
        analysis: str,
        factors: Dict[str, Any],
        close: float = 0,
        raw_signal: str = "",
        layer1_status: str = "",
        locale: str = "cn",
    ) -> str:
        """Build a JSON-formatted reasoning string consistent with v3.3 schema."""
        is_en = self._is_en(locale)
        ma20 = factors.get("ma20", 0)
        rsi = factors.get("rsi", 0)
        macd = factors.get("macd_hist", 0)

        support = ma20 if ma20 > 0 else close * 0.95
        resistance = close * 1.05 if ma20 == 0 else (ma20 * 1.1 if close < ma20 else close * 1.1)
        support_2 = support * 0.985
        resistance_2 = resistance * 1.015
        stop_loss = support * 0.97

        summary_text = summary
        decision_detail = signal
        profile = self._layer1_action_profile(layer1_status or "NoSetup", locale=locale)
        if layer1_status and raw_signal and raw_signal != signal:
            summary_text = (
                f"{profile['summary_prefix']}. {summary_text}"
                if is_en
                else f"{profile['summary_prefix']}。{summary_text}"
            )
            decision_detail += " (direction calibrated by system rules)" if is_en else "（已根据系统规则校准方向）"
        elif layer1_status:
            summary_text = (
                f"{profile['summary_prefix']}. {summary_text}"
                if is_en
                else f"{profile['summary_prefix']}。{summary_text}"
            )

        trend_conclusion = "Trend context" if is_en else "趋势观察"
        momentum_conclusion = "Momentum check" if is_en else "动能评估"
        levels_conclusion = "Level map" if is_en else "空间格局"
        context_conclusion = "Multi-timeframe alignment" if is_en else "多维对齐"
        psychology_conclusion = "Execution discipline" if is_en else "博弈纪律"
        decision_conclusion = "System contract" if is_en else "量化契约"

        trend_data = (
            f"MA20={ma20:.2f}, Price={close:.2f}. {analysis}"
            if is_en
            else f"MA20={ma20:.2f}, 价格={close:.2f}。{analysis}"
        )
        momentum_data = (
            f"RSI={rsi:.1f}, MACD histogram={macd:.4f}"
            if is_en
            else f"RSI={rsi:.1f}, MACD柱={macd:.4f}"
        )
        levels_data = (
            f"Immediate support is near MA20 ({ma20:.2f}); resistance references prior highs."
            if is_en
            else f"关键支撑位在 MA20 ({ma20:.2f}) 附近，上方阻力参考前高。"
        )
        context_data = (
            "Multi-timeframe resonance check: daily/weekly/monthly quant alignment."
            if is_en
            else "多周期共振分析：日、周、月趋势量化对比（系统预置规则）。"
        )
        psychology_data = (
            "Follow trend discipline and avoid subjective overreaction in high-volatility zones."
            if is_en
            else "遵循趋势跟踪纪律，避免波动较大的主观预期区间。"
        )

        p2_take_profit_action = "Staged take-profit plan" if is_en else "分批止盈预案"
        p2_reduce_action = "Trim on rebound" if is_en else "反弹减仓"
        p2_breakout_action = "Breakout follow-through plan" if is_en else "突破跟随预案"
        trigger_not_break = f"Hold above {ma20:.2f}" if is_en else f"不跌破 {ma20:.2f}"
        trigger_near_res = (
            f"Approaches {resistance:.2f} with stalling momentum"
            if is_en
            else f"接近 {resistance:.2f} 且放量滞涨"
        )
        trigger_break_ma = f"Breaks below {ma20:.2f} with confirmation" if is_en else f"有效跌破 {ma20:.2f}"
        trigger_rebound_fail = (
            f"Rebound to around {resistance:.2f} fails to break"
            if is_en
            else f"反弹至 {resistance:.2f} 附近但未突破"
        )
        trigger_pullback = (
            f"Pullback stabilizes near {support:.2f}"
            if is_en
            else f"回调至 {support:.2f} 企稳"
        )
        trigger_breakout = (
            f"Breaks above {resistance:.2f} on volume and holds"
            if is_en
            else f"放量突破 {resistance:.2f} 并站稳"
        )
        reason_trend = "Trend remains intact" if is_en else "趋势未改"
        reason_lock = "Lock gains first to avoid giveback after spikes" if is_en else "先锁定收益，避免冲高回落"
        reason_risk = "Risk line triggered" if is_en else "触发风险线"
        reason_weak_rebound = "Prioritize risk reduction on weak rebound" if is_en else "弱势反抽优先降仓位风险"
        reason_wait = "Wait for confirmation before acting" if is_en else "等待趋势确认"
        reason_follow = "Trade only after confirmation" if is_en else "只做确认后的顺势交易"
        counter_argument = (
            f"If price breaks below {stop_loss:.2f} on volume while RSI weakens further, this thesis is invalid."
            if is_en
            else f"如果价格放量跌破 {stop_loss:.2f} 且 RSI 进一步走弱，则当前逻辑失效。"
        )
        conflict_resolution = (
            "Use moving-average structure as the anchor; execute mechanically without directional bias."
            if is_en
            else "以均线系统为准，不带多空偏见，执行机械量化纪律。"
        )
        tomorrow_focus = (
            f"Watch the conviction of price action around MA20 ({ma20:.2f})."
            if is_en
            else f"关注价格在 {ma20:.2f} 均线附近的博弈强度。"
        )

        reasoning_data = {
            "signal": signal,
            "confidence": 0.5 if signal == "Side" else 0.75,
            "summary": summary_text,
            "reasoning_trace": [
                {
                    "step": "trend",
                    "data": trend_data,
                    "conclusion": trend_conclusion,
                },
                {
                    "step": "momentum",
                    "data": momentum_data,
                    "conclusion": momentum_conclusion,
                },
                {
                    "step": "levels",
                    "data": levels_data,
                    "conclusion": levels_conclusion,
                },
                {
                    "step": "context",
                    "data": context_data,
                    "conclusion": context_conclusion,
                },
                {
                    "step": "psychology",
                    "data": psychology_data,
                    "conclusion": psychology_conclusion,
                },
                {
                    "step": "decision",
                    "data": decision_detail,
                    "conclusion": decision_conclusion,
                },
            ],
            "key_levels": {
                "immediate_support": [round(support, 2), round(support_2, 2)],
                "immediate_resistance": [round(resistance, 2), round(resistance_2, 2)],
                "stop_loss_reference": round(stop_loss, 2),
            },
            "tactics": {
                "holding_profit": [
                    {
                        "priority": "P1",
                        "action": profile["holding_profit_action"],
                        "trigger": trigger_not_break,
                        "target_price": round(resistance, 2),
                        "stop_advance_price": round(close, 2),
                        "reason": reason_trend,
                    },
                    {
                        "priority": "P2",
                        "action": p2_take_profit_action,
                        "trigger": trigger_near_res,
                        "target_price": round(resistance_2, 2),
                        "stop_advance_price": round(support, 2),
                        "reason": reason_lock,
                    },
                ],
                "holding_loss": [
                    {
                        "priority": "P1",
                        "action": profile["holding_loss_action"],
                        "trigger": trigger_break_ma,
                        "stop_loss_price": round(stop_loss, 2),
                        "reason": reason_risk,
                    },
                    {
                        "priority": "P2",
                        "action": p2_reduce_action,
                        "trigger": trigger_rebound_fail,
                        "stop_loss_price": round(stop_loss, 2),
                        "reason": reason_weak_rebound,
                    },
                ],
                "empty": [
                    {
                        "priority": "P1",
                        "action": profile["empty_action"],
                        "trigger": trigger_pullback,
                        "buy_zone_price": round(support, 2),
                        "reason": reason_wait,
                    },
                    {
                        "priority": "P2",
                        "action": p2_breakout_action,
                        "trigger": trigger_breakout,
                        "buy_zone_price": [round(resistance, 2), round(resistance_2, 2)],
                        "reason": reason_follow,
                    },
                ],
            },
            "counter_argument": counter_argument,
            "conflict_resolution": conflict_resolution,
            "tomorrow_focus": tomorrow_focus,
            "is_llm": False,
        }
        return json.dumps(reasoning_data, ensure_ascii=False)
