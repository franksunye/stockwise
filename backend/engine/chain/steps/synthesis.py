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
        layer1_signal = self._layer1_to_signal(layer1_status)
        layer1_instruction = ""
        if layer1_status:
            layer1_instruction = (
                f"\n## Layer-1 系统裁决（硬约束）\n"
                f"- 量化状态: {layer1_status}\n"
                f"- 系统信号: {layer1_signal}\n"
                f"- 说明: 方向已由 Layer-1 决定，你只负责解释与战术，不得改写方向。"
            )
        
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
                signal_cn = {"Long": "做多", "Side": "观望", "Short": "避险"}.get(pred['signal'], pred['signal'])
                status_icon = "✅" if pred['validation_status'] == "Correct" else ("❌" if pred['validation_status'] == "Incorrect" else "➖")
                rows.append(f"| {pred['date']} | {signal_cn} | {pred['confidence']:.0%} | {status_icon} | {pred.get('actual_change', 'N/A')}% |")
            
            prediction_review = f"""
## AI 历史预测回顾
| 预测日期 | 信号 | 置信度 | 结果 | 实际涨跌 |
|----------|------|--------|------|----------|
{chr(10).join(rows)}
历史准确率: {d.get('accuracy', {}).get('rate', 0):.1f}%
"""

        # Context Consolidation: Inject summarized insights
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
            # Pre-calculate decision and conflict resolution
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
            base_holding = "持股观察" if signal == "Long" else "持币观望"
            base_empty = "逢低介入" if signal == "Long" else "观望等待"
            
            # Get support for trigger
            supp = parsed['key_levels'].get('immediate_support', [0])[0]
            
            resistance_ref = parsed['key_levels'].get('immediate_resistance', [round(high_10d, 2)])[0]
            parsed['tactics'] = {
                "holding_profit": [
                    {
                        "priority": "P1", "action": base_holding, "trigger": f"不跌破{supp:.2f}",
                        "target_price": round(high_10d, 2), "stop_advance_price": round(latest.get('close', 0), 2), "reason": "趋势持仓"
                    },
                    {
                        "priority": "P2", "action": "分批止盈预案", "trigger": f"接近{resistance_ref:.2f}且动能转弱",
                        "target_price": round(resistance_ref * 1.015, 2), "stop_advance_price": round(supp, 2), "reason": "锁定收益，防止回撤"
                    }
                ],
                "holding_loss": [
                    {
                        "priority": "P1", "action": "触发减仓", "trigger": f"跌破{supp:.2f}",
                        "stop_loss_price": round(stop_ref, 2), "reason": "保护性止损"
                    },
                    {
                        "priority": "P2", "action": "反弹减仓", "trigger": f"反弹至{resistance_ref:.2f}但未突破",
                        "stop_loss_price": round(stop_ref, 2), "reason": "弱势反抽先降风险"
                    }
                ],
                "empty": [
                    {
                        "priority": "P1", "action": base_empty, "trigger": f"回踩{supp:.2f}企稳",
                        "buy_zone_price": round(boll_lower, 2), "reason": "等待右侧机会"
                    },
                    {
                        "priority": "P2", "action": "突破跟随预案", "trigger": f"放量突破{resistance_ref:.2f}并站稳",
                        "buy_zone_price": [round(resistance_ref, 2), round(resistance_ref * 1.015, 2)], "reason": "确认后再入场，避免假突破"
                    }
                ]
            }

        # 3. Ensure other fields exist
        if "conflict_resolution" not in parsed:
            parsed["conflict_resolution"] = "综合多周期指标与市场情绪，当前处于关键决策点。"
        if "tomorrow_focus" not in parsed:
            parsed["tomorrow_focus"] = f"关注价格能否站稳 {parsed['key_levels'].get('support', 0):.2f} 支撑位。"
        if "news_analysis" not in parsed:
            parsed["news_analysis"] = ["无实时新闻输入，仅基于技术面分析"]

        # 4. Backfill signal and confidence if missing or placeholder
        valid_signals = ["Long", "Side", "Short"]
        if not parsed.get('signal') or parsed.get('signal') not in valid_signals:
            # Check if it's a placeholder like "<强制值: Side>"
            parsed['signal'] = 'Side'
        if not parsed.get('confidence') or not isinstance(parsed.get('confidence'), (int, float)):
            parsed['confidence'] = 0.5

        # Layer-1 is the source of truth for direction.
        layer1 = d.get('layer1') or {}
        layer1_status = str(layer1.get('status') or "")
        if layer1_status:
            expected_signal = self._layer1_to_signal(layer1_status)
            if parsed.get('signal') != expected_signal:
                parsed['signal'] = expected_signal
                parsed['summary'] = (
                    f"[Layer-1裁决:{layer1_status}] " + str(parsed.get('summary', ''))
                )[:120]

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
            # Try to split by semicolon or comma to separate trend from momentum
            parts = re.split(r'[；;，,]', rt)
            trend_part = parts[0].strip() if len(parts) > 0 else rt
            mom_part = parts[1].strip() if len(parts) > 1 else "详见趋势分析"
            
            parsed['reasoning_trace'] = [
                { "step": "trend", "data": trend_part, "conclusion": "趋势观察" },
                { "step": "momentum", "data": mom_part, "conclusion": "动能监测" },
                { "step": "decision", "data": "综合研判", "conclusion": parsed.get('summary', '观望')[:10] }
            ]
            
        # 7. Final Sanity Check for 6-step reasoning trace (v3.3 requirement)
        rt = parsed.get('reasoning_trace', [])
        if not isinstance(rt, list) or len(rt) < 3:
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
                rt.append({ "step": "levels", "data": "基于支撑阻力位的量价博弈", "conclusion": "空间格局" })
            if "context" not in existing_steps:
                rt.append({ "step": "context", "data": "综合外部环境与资金面流向分析", "conclusion": "环境共鸣" })
            if "psychology" not in existing_steps:
                rt.append({ "step": "psychology", "data": "多空心理博弈与关键节点情绪监测", "conclusion": "心理对冲" })
            
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

