import json
from typing import Any, Dict

from .base import BasePredictionModel
from backend.logger import logger


class RuleAdapter(BasePredictionModel):
    @staticmethod
    def _layer1_action_profile(setup_state: str) -> Dict[str, str]:
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

    async def predict(self, symbol: str, date: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Rule Engine based on quant indicators.
        In the two-layer architecture, Layer-1 owns final direction authority.
        """
        logger.info(f"Running Rule Engine for {symbol} on {date}")
        prices = data.get("daily_prices", [])
        if not prices:
            return {
                "signal": "Side",
                "confidence": 0.0,
                "reasoning": self._build_reasoning(
                    signal="Side",
                    summary="数据缺失",
                    analysis="无法获取价格数据",
                    factors={},
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

            reasoning_json = self._build_reasoning(
                signal=final_action,
                summary=sig.reason,
                analysis=sig.reason,
                factors=sig.factors,
                close=close_val,
                raw_signal=raw_action,
                layer1_status=layer1_status,
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
        if setup_state == "TriggeredLong":
            return "Long"
        if setup_state in {"NoSetup", "Watch", "RiskOff"}:
            return "Side"
        return "Side"

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
    ) -> str:
        """Build a JSON-formatted reasoning string consistent with v3.3 schema."""
        ma20 = factors.get("ma20", 0)
        rsi = factors.get("rsi", 0)
        macd = factors.get("macd_hist", 0)

        support = ma20 if ma20 > 0 else close * 0.95
        resistance = close * 1.05 if ma20 == 0 else (ma20 * 1.1 if close < ma20 else close * 1.1)
        support_2 = support * 0.985
        resistance_2 = resistance * 1.015
        stop_loss = support * 0.97

        summary_text = f"量化兜底信号：{summary}"
        decision_detail = f"量化规则决策：{signal}"
        profile = self._layer1_action_profile(layer1_status or "NoSetup")
        if layer1_status and raw_signal and raw_signal != signal:
            summary_text = f"[Layer-1:{layer1_status}] {profile['summary_prefix']}。{summary_text}"
            decision_detail += f"（Layer-1覆盖原始信号 {raw_signal}）"
        elif layer1_status:
            summary_text = f"[Layer-1:{layer1_status}] {profile['summary_prefix']}。{summary_text}"

        reasoning_data = {
            "signal": signal,
            "confidence": 0.5 if signal == "Side" else 0.75,
            "summary": summary_text,
            "reasoning_trace": [
                {
                    "step": "trend",
                    "data": f"MA20={ma20:.2f}, 价格={close:.2f}。{analysis}",
                    "conclusion": "趋势观察",
                },
                {
                    "step": "momentum",
                    "data": f"RSI={rsi:.1f}, MACD柱={macd:.4f}",
                    "conclusion": "动能评估",
                },
                {
                    "step": "levels",
                    "data": f"关键支撑位在 MA20 ({ma20:.2f}) 附近，上方阻力参考前高。",
                    "conclusion": "空间格局",
                },
                {
                    "step": "context",
                    "data": "多周期共振分析：日、周、月趋势量化对比（系统预置规则）。",
                    "conclusion": "多维对齐",
                },
                {
                    "step": "psychology",
                    "data": "遵循趋势跟踪纪律，避免波动较大的主观预期区间。",
                    "conclusion": "博弈纪律",
                },
                {
                    "step": "decision",
                    "data": decision_detail,
                    "conclusion": "量化契约",
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
                        "trigger": f"不跌破 {ma20:.2f}",
                        "target_price": round(resistance, 2),
                        "stop_advance_price": round(close, 2),
                        "reason": "趋势未改",
                    },
                    {
                        "priority": "P2",
                        "action": "分批止盈预案",
                        "trigger": f"接近 {resistance:.2f} 且放量滞涨",
                        "target_price": round(resistance_2, 2),
                        "stop_advance_price": round(support, 2),
                        "reason": "先锁定收益，避免冲高回落",
                    },
                ],
                "holding_loss": [
                    {
                        "priority": "P1",
                        "action": profile["holding_loss_action"],
                        "trigger": f"有效跌破 {ma20:.2f}",
                        "stop_loss_price": round(stop_loss, 2),
                        "reason": "触发风险线",
                    },
                    {
                        "priority": "P2",
                        "action": "反弹减仓",
                        "trigger": f"反弹至 {resistance:.2f} 附近但未突破",
                        "stop_loss_price": round(stop_loss, 2),
                        "reason": "弱势反抽优先降仓位风险",
                    },
                ],
                "empty": [
                    {
                        "priority": "P1",
                        "action": profile["empty_action"],
                        "trigger": f"回调至 {support:.2f} 企稳",
                        "buy_zone_price": round(support, 2),
                        "reason": "等待趋势确认",
                    },
                    {
                        "priority": "P2",
                        "action": "突破跟随预案",
                        "trigger": f"放量突破 {resistance:.2f} 并站稳",
                        "buy_zone_price": [round(resistance, 2), round(resistance_2, 2)],
                        "reason": "只做确认后的顺势交易",
                    },
                ],
            },
            "counter_argument": f"如果价格放量跌破 {stop_loss:.2f} 且 RSI 进一步走弱，则当前逻辑失效。",
            "conflict_resolution": "以均线系统为准，不带多空偏见，执行机械量化纪律。",
            "tomorrow_focus": f"关注价格在 {ma20:.2f} 均线附近的博弈强度。",
            "is_llm": False,
        }
        return json.dumps(reasoning_data, ensure_ascii=False)
