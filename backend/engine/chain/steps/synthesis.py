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
            calculated_signal = "Side" # Default
            calculated_conf = 0.5
            score_val = 0
            
            if score_match:
                try:
                    score_val = int(score_match.group(1))
                    abs_score = abs(score_val)
                    
                    # Signal Logic
                    if score_val >= 4: calculated_signal = "Long"
                    elif score_val <= -4: calculated_signal = "Short"
                    else: calculated_signal = "Side"
                    
                    # Confidence Logic (Deterministic)
                    if abs_score >= 4: calculated_conf = 0.85
                    elif abs_score >= 2: calculated_conf = 0.65
                    else: calculated_conf = 0.50
                except:
                    pass

            prompt = f"""### 任务：量化信号翻译 (Quantitative Signal Translation)
你是一个**金融数据翻译官**。你的任务是将下方的【量化技术评估】(Quantitative Technical Assessment) 翻译成结构化的 JSON 格式。

{prediction_review}

{prior_analysis}

## 核心指令 (Translator Protocol)
1. **强制执行信号与置信度**：系统已根据评分算出建议值。
    - **当前评分**: {score_val:+d}
    - **强制信号**: "{calculated_signal}"
    - **强制置信度**: {calculated_conf}
    - 请直接将上述值填入 json 对应字段，不要修改。
2. **保守原则**：Lite 模型必须严格服从上述强制指令。
3. **策略适配 (关键)**：
    - **Holding 策略必须匹配评分方向**！
    - 当前是正分 (+) -> 策略必须是 "持有" 或 "观察"，**严禁**抄袭示例中的 "清仓"。
    - 示例中的 "清仓" 仅适用于负分 (-4) 情况。
    - **Holding 策略必须匹配评分方向**！
    - 当前是正分 (+) -> 策略必须是 "持有" 或 "观察"，**严禁**抄袭示例中的 "清仓"。
    - 示例中的 "清仓" 仅适用于负分 (-4) 情况。
3. **策略适配 (关键)**：
    - **Holding 策略必须匹配评分方向**！
    - 当前是正分 (+) -> 策略必须是 "持有" 或 "观察"，**严禁**抄袭示例中的 "清仓"。
    - 示例中的 "清仓" 仅适用于负分 (-4) 情况。
4. **禁止抄袭**：下方的“1-Shot 示例”仅作格式参考，**严禁抄袭示例中的数据**！必须使用上方真实的分析数据。
5. **去术语化**：在 summary 和 reasoning 中，不要提及 "Dashboard" 或 "面板"，请使用 "技术面评分"、"量化系统" 或 "指标系统" 代替。

## 1-Shot 示例 (仅供格式参考，数据是虚构的负面案例)
[输入]: 综合评分: -4 (强烈看空)
[输出]:
{{
  "signal": "Side",
  "confidence": 0.10,
  "summary": "量化评分-4，技术面极度疲软，所有指标均提示风险",
  "reasoning_trace": [
    {{ "step": "trend", "data": "MA5<MA10<MA20", "conclusion": "空头排列" }},
    {{ "step": "momentum", "data": "MACD死叉且绿柱放大", "conclusion": "下跌加速" }},
    {{ "step": "decision", "data": "技术面评分-4，属于高危区域", "conclusion": "避险" }}
  ],
  "key_levels": {{ "support": {boll_lower:.2f}, "resistance": {high_10d:.2f}, "stop_loss": {stop_ref:.2f} }},
  "tactics": {{
    "holding": [{{ "priority": "P1", "action": "清仓", "trigger": "跌破支撑", "reason": "趋势走坏" }}],
    "empty": [{{ "priority": "P1", "action": "观望", "trigger": "无止跌迹象", "reason": "风险极高" }}],
    "general": [{{ "priority": "P2", "action": "预警", "trigger": "乖离率过大", "reason": "超卖但未企稳" }}]
  }},
  "news_analysis": ["无重大新闻"],
  "conflict_resolution": "所有周期指标共振看空",
  "tomorrow_focus": "关注能否守住前低"
}}

请基于**真实数据**（而非示例数据），生成 JSON：
"""
            return prompt

        # --- STANDARD PROMPT (Analyst Mode) ---
        prompt = f"""### 步骤4：最终结论推导 (Synthesis)
整合所有信息（日线/周线/月线），生成最终操作建议。
{prediction_review}
{prior_analysis}

## 核心逻辑 (Conservative Trader)
1. **风险厌恶**：只要有"背离"或"多周期冲突"，默认"Side"（观望）。
2. **宁缺毋滥**：没有80%把握（日周共振+量能配合），不要给"Long"。

## 完整输出示例（请严格参考此格式）
{{
  "signal": "Side",
  "confidence": 0.7,
  "summary": "股价处于超买区间，MACD死叉提示动能减弱",
  "reasoning_trace": [
    {{ "step": "trend", "data": "MA20=607.83，收盘632.5", "conclusion": "多头排列" }},
    {{ "step": "momentum", "data": "RSI=62，MACD死叉", "conclusion": "动能减弱" }},
    {{ "step": "level", "data": "收盘632.5，布林上轨627.13", "conclusion": "超买状态" }},
    {{ "step": "decision", "data": "综合判断：虽然趋势向上，但面临短期回调风险", "conclusion": "观望" }}
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
        ma20 = latest.get('ma20', 0)
        boll_lower = latest.get('boll_lower', 0)
        
        # 1. Backfill key_levels if missing
        if not parsed.get('key_levels') or not parsed['key_levels'].get('support'):
            parsed['key_levels'] = {
                "support": boll_lower or ma20,
                "resistance": max([p.get('high', 0) for p in daily_prices[-10:]]) if daily_prices else 0,
                "stop_loss": (boll_lower or ma20) * 0.97
            }
            
        # 2. Backfill tactics if missing or empty
        if not parsed.get('tactics') or not parsed['tactics'].get('holding'):
            signal = parsed.get('signal', 'Side')
            base_holding = "持股观察" if signal == "Long" else "逢高减仓"
            base_empty = "逢低介入" if signal == "Long" else "观望等待"
            
            parsed['tactics'] = {
                "holding": [{
                    "priority": "P1", 
                    "action": base_holding, 
                    "trigger": f"跌破{parsed['key_levels']['support']:.2f}", 
                    "reason": "技术面触发风控"
                }],
                "empty": [{
                    "priority": "P1", 
                    "action": base_empty, 
                    "trigger": f"回踩{parsed['key_levels']['support']:.2f}企稳", 
                    "reason": "等待更有利位置"
                }],
                "general": []
            }

        # 3. Ensure other fields exist
        if "conflict_resolution" not in parsed:
            parsed["conflict_resolution"] = "综合多周期指标与市场情绪，当前处于关键决策点。"
        if "tomorrow_focus" not in parsed:
            parsed["tomorrow_focus"] = f"关注价格能否站稳 {parsed['key_levels']['support']:.2f} 支撑位。"
        if "news_analysis" not in parsed:
            parsed["news_analysis"] = ["无实时新闻输入，仅基于技术面分析"]

        context.artifacts["synthesis"] = parsed
        
        if "signal" not in parsed:
            raise ValueError("JSON missing 'signal' field")
            
    def _clean_and_parse_json(self, text: str) -> Dict[str, Any]:
        """
        Robust JSON parser for messy LLM output.
        """
        try:
            # 1. Strip markdown code blocks
            text = re.sub(r"```json\s*", "", text, flags=re.IGNORECASE)
            text = re.sub(r"```", "", text)
            text = text.strip()
            
            # 2. Extract JSON object if embedded in text
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1:
                text = text[start : end + 1]
                
            return json.loads(text)
        except json.JSONDecodeError as e:
            # Retry mechanism handles exceptions at step level
            raise StepExecutionError(self.step_name, f"Failed to parse JSON: {e}")
