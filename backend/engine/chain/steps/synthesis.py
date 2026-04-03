import json
import re
from typing import Dict, Any
from .base import BaseStep, StepExecutionError
from engine.chain.context import ChainContext
from engine.analysis.technical import TechnicalAnalyzer

class SynthesisStep(BaseStep):
    """
    Step 4: Synthesis & JSON Generation.
    The final arbiter that produces the structured signal.
    """
    async def build_prompt(self, context: ChainContext) -> str:
        d = context.input_data
        ai_history = d.get('ai_history', [])
        layer1 = d.get('layer1') or {}
        layer1_status = str(layer1.get('status') or "")
        locale = context.locale

        if locale == 'en':
            layer1_signal = {"TriggeredLong": "Long", "Watch": "Side", "NoSetup": "Side", "RiskOff": "Side"}.get(layer1_status, "Side")
            if layer1_status:
                layer1_instruction = (
                    f"\n## Layer-1 System Verdict (Hard Constraint)\n"
                    f"- Quant Status: {layer1_status}\n"
                    f"- System Signal: {layer1_signal}\n"
                    f"- Note: Direction is fixed by Layer-1. You are responsible for explanation and tactics ONLY. Do not change the direction."
                )
            else:
                layer1_instruction = ""
        else:
            layer1_signal = self._layer1_to_signal(layer1_status)
            if layer1_status:
                layer1_instruction = (
                    f"\n## Layer-1 系统裁决（硬约束）\n"
                    f"- 量化状态: {layer1_status}\n"
                    f"- 系统信号: {layer1_signal}\n"
                    f"- 说明: 方向已由 Layer-1 决定，你只负责解释与战术，不得改写方向。"
                )
            else:
                layer1_instruction = ""
        
        # --- Dynamic Key Levels Calculation ---
        daily_prices = d.get('daily_prices', [])
        latest = daily_prices[-1] if daily_prices else {}
        
        boll_lower = latest.get('boll_lower', 0) or 0
        boll_upper = latest.get('boll_upper', 0) or 0
        boll_mid = latest.get('boll_mid', 0) or 0
        ma20 = latest.get('ma20', 0) or 0
        close = latest.get('close', 0) or 0
        
        # Calculate 10-day high/low for reference
        high_10d = max([p.get('high', 0) for p in daily_prices[-10:]]) if daily_prices else 0
        low_10d = min([p.get('low', float('inf')) for p in daily_prices[-10:]]) if daily_prices else 0
        stop_ref = boll_lower * 0.97 if boll_lower > 0 else close * 0.95

        stop_ref = boll_lower * 0.97 if boll_lower > 0 else close * 0.95

        # --- Indicator Pre-calculation (Anti-Hallucination) ---
        # Hybrid Architecture: Use TechnicalAnalyzer for Quant-verified facts
        technical_facts = ""
        if self.config.get("inject_hard_facts", False):
            try:
                # Use the complete analysis module
                analyzer = TechnicalAnalyzer()
                # Assuming daily_prices format matches what TechnicalAnalyzer expects
                metrics = analyzer.analyze(daily_prices)
                technical_facts = analyzer.generate_fact_sheet(metrics)
            except Exception as e:
                # Fallback to empty if analyzer fails (should not happen)
                technical_facts = f"\n<!-- Technical Analysis Failed: {str(e)} -->\n"

        # Build AI review section
        prediction_review = ""
        if ai_history:
            rows = []
            for pred in ai_history:
                if locale == 'en':
                    signal_label = pred['signal']
                    status_icon = "✅" if pred['validation_status'] == "Correct" else ("❌" if pred['validation_status'] == "Incorrect" else "➖")
                    rows.append(f"| {pred['date']} | {signal_label} | {pred['confidence']:.0%} | {status_icon} | {pred.get('actual_change', 'N/A')}% |")
                else:
                    signal_cn = {"Long": "做多", "Side": "观望", "Short": "避险"}.get(pred['signal'], pred['signal'])
                    status_icon = "✅" if pred['validation_status'] == "Correct" else ("❌" if pred['validation_status'] == "Incorrect" else "➖")
                    rows.append(f"| {pred['date']} | {signal_cn} | {pred['confidence']:.0%} | {status_icon} | {pred.get('actual_change', 'N/A')}% |")
            
            if locale == 'en':
                prediction_review = f"""
## AI History Review
| Date | Signal | Confidence | Result | Actual Chg |
|------|--------|------------|--------|------------|
{chr(10).join(rows)}
Historical Accuracy: {d.get('accuracy', {}).get('rate', 0):.1f}%
"""
            else:
                prediction_review = f"""
## AI 历史预测回顾
| 预测日期 | 信号 | 置信度 | 结果 | 实际涨跌 |
|----------|------|--------|------|----------|
{chr(10).join(rows)}
历史准确率: {d.get('accuracy', {}).get('rate', 0):.1f}%
"""

        # Context Consolidation: Inject summarized insights
        if locale == 'en':
            prior_analysis = f"""
## Prior Analysis Insights (Must aggregate into final JSON)
- Data Anchor: {context.structured_memory.get('anchor_summary', 'Normal')[:100]}
- Daily Technicals: {context.structured_memory.get('technical_insight', 'Trend unclear')[:150]}  
- Multi-period Sync: {context.structured_memory.get('period_insight', 'No conflict')[:150]}

{technical_facts}

## Pre-calculated Key Levels (Use directly)
- **Support**: {boll_lower:.2f} (Bollinger Lower Band)
- **Resistance**: {high_10d:.2f} (10-day High)
- **Stop Loss**: {stop_ref:.2f} (3% or 5% below support)
"""
        else:
            prior_analysis = f"""
## 前序分析结论摘要（必须整合到最终JSON）
- 数据锚定: {context.structured_memory.get('anchor_summary', '正常')[:100]}
- 日线技术: {context.structured_memory.get('technical_insight', '趋势未明')[:150]}  
- 多周期验证: {context.structured_memory.get('period_insight', '无冲突')[:150]}

{technical_facts}

## 预计算的关键价位（直接使用，无需重新计算）
- **支撑位 (support)**: {boll_lower:.2f} (布林下轨参考)
- **阻力位 (resistance)**: {high_10d:.2f} (10日高点参考)
- **止损位 (stop_loss)**: {stop_ref:.2f} (支撑位下方3%或5%)
"""

        # --- HUNYUAN-LITE OPTIMIZATION (Translator Mode) ---
        model_name = d.get('model_name', '').lower()
        if 'lite' in model_name:
            # 1. Extract Score from prior_analysis (Python-side Logic)
            import re
            score_match = re.search(r"综合评分:\s*([+\-]?\d+)", prior_analysis)
            calculated_signal = layer1_signal if layer1_status else "Side"
            calculated_conf = 0.5
            score_val = 0
            
            if score_match:
                try:
                    score_val = int(score_match.group(1))
                    abs_score = abs(score_val)
                    
                    # Signal Logic: when Layer-1 exists, direction is fixed by system.
                    if not layer1_status:
                        if score_val >= 4: calculated_signal = "Long"
                        elif score_val <= -4: calculated_signal = "Short"
                        else: calculated_signal = "Side"
                    
                    # Confidence Logic (Deterministic)
                    if abs_score >= 4: calculated_conf = 0.85
                    elif abs_score >= 2: calculated_conf = 0.65
                    else: calculated_conf = 0.50
                except:
                    pass

            # 2. Determine strategy based on score direction
            if locale == 'en':
                if score_val > 0:
                    holding_action = "Hold & Observe"
                    holding_trigger = f"Break below {boll_lower:.2f}"
                    empty_action = "Buy on Dips"
                elif score_val < 0:
                    holding_action = "Reduce on Rallies"
                    holding_trigger = f"Rally to {high_10d:.2f}"
                    empty_action = "Wait & Watch"
                else:
                    holding_action = "Neutral Hold"
                    holding_trigger = "Wait for dir confirmation"
                    empty_action = "Watch"
                
                if score_val > 0:
                    decision_conclusion = "Bullish/Watch"
                    conflict_text = "Short-term bullish but waiting for confirmation"
                    focus_text = f"Can price break {high_10d:.2f} resistance"
                elif score_val < 0:
                    decision_conclusion = "Bearish/RiskOff"
                    conflict_text = "Technical weakness, priority is defense"
                    focus_text = f"Can price hold {boll_lower:.2f} support"
                else:
                    decision_conclusion = "Neutral/Watch"
                    conflict_text = "Balanced forces, waiting for directional choice"
                    focus_text = "Volume changes to confirm direction"
            else:
                if score_val > 0:
                    holding_action = "持股观察"
                    holding_trigger = f"跌破{boll_lower:.2f}"
                    empty_action = "逢低介入"
                elif score_val < 0:
                    holding_action = "逢高减仓"
                    holding_trigger = f"反弹至{high_10d:.2f}"
                    empty_action = "观望等待"
                else:
                    holding_action = "持股待变"
                    holding_trigger = f"方向确认后"
                    empty_action = "观望"
                
                if score_val > 0:
                    decision_conclusion = "偏多观望"
                    conflict_text = "短期技术面偏多，但等待更强确认信号"
                    focus_text = f"关注能否突破{high_10d:.2f}阻力"
                elif score_val < 0:
                    decision_conclusion = "偏空避险"
                    conflict_text = "技术面转弱，以防守为主"
                    focus_text = f"关注能否守住{boll_lower:.2f}支撑"
                else:
                    decision_conclusion = "中性观望"
                    conflict_text = "多空力量均衡，等待方向选择"
                    focus_text = "关注成交量变化确认方向"

            if locale == 'en':
                prompt = f"""### Task: Quant Signal Translation (Zero-Shot JSON Generation)
You are a **Financial Data Translator**. Please translate the following analysis data into JSON format.

{prediction_review}

{prior_analysis}
{layer1_instruction}

---
## ⚠️ Data Anchors (CRITICAL - Use EXACT values)
- **Current Close**: {close:.2f}
- **MA20**: {ma20:.2f}
- **Support**: {boll_lower:.2f}
- **Resistance**: {high_10d:.2f}
- **Stop Loss**: {stop_ref:.2f}
- **Final Score**: {score_val:+d}
---

## Mandatory Fields (Pre-calculated, fill directly and keep format)
```json
{{
  "signal": "{calculated_signal}",
  "confidence": {calculated_conf},
  "key_levels": {{ 
    "immediate_support": [{boll_lower:.2f}], 
    "immediate_resistance": [{high_10d:.2f}], 
    "stop_loss_reference": {stop_ref:.2f} 
  }},
  "tactics": {{
    "holding_profit": [{{ "priority": "P1", "action": "{holding_action}", "trigger": "{holding_trigger}", "target_price": {high_10d:.2f}, "stop_advance_price": {close:.2f}, "reason": "Technical trigger" }}],
    "holding_loss": [{{ "priority": "P1", "action": "Scale out", "trigger": "Break below {boll_lower:.2f}", "stop_loss_price": {stop_ref:.2f}, "reason": "Stop loss triggered" }}],
    "empty": [{{ "priority": "P1", "action": "{empty_action}", "trigger": "Price stabilizes", "buy_zone_price": {boll_lower:.2f}, "reason": "Seeking safety margin" }}]
  }},
  "counter_argument": "If close falls below {stop_ref:.2f} on high volume, the {calculated_signal} logic is invalidated.",
  "news_analysis": ["No real-time news"],
  "conflict_resolution": "{conflict_text}",
  "tomorrow_focus": "{focus_text}"
}}
```

## Fields to Supplement
**Only fill the following 3 fields**, and merge them with the mandatory ones into a **complete, valid JSON**:
1. `"summary"`: One simple sentence summarizing the current trend (Must be based on score {score_val:+d}).
2. `"reasoning_trace"`: List containing exactly 3 objects:
   - {{ "step": "trend", "data": "Extract MA5/MA10/MA20 values and status from above", "conclusion": "Trend assessment" }}
   - {{ "step": "momentum", "data": "Extract MACD hist/RSI/KDJ from above", "conclusion": "Momentum assessment" }}
   - {{ "step": "decision", "data": "Verdict reason after score {score_val:+d}", "conclusion": "{decision_conclusion}" }}
3. `"signal"`: "{calculated_signal}" (Keep as is)

Directly output the full JSON. All text values must be in double quotes.
"""
            else:
                prompt = f"""### 任务：量化信号翻译 (Zero-Shot JSON Generation)
你是一个**金融数据翻译官**。请将下方的分析数据翻译成 JSON 格式。

{prediction_review}

{prior_analysis}
{layer1_instruction}

---
## ⚠️ 数据锚定校验 (CRITICAL - 必须使用以下数值)
- **当前收盘价**: {close:.2f}
- **MA20**: {ma20:.2f}
- **支撑位**: {boll_lower:.2f}
- **阻力位**: {high_10d:.2f}
- **止损位**: {stop_ref:.2f}
- **综合评分**: {score_val:+d}
---

## 强制执行字段 (系统已计算，请直接填入并保持格式稳定，不要修改这些 Key 的值)
```json
{{
  "signal": "{calculated_signal}",
  "confidence": {calculated_conf},
  "key_levels": {{ 
    "immediate_support": [{boll_lower:.2f}], 
    "immediate_resistance": [{high_10d:.2f}], 
    "stop_loss_reference": {stop_ref:.2f} 
  }},
  "tactics": {{
    "holding_profit": [{{ "priority": "P1", "action": "{holding_action}", "trigger": "{holding_trigger}", "target_price": {high_10d:.2f}, "stop_advance_price": {close:.2f}, "reason": "技术面触发" }}],
    "holding_loss": [{{ "priority": "P1", "action": "分批减仓", "trigger": "跌破{boll_lower:.2f}", "stop_loss_price": {stop_ref:.2f}, "reason": "触发止损防线" }}],
    "empty": [{{ "priority": "P1", "action": "{empty_action}", "trigger": "价格企稳", "buy_zone_price": {boll_lower:.2f}, "reason": "寻找安全边际" }}]
  }},
  "counter_argument": "如果收盘价跌破 {stop_ref:.2f} 且成交量放大，则原有{calculated_signal}逻辑失效。",
  "news_analysis": ["无实时新闻"],
  "conflict_resolution": "{conflict_text}",
  "tomorrow_focus": "{focus_text}"
}}
```

## 需要你补充填写的字段
**仅需填写以下 3 个字段**，请将它们与上方强制执行的字段组合成一个**完整且合法的 JSON**：
1. `"summary"`: 用简浅的一句话总结当前走势（必须基于评分{score_val:+d}）。
2. `"reasoning_trace"`: 必须输出包含以下 3 个核心对象的列表：
   - {{ "step": "trend", "data": "从上方提取 MA5/MA10/MA20 数值及均线状态", "conclusion": "趋势评估" }}
   - {{ "step": "momentum", "data": "从上方提取 MACD 柱状值/RSI 数值/KDJ 状态", "conclusion": "动能评估" }}
   - {{ "step": "decision", "data": "综合评分{score_val:+d}后的裁决理由", "conclusion": "{decision_conclusion}" }}
3. `"signal"`: "{calculated_signal}" (保持原样)

请直接输出完整 JSON。注意：**所有文本值必须用双引号括起来**。
"""
            return prompt



        # --- STANDARD PROMPT (Analyst Mode) ---
        if locale == 'en':
            prompt = f"""### Step 4: Final Conclusion Derivation (Synthesis)
Integrate all information (Daily/Weekly/Monthly) to generate the final trading recommendation.
{prediction_review}
{prior_analysis}
{layer1_instruction}

## Core Logic (Conservative Trader)
1. **Risk Aversion**: As long as there is "divergence" or "multi-period conflict", default to "Side" (Watch).
2. **Quality over Quantity**: No "Long" unless there is 80% confidence (Day/Week alignment + volume support).

## Full Output Example (Strictly follow this format)
{{
  "signal": "Side",
  "confidence": 0.7,
  "summary": "Price is in overbought zone, MACD death cross suggests weakening momentum",
  "reasoning_trace": [
    {{ "step": "trend", "data": "MA5/10/20 in bearish alignment, price retraces to MA60 support", "conclusion": "Trend reversal" }},
    {{ "step": "momentum", "data": "MACD highly converged with golden cross omen, RSI retraces near 40 and stabilizes", "conclusion": "Momentum bottoming" }},
    {{ "step": "levels", "data": "Support at 6.06 density zone, resistance at 10-day MA 6.29", "conclusion": "Limited space" }},
    {{ "step": "context", "data": "Market sentiment is low, but sector performs stronger than benchmark showing resilience", "conclusion": "Strong defense" }},
    {{ "step": "decision", "data": "Verdict: Indicators recovering but lacks significant volume confirmation, maintain Watch", "conclusion": "Watch" }}
  ],
  "key_levels": {{ "support": 588.52, "resistance": 638.5, "stop_loss": 571.07 }},
  "tactics": {{
    "holding": [{{ "priority": "P1", "action": "Trim", "trigger": "Break below MA20", "reason": "Weakening momentum" }}],
    "empty": [{{ "priority": "P1", "action": "Watch", "trigger": "Wait for dip and stabilization", "reason": "Overbought risk" }}],
    "general": [{{ "priority": "P2", "action": "Watch support", "trigger": "Retrace near 588", "reason": "Can try re-entry if stabilized" }}]
  }},
  "news_analysis": ["No real-time news input"],
  "conflict_resolution": "Short-term overbought vs medium-term bullish trend, taking watch strategy",
  "tomorrow_focus": "Watch if MA20 support holds valid"
}}

## Output Requirements
Must output pure JSON format, strictly following the example Schema above:
1. `reasoning_trace.data` must contain actual values (e.g. MA20=xxx), NO placeholders.
2. `reasoning_trace.conclusion` must be a short label (3-6 words).
3. `key_levels` use pre-calculated values above.
4. `tactics` must provide one suggestion for each: holding/empty/general.
"""
        else:
            prompt = f"""### 步骤4：最终结论推导 (Synthesis)
整合所有信息（日线/周线/月线），生成最终操作建议。
{prediction_review}
{prior_analysis}
{layer1_instruction}

## 核心逻辑 (Conservative Trader)
1. **风险厌恶**：只要有"背离"或"多周期冲突"，默认"Side"（观望）。
2. **宁缺毋滥**：没有80%把握（日周共振+量能配合），不要给"Long"。

## 完整输出示例（请严格参考此格式）
{{
  "signal": "Side",
  "confidence": 0.7,
  "summary": "股价处于超买区间，MACD死叉提示动能减弱",
  "reasoning_trace": [
    {{ "step": "trend", "data": "MA5/10/20呈空头排列，价格回撤至MA60支撑位附近", "conclusion": "趋势转向" }},
    {{ "step": "momentum", "data": "MACD高度收敛且出现金叉预兆，RSI回撤至40附近企稳", "conclusion": "动能筑底" }},
    {{ "step": "levels", "data": "下方支撑位在6.06密集区，上方阻力位于10日均线6.29处", "conclusion": "空间受限" }},
    {{ "step": "context", "data": "大盘情绪低迷，但个股所属行业表现强于基准，具一定韧性", "conclusion": "防御性强" }},
    {{ "step": "decision", "data": "综合判断：指标虽低位修复但缺乏显著增量确认，维持观望", "conclusion": "观望" }}
  ],
  "key_levels": {{ "support": 588.52, "resistance": 638.5, "stop_loss": 571.07 }},
  "tactics": {{
    "holding": [{{ "priority": "P1", "action": "减仓", "trigger": "跌破MA20", "reason": "动能减弱" }}],
    "empty": [{{ "priority": "P1", "action": "观望", "trigger": "等待回调企稳", "reason": "超买风险" }}],
    "general": [{{ "priority": "P2", "action": "关注支撑", "trigger": "回调至588附近", "reason": "企稳可尝试接回" }}]
  }},
  "news_analysis": ["无实时新闻输入"],
  "conflict_resolution": "短期超买与中期多头趋势矛盾，采取观望策略",
  "tomorrow_focus": "关注MA20支撑位是否有效"
}}

## 输出要求
必须输出纯 JSON 格式，严格遵守上方示例 Schema：
1. `reasoning_trace.data` 必须填入实际数值（如 MA20=xxx），严禁占位符。
2. `reasoning_trace.conclusion` 必须是简短标签（3-6个字）。
3. `key_levels`使用上方预计算的参考值。
4. `tactics` 必须针对 holding/empty/general 各给出一建议。
"""
        return prompt
    
    async def parse_response(self, response: str, context: ChainContext):
        # Store raw response for debugging/transparency (User Request)
        context.artifacts["synthesis_raw"] = response

        parsed = self._clean_and_parse_json(response)
        
        # --- Post-Processing Fallback Logic ---
        d = context.input_data
        daily_prices = d.get('daily_prices', [])
        latest = daily_prices[-1] if daily_prices else {}
        boll_lower = latest.get('boll_lower', 0) or 0
        ma20 = latest.get('ma20', 0)
        
        # 0. Pre-initialization to prevent KeyError
        if "key_levels" not in parsed:
            parsed["key_levels"] = {}
        
        # 1. Backfill key_levels if missing or incomplete (v3.3 Schema)
        model_name = d.get('model_name', '').lower()
        high_10d = max([p.get('high', 0) for p in daily_prices[-10:]]) if daily_prices else 0
        stop_ref = boll_lower * 0.97 if boll_lower > 0 else (latest.get('close', 0) or 0) * 0.95
        
        if not parsed['key_levels'].get('immediate_support'):
            s1 = round(boll_lower or ma20, 2)
            parsed['key_levels']["immediate_support"] = [s1, round(s1 * 0.985, 2)]
        if not parsed['key_levels'].get('immediate_resistance'):
            r1 = round(high_10d, 2)
            parsed['key_levels']["immediate_resistance"] = [r1, round(r1 * 1.015, 2)]
        if not parsed['key_levels'].get('stop_loss_reference'):
            parsed['key_levels']["stop_loss_reference"] = round(stop_ref, 2)
            
        # 2. Backfill tactics if missing or empty (v3.3 Schema)
        if not parsed.get('tactics') or (not parsed['tactics'].get('holding_profit') and not parsed['tactics'].get('holding')):
            signal = parsed.get('signal', 'Side')
            locale = context.locale
            if locale == 'en':
                base_holding = "Hold & Observe" if signal == "Long" else "Wait & Watch"
                base_empty = "Buy on Dips" if signal == "Long" else "Watch"
                loss_action = "Scale out"
                loss_reason = "Protective stop-loss"
                rebound_action = "Reduce on Rally"
                rebound_reason = "Reduce risk on weakness"
                wait_action = "Watch"
                wait_reason = "Wait for right-side opportunity"
                breakout_action = "Breakout Follow-up"
                breakout_reason = "Confirm before entry"
            else:
                base_holding = "持股观察" if signal == "Long" else "持币观望"
                base_empty = "逢低介入" if signal == "Long" else "观望等待"
                loss_action = "分批减仓"
                loss_reason = "保护性止损"
                rebound_action = "反弹减仓"
                rebound_reason = "弱势反抽先降风险"
                wait_action = "观望等待"
                wait_reason = "等待右侧机会"
                breakout_action = "突破跟随预案"
                breakout_reason = "确认后再入场，避免假突破"
            
            # Get support for trigger
            supp = parsed['key_levels'].get('immediate_support', [0])[0]
            
            resistance_ref = parsed['key_levels'].get('immediate_resistance', [round(high_10d, 2)])[0]
            parsed['tactics'] = {
                "holding_profit": [
                    {
                        "priority": "P1", "action": base_holding, "trigger": f"Above {supp:.2f}" if locale == 'en' else f"不跌破{supp:.2f}",
                        "target_price": round(high_10d, 2), "stop_advance_price": round(latest.get('close', 0), 2), "reason": "Trend Holding" if locale == 'en' else "趋势持仓"
                    },
                    {
                        "priority": "P2", "action": "Take Profit Plan" if locale == 'en' else "分批止盈预案", "trigger": f"Near {resistance_ref:.2f} & weak" if locale == 'en' else f"接近{resistance_ref:.2f}且动能转弱",
                        "target_price": round(resistance_ref * 1.015, 2), "stop_advance_price": round(supp, 2), "reason": "Lock profit, prevent drawdown" if locale == 'en' else "锁定收益，防止回撤"
                    }
                ],
                "holding_loss": [
                    {
                        "priority": "P1", "action": loss_action, "trigger": f"Below {supp:.2f}" if locale == 'en' else f"跌破{supp:.2f}",
                        "stop_loss_price": round(stop_ref, 2), "reason": loss_reason
                    },
                    {
                        "priority": "P2", "action": rebound_action, "trigger": f"Rally to {resistance_ref:.2f} but fail" if locale == 'en' else f"反弹至{resistance_ref:.2f}但未突破",
                        "stop_loss_price": round(stop_ref, 2), "reason": rebound_reason
                    }
                ],
                "empty": [
                    {
                        "priority": "P1", "action": base_empty, "trigger": f"Test {supp:.2f} & stabilize" if locale == 'en' else f"回踩{supp:.2f}企稳",
                        "buy_zone_price": round(boll_lower, 2), "reason": wait_reason
                    },
                    {
                        "priority": "P2", "action": breakout_action, "trigger": f"Break {resistance_ref:.2f} with vol" if locale == 'en' else f"放量突破{resistance_ref:.2f}并站稳",
                        "buy_zone_price": [round(resistance_ref, 2), round(resistance_ref * 1.015, 2)], "reason": breakout_reason
                    }
                ]
            }

        # 3. Ensure other fields exist
        if "conflict_resolution" not in parsed:
            parsed["conflict_resolution"] = (
                "Integrating multi-period indicators and market sentiment for decision." if context.locale == 'en' 
                else "综合多周期指标与市场情绪，当前处于关键决策点。"
            )
        if "tomorrow_focus" not in parsed:
            parsed["tomorrow_focus"] = (
                f"Focus on whether price holds {parsed['key_levels'].get('support', 0):.2f} support." if context.locale == 'en'
                else f"关注价格能否站稳 {parsed['key_levels'].get('support', 0):.2f} 支撑位。"
            )
        if "news_analysis" not in parsed:
            parsed["news_analysis"] = ["No real-time news" if context.locale == 'en' else "无实时新闻输入，仅基于技术面分析"]

        # 4. Backfill signal and confidence if missing or placeholder
        valid_signals = ["Long", "Side", "Short"]
        if not parsed.get('signal') or parsed.get('signal') not in valid_signals:
            # Check if it's a placeholder like "<强制值: Side>"
            parsed['signal'] = 'Side'
        if not parsed.get('confidence') or not isinstance(parsed.get('confidence'), (int, float)):
            parsed['confidence'] = 0.5

        # Layer-1 is the source of truth for direction and action language.
        layer1 = d.get('layer1') or {}
        layer1_status = str(layer1.get('status') or "")
        if layer1_status:
            expected_signal = self._layer1_to_signal(layer1_status)
            if parsed.get('signal') != expected_signal:
                parsed['signal'] = expected_signal
            parsed = self._apply_layer1_action_language(parsed, layer1_status, context.locale)

        # 5. LITE MODEL OVERRIDE: Force pre-calculated values (v3.3 Schema)
        model_name = d.get('model_name', '').lower()
        if 'lite' in model_name:
            s1 = round(boll_lower, 2)
            r1 = round(high_10d, 2)
            parsed['key_levels'] = {
                "immediate_support": [s1, round(s1 * 0.985, 2)],
                "immediate_resistance": [r1, round(r1 * 1.015, 2)],
                "stop_loss_reference": round(stop_ref, 2)
            }
            if "counter_argument" not in parsed:
                parsed["counter_argument"] = f"若价格跌穿 {stop_ref:.2f} 关键位，当前多空判定失效，应立即止损。"
            
        # 6. Normalize reasoning_trace (Fix for Lite models returning dict or string instead of list)
        rt = parsed.get('reasoning_trace')
        if isinstance(rt, dict):
            # Convert dict to standard list format
            new_rt = []
            
            # Extract Trend
            trend_data = rt.get('trend.data') or rt.get('trend') or rt.get('trend_data') or "均线系统分析"
            if isinstance(trend_data, (dict, list)):
                trend_data = str(trend_data)
            new_rt.append({ "step": "trend", "data": trend_data, "conclusion": "趋势跟踪" })
            
            # Extract Momentum
            mom_data = rt.get('momentum.data') or rt.get('momentum') or rt.get('momentum_data') or "MACD/RSI指标分析"
            if isinstance(mom_data, (dict, list)):
                mom_data = str(mom_data)
            new_rt.append({ "step": "momentum", "data": mom_data, "conclusion": "动能评估" })
            
            # Extract Decision
            dec_data = rt.get('decision.data') or rt.get('decision_conclusion') or rt.get('decision') or "综合研判"
            new_rt.append({ "step": "decision", "data": "综合评分模型", "conclusion": str(dec_data) })
            
            parsed['reasoning_trace'] = new_rt
        elif isinstance(rt, str) and rt:
            # Handle string-based trace (common in weak models)
            locale = context.locale
            parts = re.split(r'[；;，,]', rt)
            trend_part = parts[0].strip() if len(parts) > 0 else rt
            mom_part = parts[1].strip() if len(parts) > 1 else ("See trend analysis" if locale == 'en' else "详见趋势分析")
            
            parsed['reasoning_trace'] = [
                { "step": "trend", "data": trend_part, "conclusion": "Trend Observation" if locale == 'en' else "趋势观察" },
                { "step": "momentum", "data": mom_part, "conclusion": "Momentum Monitoring" if locale == 'en' else "动能监测" },
                { "step": "decision", "data": "Combined Analysis" if locale == 'en' else "综合研判", "conclusion": parsed.get('summary', 'Side')[:10] }
            ]
            
        # 7. Final Sanity Check for 6-step reasoning trace (v3.3 requirement)
        rt = parsed.get('reasoning_trace', [])
        locale = context.locale
        if not isinstance(rt, list) or len(rt) < 3:
            if locale == 'en':
                rt = [
                    { "step": "trend", "data": "Comprehensive analysis of moving averages and K-line patterns", "conclusion": "Trend Confirmed" },
                    { "step": "momentum", "data": "MACD/RSI momentum intensity monitoring", "conclusion": "Momentum Assessment" },
                    { "step": "levels", "data": f"Price play near support {boll_lower:.2f}", "conclusion": "Space Pattern" },
                    { "step": "context", "data": "Market environment and sector resonance analysis", "conclusion": "Env Alignment" },
                    { "step": "psychology", "data": "Bull/Bear sentiment and trap identification", "conclusion": "Game Psychology" },
                    { "step": "decision", "data": "Final risk control verdict from above dimensions", "conclusion": parsed.get('signal', 'Side') }
                ]
            else:
                rt = [
                    { "step": "trend", "data": "均线及K线形态综合分析", "conclusion": "趋势确认" },
                    { "step": "momentum", "data": "MACD/RSI 动能强度监测", "conclusion": "动能评估" },
                    { "step": "levels", "data": f"支撑位 {boll_lower:.2f} 附近博弈", "conclusion": "空间格局" },
                    { "step": "context", "data": "大盘环境及板块共振分析", "conclusion": "环境对齐" },
                    { "step": "psychology", "data": "盘面多空情绪与诱多/诱空识别", "conclusion": "博弈心理" },
                    { "step": "decision", "data": "综合以上维度的最终风控裁决", "conclusion": parsed.get('signal', 'Side') }
                ]
        elif len(rt) < 6:
            # If model only provided 3, backfill the others to keep UI consistent
            existing_steps = [s.get('step') for s in rt if isinstance(s, dict)]
            if "levels" not in existing_steps:
                rt.append({ "step": "levels", "data": "Technical play based on support/resistance" if locale == 'en' else "基于支撑阻力位的量价博弈", "conclusion": "Space Pattern" if locale == 'en' else "空间格局" })
            if "context" not in existing_steps:
                rt.append({ "step": "context", "data": "Comprehensive market environment and capital flow analysis" if locale == 'en' else "综合外部环境与资金面流向分析", "conclusion": "Env Resonance" if locale == 'en' else "环境共鸣" })
            if "psychology" not in existing_steps:
                rt.append({ "step": "psychology", "data": "Sentiment monitoring at key nodes" if locale == 'en' else "多空心理博弈与关键节点情绪监测", "conclusion": "Psych Hedge" if locale == 'en' else "心理对敲" })
            
        parsed['reasoning_trace'] = rt

        context.artifacts["synthesis"] = parsed

            
        if "signal" not in parsed:
            raise ValueError("JSON missing 'signal' field")
            
    @staticmethod
    def _layer1_to_signal(setup_state: str) -> str:
        if setup_state == "TriggeredLong":
            return "Long"
        if setup_state in {"NoSetup", "Watch", "RiskOff"}:
            return "Side"
        return "Side"

    @staticmethod
    def _layer1_action_profile(setup_state: str, locale: str = 'cn') -> Dict[str, str]:
        if locale == 'en':
            profiles = {
                "TriggeredLong": {
                    "summary_prefix": "Currently entering potential entry zone",
                    "holding_profit_action": "Hold & Observe",
                    "holding_profit_trigger": "Keep above primary support",
                    "holding_profit_reason": "Price structure supports bullish attempt, hold by discipline.",
                    "holding_loss_action": "Exit on violation",
                    "holding_loss_trigger": "Valid break of primary support",
                    "holding_loss_reason": "Exit when entry logic is broken to avoid larger loss.",
                    "empty_action": "Try entry",
                    "empty_trigger": "Retrace & stabilize or volume confirmation",
                    "empty_reason": "Entry only after right-side confirmation.",
                },
                "Watch": {
                    "summary_prefix": "Focus on observation for now",
                    "holding_profit_action": "Hold & Observe",
                    "holding_profit_trigger": "Observe as long as key support holds",
                    "holding_profit_reason": "Structure not broken but lacks strong confirmation signal.",
                    "holding_loss_action": "Reduce on Rally",
                    "holding_loss_trigger": "Weak rally or break of primary support",
                    "holding_loss_reason": "Reduce risk when confirmation is lacking.",
                    "empty_action": "Continue observation",
                    "empty_trigger": "Wait for breakout or stabilization",
                    "empty_reason": "Wait for confirmation before acting.",
                },
                "RiskOff": {
                    "summary_prefix": "Entering risk contraction zone",
                    "holding_profit_action": "Reduce existing positions",
                    "holding_profit_trigger": "Weak rally or staying below risk line",
                    "holding_profit_reason": "Priority is reducing risk exposure, not increasing it.",
                    "holding_loss_action": "Exit on violation",
                    "holding_loss_trigger": "Valid break of risk line",
                    "holding_loss_reason": "Main task is to stop loss and control drawdown.",
                    "empty_action": "Pause new entries",
                    "empty_trigger": "Wait for recovery above risk line",
                    "empty_reason": "No new entries until risk state is cleared.",
                },
                "NoSetup": {
                    "summary_prefix": "No action recommended for now",
                    "holding_profit_action": "Hold & Observe",
                    "holding_profit_trigger": "No proactive addition before new catalyst",
                    "holding_profit_reason": "No clear new opportunity, stick to existing discipline.",
                    "holding_loss_action": "Trigger reduction",
                    "holding_loss_trigger": "Break below primary support",
                    "holding_loss_reason": "Protect existing positions since no new setup exists.",
                    "empty_action": "No entry recommended",
                    "empty_trigger": "Wait for clear setup formation",
                    "empty_reason": "Observation is the action when no setup is present.",
                },
            }
        else:
            profiles = {
                "TriggeredLong": {
                    "summary_prefix": "当前进入可尝试建仓区间",
                    "holding_profit_action": "持仓观察",
                    "holding_profit_trigger": "不跌破一防位",
                    "holding_profit_reason": "量价结构仍支持多头尝试，先按纪律持有。",
                    "holding_loss_action": "跌破纪律位应退出",
                    "holding_loss_trigger": "有效跌破一防位",
                    "holding_loss_reason": "入场逻辑被破坏时先退出，避免小错拖大。",
                    "empty_action": "可尝试建仓",
                    "empty_trigger": "回踩企稳或放量确认",
                    "empty_reason": "只在右侧确认后试仓，不做主观抄底。",
                },
                "Watch": {
                    "summary_prefix": "当前仅适合继续观察",
                    "holding_profit_action": "持仓观察",
                    "holding_profit_trigger": "不破关键支撑先观察",
                    "holding_profit_reason": "结构未坏，但仍缺少更强确认信号。",
                    "holding_loss_action": "反弹减仓",
                    "holding_loss_trigger": "反抽无力或跌破一防位",
                    "holding_loss_reason": "确认不足时先降风险，不抢方向。",
                    "empty_action": "继续观察",
                    "empty_trigger": "等待放量突破或回踩企稳",
                    "empty_reason": "先看确认，再决定是否出手。",
                },
                "RiskOff": {
                    "summary_prefix": "当前进入风险收缩区",
                    "holding_profit_action": "已有仓位应收缩",
                    "holding_profit_trigger": "反弹无力或仍处风险线下方",
                    "holding_profit_reason": "优先收缩风险暴露，而不是继续加码。",
                    "holding_loss_action": "跌破纪律位应退出",
                    "holding_loss_trigger": "有效跌破风险线",
                    "holding_loss_reason": "当前核心任务是止损和控回撤。",
                    "empty_action": "暂停新增仓位",
                    "empty_trigger": "等待重新站回风险线之上",
                    "empty_reason": "风险状态未解除前，不建议新开仓。",
                },
                "NoSetup": {
                    "summary_prefix": "当前不建议出手",
                    "holding_profit_action": "持仓观察",
                    "holding_profit_trigger": "无新增催化前不主动加仓",
                    "holding_profit_reason": "没有清晰新机会，先守住已有纪律。",
                    "holding_loss_action": "触发减仓",
                    "holding_loss_trigger": "跌破一防位",
                    "holding_loss_reason": "既然没有新 setup，就更要保护已有仓位。",
                    "empty_action": "不建议出手",
                    "empty_trigger": "等待明确 setup 形成",
                    "empty_reason": "没有 setup 的时候，观望就是动作。",
                },
            }
        return profiles.get(setup_state, profiles["NoSetup"])

    def _apply_layer1_action_language(self, parsed: Dict[str, Any], setup_state: str, locale: str = 'cn') -> Dict[str, Any]:
        profile = self._layer1_action_profile(setup_state, locale)
        summary = str(parsed.get("summary") or "").strip()
        summary_prefix = f"{profile['summary_prefix']}." if locale == 'en' else f"{profile['summary_prefix']}。"
        parsed["summary"] = f"{summary_prefix}{summary}"[:160] if summary else summary_prefix[:160]

        tactics = parsed.setdefault("tactics", {})
        for bucket in ("holding_profit", "holding_loss", "empty"):
            items = tactics.get(bucket)
            if not isinstance(items, list) or not items:
                tactics[bucket] = [{}]

        holding_profit = tactics["holding_profit"][0]
        holding_profit["action"] = profile["holding_profit_action"]
        holding_profit["trigger"] = profile["holding_profit_trigger"]
        holding_profit["reason"] = profile["holding_profit_reason"]

        holding_loss = tactics["holding_loss"][0]
        holding_loss["action"] = profile["holding_loss_action"]
        holding_loss["trigger"] = profile["holding_loss_trigger"]
        holding_loss["reason"] = profile["holding_loss_reason"]

        empty = tactics["empty"][0]
        empty["action"] = profile["empty_action"]
        empty["trigger"] = profile["empty_trigger"]
        empty["reason"] = profile["empty_reason"]
        return parsed

    
    def _clean_and_parse_json(self, text: str) -> Dict[str, Any]:
        """
        Robust JSON parser for messy LLM output.
        """
        # 1. Strip markdown code blocks
        text = re.sub(r"```json\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"```", "", text)
        text = text.strip()
        
        # 2. Extract JSON object if embedded in text
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            text = text[start : end + 1]

        try:     
            return json.loads(text)
        except json.JSONDecodeError as e:
            # Try to fix unquoted string values (common weak model error)
            # Pattern: Field: Value (where Value is not quoted and not a number/bool/null/object/array)
            # We look for: Key (quoted) : Value (no quote, no digit, no { [ t f n -)
            try:
                from loguru import logger
                logger.warning(f"Initial JSON parse failed, attempting regex repair. Error: {e}")
                
                # Regex Explanation:
                # ("\w+") : Key
                # \s*:\s* : Separator
                # ([^"\d{\[\s\-tfn][^,}\]]*) : Value. 
                #    Start must NOT be quote, digit, {, [, whitespace, -, t(rue), f(alse), n(ull).
                #    Rest must capture until comma or closing brace
                # ([,}]) : End separator
                pattern = r'("\w+")\s*:\s*([^"\d{\[\s\-tfn][^,}\]]*)([,}])' 
                
                fixed_text = re.sub(pattern, r'\1: "\2"\3', text)
                return json.loads(fixed_text)
            except Exception as e2:
                # Retry mechanism handles exceptions at step level
                raise StepExecutionError(self.step_name, f"Failed to parse JSON: {e}. Repair failed: {e2}")
