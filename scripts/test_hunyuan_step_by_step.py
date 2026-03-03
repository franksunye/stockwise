
import sys
import os
import json
import time

# Add project root AND backend to path to allow both absolute and relative-style imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

try:
    from backend.engine.llm_client import LLMClient
except ImportError:
    import traceback
    traceback.print_exc()
    print(f"Current sys.path: {sys.path}")
    sys.exit(1)

def main():
    print("🚀 Starting Structured Prompting Test for Hunyuan Lite...")
    
    # Initialize Client directly with Hunyuan provider
    # Ensure HUNYUAN_API_KEY is in env or .env
    client = LLMClient(provider="hunyuan")
    
    # Note: Skipping is_available() check as Hunyuan API does not support the /models endpoint.
    # The API Key will be validated on the first actual request.
    print(f"✅ Initializing Hunyuan Client ({client.model})")

    # --- Conversation History ---
    messages = []
    
    # --- System Prompt ---
    system_prompt = """你是一个严谨的金融分析助理。你的任务是辅助人类分析师完成股票走势预测。
为了防止幻觉和逻辑混乱，我们将分4步进行分析。
请严格遵守每一步的指令，不要抢答，不要编造数据。
数值必须精准匹配，不得四舍五入。"""
    
    messages.append({"role": "system", "content": system_prompt})

    # --- Step 1: Data Anchoring (Full Parity) ---
    step1_prompt = """### 步骤1：基础锚定数据投喂
请精准记录以下股票基础数据及近10日行情：

## 1. 基础信息
- **腾讯控股** (00700.HK)
- 日期: 2026-01-06
- **行业**: 软件服务
- **公司简介**: 腾讯控股有限公司是一家世界领先的互联网科技公司，成立于1998年，总部位于中国深圳。

## 2. 价格行为 (Price Action) - 近10日行情
| 日期       | 开盘  | 最高  | 最低  | 收盘  | 涨跌幅   | 成交量   |
| ---------- | ----- | ----- | ----- | ----- | -------- | -------- |
| 2026-01-06 | 627.0 | 638.5 | 626.0 | 632.5 | +1.28% 📈 | 24168431 |
| 2026-01-05 | 624.0 | 628.0 | 615.5 | 624.5 | +0.24% 📈 | 19947025 |
| 2026-01-02 | 600.5 | 624.5 | 600.5 | 623.0 | +4.01% 📈 | 16200058 |
| 2025-12-31 | 597.5 | 602.5 | 596.0 | 599.0 | -0.17% 📉 | 10838209 |
| 2025-12-30 | 598.5 | 601.0 | 594.0 | 600.0 | +0.59% 📈 | 13582535 |
| 2025-12-29 | 606.0 | 611.0 | 596.0 | 596.5 | -1.08% 📉 | 18502650 |
| 2025-12-24 | 598.0 | 604.5 | 598.0 | 603.0 | +0.17% 📈 | 7324553  |
| 2025-12-23 | 613.5 | 614.5 | 601.5 | 602.0 | -2.03% 📉 | 15623392 |
| 2025-12-22 | 620.0 | 621.5 | 610.0 | 614.5 | +0.08% 📈 | 13868060 |
| 2025-12-19 | 610.0 | 617.5 | 607.0 | 614.0 | +1.49% 📈 | 17765762 |

任务：确认数据无误后，输出「数据已锚定：腾讯控股 (00700.HK) @ 632.5」，无需额外分析。"""

    print("\n🔹 Step 1: Sending Anchor Data...")
    content, _ = client.chat(messages + [{"role": "user", "content": step1_prompt}])
    print(f"🤖 AI Response:\n{content}")
    
    if content:
        messages.append({"role": "user", "content": step1_prompt})
        messages.append({"role": "assistant", "content": content})
    else:
        print("❌ Step 1 failed.")
        return

    # --- Step 2: Indicators ---
    step2_prompt = """### 步骤2：关键指标与周期极值
基于已锚定的数据，补充以下核心指标：

周期极值：
- 近10日最高价：638.5
- 近10日最低价：594.0

核心指标 (日线)：
- MA20：607.83 (多头排列)
- MA60：0.0 (无数据)
- RSI (14)：62.0 (运行稳健)
- MACD：死叉/空头
- 布林带：上轨 627.13，下轨 588.52，收盘价(632.5)已突破上轨

任务：
1. 判断均线趋势（多头/空头/纠缠）
2. 判断RSI位置（超买/超卖/中性）
3. 分析当前价格相对布林带的位置风险
4. 输出简短分析，暂不给出买卖结论。"""

    print("\n🔹 Step 2: Sending Indicators...")
    content, _ = client.chat(messages + [{"role": "user", "content": step2_prompt}])
    print(f"🤖 AI Response:\n{content}")

    if content:
        messages.append({"role": "user", "content": step2_prompt})
        messages.append({"role": "assistant", "content": content})
    else:
        print("❌ Step 2 failed.")
        return

    # --- Step 3: Multi-period Context & Verification ---
    step3_prompt = """### 步骤3：周期背景与辅助验证
请结合以下多周期数据进行深度分析：

## 1. 周期背景 (Context)
### 周线透视 (最近8周)
| 周末日期   | 收盘  | 涨跌幅   | MA20        | RSI      |
| ---------- | ----- | -------- | ----------- | -------- |
| 2026-01-06 | 632.5 | +1.52% 📈 | MA20:626.33 | RSI:59.7 |
| 2025-12-31 | 599.0 | -2.04% 📉 | MA20:623.15 | RSI:52.8 |
| ... (其余周线见行情表)

### 月线透视 (最近3个月)
| 月末日期   | 收盘  | 涨跌幅   |
| ---------- | ----- | -------- |
| 2026-01-06 | 632.5 | +5.59% 📈 |
| 2025-12-31 | 599.0 | -2.04% 📉 |

- **年度区间(近12个月)**: 414.5 ~ 683.0
- **长期趋势**: 牛市 (当前价 vs 20月线)

## 2. AI 历史预测回顾
| 预测日期   | 信号 | 置信度 | 判断 | 结果 |
| ---------- | ---- | ------ | ---- | ---- |
| 2025-12-29 | 观望 | 60%    | 短期承压 | ✅ |

任务：
1. 分析 "日线MACD死叉" 在 "周线/月线多头" 背景下的性质（是反转还是回踩？）。
2. 分析当前价 (632.5) 在 "年度区间 (414.5~683.0)" 中的位置感。
3. 指出多周期共振点或矛盾点。"""

    print("\n🔹 Step 3: Sending Auxiliary Data...")
    content, _ = client.chat(messages + [{"role": "user", "content": step3_prompt}])
    print(f"🤖 AI Response:\n{content}")

    if content:
        messages.append({"role": "user", "content": step3_prompt})
        messages.append({"role": "assistant", "content": content})
    else:
        print("❌ Step 3 failed.")
        return

    # --- Step 4: Final Conclusion (JSON) ---
    step4_prompt = """### 步骤4：最终结论推导
整合以上所有信息，生成最终操作建议 JSON。

逻辑要求：
1. 价格突破布林上轨(627.13)且RSI(62.0)尚未极端超买，趋势偏强。
2. 但MACD死叉提示动能可能减弱，需警惕回调。
3. 综合判断：虽然突破了上轨，但MACD死叉是重大的背离信号。请像一个极其保守的交易员一样思考：
   - 只要有背离，就默认有风险。
   - 宁愿错过，绝不做错。
   - 除非后续这3个条件同时满足（量能继续放大 + MACD金叉 + 站稳632.5），否则现在就是"观望"。
4. 宁缺勿滥：如果没有80%把握，默认 "Side" (观望)。不要被短期涨幅诱惑。

必须输出纯 JSON 格式，严格遵守以下 Schema：
{
  "signal": "Long" | "Short" | "Side",
  "confidence": 0.0 - 1.0 (观望建议 0.6-0.75),
  "summary": "一句话总结",
  "reasoning_trace": [
    { "step": "trend", "data": "均线相关描述", "conclusion": "趋势结论" },
    { "step": "momentum", "data": "RSI/MACD相关", "conclusion": "动能结论" },
    { "step": "level", "data": "布林带/压力位相关", "conclusion": "位置结论" },
    { "step": "decision", "data": "综合判断", "conclusion": "最终结论" }
  ],
  "news_analysis": ["新闻1", "新闻2"] (若无新闻则填 ["无实时新闻输入，仅基于技术面分析"]),
  "tactics": {
    "holding": [{ "priority": "P1", "action": "动作", "trigger": "触发条件", "reason": "理由" }],
    "empty": [{ "priority": "P1", "action": "动作", "trigger": "触发条件", "reason": "理由" }],
    "general": [{ "priority": "P2", "action": "动作", "trigger": "触发条件", "reason": "理由" }]
  },
  "key_levels": { 
    "support": <使用布林下轨588.52或MA20(607.83)作为参考>,
    "resistance": <使用近10日最高价638.5或布林上轨627.13作为参考>,
    "stop_loss": <通常设置在支撑位下方约3%>
  },
  "conflict_resolution": "解释本次分析中的主要矛盾点如何权衡",
  "tomorrow_focus": "明日重点关注的价格位或事件"
}

**IMPORTANT**: 
1. `reasoning_trace` 中的 `step` 必须是英文: trend, momentum, level, decision.
2. 必须包含 `news_analysis`, `conflict_resolution`, `tomorrow_focus` 字段.
3. **禁止输出任何数学公式**。所有数字必须是计算后的结果。例如：
   - ❌ 错误: "stop_loss": 632.5 * 0.97
   - ✅ 正确: "stop_loss": 613.53"""

    print("\n🔹 Step 4: Requesting Conclusion...")
    content, _ = client.chat(messages + [{"role": "user", "content": step4_prompt}])
    print(f"🤖 AI Response:\n{content}")
    
    # Validation
    if content:
        try:
            # Try basic cleanup
            clean_content = content.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_content)
            print("\n✅ Valid JSON received!")
            print(json.dumps(data, indent=2, ensure_ascii=False))
        except json.JSONDecodeError:
            print("\n❌ Failed to parse JSON response.")
            print(content)

if __name__ == "__main__":
    main()
