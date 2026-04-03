from .base import BaseStep
from engine.chain.context import ChainContext

class IndicatorStep(BaseStep):
    """
    Step 2: Technical Analysis (Daily)
    Focuses on MA trend, MACD momentum, and RSI levels.
    """
    async def build_prompt(self, context: ChainContext) -> str:
        locale = context.locale or "cn"
        en = locale == "en"
        prices = context.input_data.get('daily_prices', [])
        if not prices:
            return "Error: No price data available." if en else "错误：无日线数据。"

        data = prices[-1]

        ma5, ma10, ma20, ma60 = data.get('ma5', 0), data.get('ma10', 0), data.get('ma20', 0), data.get('ma60', 0)
        close = data.get('close', 0)

        if ma5 and ma10 and ma20:
            if ma5 > ma10 > ma20:
                ma_alignment = (
                    f"MA5({ma5:.2f}) > MA10({ma10:.2f}) > MA20({ma20:.2f}) ✅ Short-term bullish"
                    if en else
                    f"MA5({ma5:.2f}) > MA10({ma10:.2f}) > MA20({ma20:.2f}) ✅ 短期多头"
                )
                trend_score = 2
            elif ma5 < ma10 < ma20:
                ma_alignment = (
                    f"MA5({ma5:.2f}) < MA10({ma10:.2f}) < MA20({ma20:.2f}) ❌ Short-term bearish"
                    if en else
                    f"MA5({ma5:.2f}) < MA10({ma10:.2f}) < MA20({ma20:.2f}) ❌ 短期空头"
                )
                trend_score = -2
            else:
                ma_alignment = "Sideways / mixed MAs" if en else "均线纠缠震荡"
                trend_score = 0
        else:
            ma_alignment = "Incomplete MA data" if en else "均线数据不足"
            trend_score = 0

        if close > ma5:
            price_pos_desc = "Above short-term MAs ✅" if en else "站上所有短期均线 ✅"
        elif close > ma20:
            price_pos_desc = "Retesting MA20 support" if en else "回踩MA20支撑"
        else:
            price_pos_desc = "Below MA20 ❌" if en else "跌破MA20支撑 ❌"

        mid_term_desc = (
            f"MA60({ma60:.2f}) {'Upward bias' if close > ma60 else 'Under pressure'}" if ma60 else ("Incomplete MA60" if en else "MA60 数据不足")
        ) if en else (
            f"MA60({ma60:.2f}) {'向上' if close > ma60 else '承压'}" if ma60 else "MA60 数据不足"
        )

        rsi = data.get('rsi', 50)
        if rsi > 70:
            rsi_desc = "Overbought" if en else "超买 (Overbought)"
            rsi_score = -1
        elif rsi < 30:
            rsi_desc = "Oversold" if en else "超卖 (Oversold)"
            rsi_score = 1
        else:
            rsi_desc = "Neutral" if en else "中性区间"
            rsi_score = 0

        k, d, j = data.get('kdj_k', 50), data.get('kdj_d', 50), data.get('kdj_j', 50)
        if k > d:
            kdj_desc = "K>D golden cross (up)" if en else "K>D 金叉向上"
            kdj_score = 1
        else:
            kdj_desc = "K<D dead cross (down)" if en else "K<D 死叉向下"
            kdj_score = -1

        macd_hist = data.get('macd_hist', 0)
        prev_data = prices[-2] if len(prices) >= 2 else {}
        prev_hist = prev_data.get('macd_hist', 0)

        if macd_hist > 0:
            macd_desc = "Golden cross (bullish)" if en else "金叉 (多头)"
            macd_score = 1
            if macd_hist < prev_hist:
                macd_desc += " ⚠️ Weaker momentum" if en else " ⚠️ 动能减弱"
                macd_score = 0
        else:
            macd_desc = "Dead cross (bearish)" if en else "死叉 (空头)"
            macd_score = -1
            if macd_hist > prev_hist:
                macd_desc += " 💡 Histogram converging" if en else " 💡 快线收敛中"
                macd_score = 0

        b_up = data.get('boll_upper', 0)
        b_mid = data.get('boll_mid', 0)
        b_low = data.get('boll_lower', 0)

        boll_score = 0
        boll_desc = "Invalid / missing bands" if en else "通道无效"
        if b_up and b_low and b_up > b_low:
            pct_b = (close - b_low) / (b_up - b_low) * 100
            if pct_b > 90:
                boll_desc = f"{pct_b:.0f}% ({'Upper band test' if en else '触及上轨压力'})"
                boll_score = -1
            elif pct_b > 70:
                boll_desc = f"{pct_b:.0f}% ({'Strong zone' if en else '强势区'})"
                boll_score = 1
            elif pct_b > 30:
                boll_desc = f"{pct_b:.0f}% ({'Middle buffer' if en else '中轨平衡区'})"
                boll_score = 0
            elif pct_b > 10:
                boll_desc = f"{pct_b:.0f}% ({'Weak zone' if en else '弱势区'})"
                boll_score = -1
            else:
                boll_desc = f"{pct_b:.0f}% ({'Lower band test' if en else '触及下轨支撑'})"
                boll_score = 1

        total_score = trend_score + rsi_score + kdj_score + macd_score + boll_score
        if en:
            score_meaning = (
                "Strongly bullish" if total_score >= 4 else
                "Bullish lean" if total_score > 0 else
                "Strongly bearish" if total_score <= -4 else
                "Bearish lean" if total_score < 0 else
                "Neutral"
            )
        else:
            score_meaning = "强烈看多" if total_score >= 4 else ("偏多" if total_score > 0 else ("强烈看空" if total_score <= -4 else ("偏空" if total_score < 0 else "完全中性")))

        bull_lbl, bear_lbl, flat_lbl = (("Long ✅", "Short ❌", "Flat ➖") if en else ("多 ✅", "空 ❌", "平 ➖"))

        def _dir(score: int) -> str:
            return bull_lbl if score > 0 else (bear_lbl if score < 0 else flat_lbl)

        if en:
            return f"""### Step 2: Daily technical dashboard
Analyze using the precomputed quant signals below.

### Trend health
- **MA stack**: {ma_alignment}
- **Price vs MAs**: {price_pos_desc}
- **MA60 context**: {mid_term_desc}

### Momentum
- **MACD**: {macd_desc}
- **RSI**: {rsi:.1f} ({rsi_desc})
- **KDJ**: K{k:.1f}/D{d:.1f} → {kdj_desc}

### Bands
- **Bollinger**: {boll_desc}

### Confluence score
| Factor | Direction | Score |
|--------|-----------|-------|
| Trend | {_dir(trend_score)} | {trend_score:+d} |
| MACD | {_dir(macd_score)} | {macd_score:+d} |
| RSI | {_dir(rsi_score)} | {rsi_score:+d} |
| KDJ | {_dir(kdj_score)} | {kdj_score:+d} |
| Bands | {_dir(boll_score)} | {boll_score:+d} |

**Total: {total_score:+d} ({score_meaning})**

## Tasks
1. Confirm the composite score ({total_score:+d}).
2. Which factor adds the most / subtracts the most?
3. Is this a "clean bullish pass" or a choppy / qualified bullish stance?
"""

        return f"""### 步骤2：日线技术面深度解析 (World-Class Signal Dashboard)
请基于以下计算好的量化信号进行分析：

### 📊 趋势健康度
- **均线排列**: {ma_alignment}
- **价格位置**: {price_pos_desc}
- **中期趋势**: {mid_term_desc}

### ⚡ 动能状态
- **MACD**: {macd_desc}
- **RSI**: {rsi:.1f} ({rsi_desc})
- **KDJ**: K{k:.1f}/D{d:.1f} → {kdj_desc}

### 📍 价格位置
- **布林带**: {boll_desc}

### 🎯 信号共振评估 (Confluence Score)
| 维度 | 信号方向 | 数值 |
|------|----------|------|
| 趋势 | {_dir(trend_score)} | {trend_score:+d} |
| MACD | {_dir(macd_score)} | {macd_score:+d} |
| RSI  | {_dir(rsi_score)} | {rsi_score:+d} |
| KDJ  | {_dir(kdj_score)} | {kdj_score:+d} |
| 位置 | {_dir(boll_score)} | {boll_score:+d} |

**综合评分: {total_score:+d} ({score_meaning})**

## 任务指令
1. 确认当前的综合评分是多少？({total_score:+d})
2. 哪个指标是最大的加分项？哪个是减分项？
3. 这是一个“完美多头”通过，还是有瑕疵的“震荡偏多”？
"""

    async def parse_response(self, response: str, context: ChainContext):
        context.artifacts["indicator"] = response
        context.structured_memory["technical_insight"] = response[:1500]


class MultiPeriodStep(BaseStep):
    """
    Step 3: Multi-period Confirmation.
    Checks Weekly/Monthly trends to filter out daily noise.
    """
    async def build_prompt(self, context: ChainContext) -> str:
        locale = context.locale or "cn"
        en = locale == "en"
        w_prices = context.input_data.get('weekly_prices', [])
        m_prices = context.input_data.get('monthly_prices', [])

        last_w = w_prices[0] if w_prices else {}
        last_m = m_prices[0] if m_prices else {}

        w_bull = last_w.get('close', 0) > last_w.get('ma20', 99999)
        trend_w = ("Bullish weekly structure" if w_bull else "Bearish / corrective weekly") if en else ("多头排列" if w_bull else "空头/调整")

        if en:
            return f"""### Step 3: Multi-timeframe check
Use weekly/monthly context to reduce daily noise.

## Weekly (swing)
- **Close**: {last_w.get('close', 'N/A')}
- **MA20**: {last_w.get('ma20', 'N/A')}
- **MACD histogram**: {last_w.get('macd_hist', 'N/A')}
- **State**: {trend_w}

## Monthly (long horizon)
- **Close**: {last_m.get('close', 'N/A')}
- **MA20**: {last_m.get('ma20', 'N/A')}
- **MACD histogram**: {last_m.get('macd_hist', 'N/A')}

## Tasks
1. If daily looks bullish, does weekly agree? If daily rips but weekly is below MA20, label it as bounce risk vs reversal.
2. Where is price within the monthly range (high vs low regime)?
3. If daily vs weekly conflict, prioritize weekly for direction.
4. Output a concise multi-timeframe verdict (e.g., "Daily bounce, weekly bearish → wait").
"""

        return f"""### 步骤3：多周期共振验证
为了避免"日线骗线"，我们需要检查周线和月线的大趋势。

## 1. 周线数据 (中线趋势)
- **收盘**: {last_w.get('close', 'N/A')}
- **MA20 (周线生命线)**: {last_w.get('ma20', 'N/A')}
- **MACD柱**: {last_w.get('macd_hist', 'N/A')}
- **趋势状态**: {trend_w}

## 2. 月线数据 (长线格局)
- **收盘**: {last_m.get('close', 'N/A')}
- **MA20**: {last_m.get('ma20', 'N/A')}
- **MACD柱**: {last_m.get('macd_hist', 'N/A')}

## 任务指令
1. **共振检查**：日线看涨，周线是否也看涨？如果日线涨但周线被MA20压制，则可能是"反弹"而非"反转"。
2. **位置评估**：当前股价处于历史（月线）的高位还是低位？
3. **矛盾裁决**：如果日线和周线冲突，以周线（中线趋势）为准。
4. **输出结论**：给出「多周期综合评级」（例如：日线反弹，周线空头，建议观望）。
"""

    async def parse_response(self, response: str, context: ChainContext):
        context.artifacts["multi_period"] = response
        context.structured_memory["period_insight"] = response[:300]
