import json
import sqlite3
import sys
import os
from datetime import datetime

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

from database import get_connection, get_stock_profile

def generate_full_prompt(symbol: str):
    # ... (no change) ...
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. 获取股票基础信息
    cursor.execute("SELECT name FROM stock_meta WHERE symbol = ?", (symbol,))
    name_row = cursor.fetchone()
    stock_name = name_row[0] if name_row else "未知股票"

    # 1.1 获取公司概况 (Profile)
    profile_row = get_stock_profile(symbol)
    profile_section = ""
    if profile_row:
        industry, main_bus, desc = profile_row
        main_bus_str = main_bus if main_bus else "暂无"
        # 简介只要前 100 字，避免太长
        desc_str = f"{desc[:100]}..." if desc else "暂无简介"
        profile_section = f"""## 公司基本面 (Profile)
- **行业**: {industry or '未知'}
- **主营业务**: {main_bus_str}
- **公司简介**: {desc_str}
"""
    
    # 2. 获取最新行情和指标
    cursor.execute(f"""
        SELECT * FROM daily_prices 
        WHERE symbol = ? 
        ORDER BY date DESC LIMIT 1
    """, (symbol,))
    
    # 获取列名映射
    columns = [description[0] for description in cursor.description]
    row = cursor.fetchone()
    
    if not row:
        print(f"❌ 未找到股票 {symbol} 的行情数据，请确保已执行同步。")
        return

    data = dict(zip(columns, row))
    
    # 3. 获取历史行情
    # 3.1 日线：获取近10日历史行情（战术触发层）
    cursor.execute("""
        SELECT date, open, high, low, close, change_percent, volume
        FROM daily_prices 
        WHERE symbol = ? 
        ORDER BY date DESC LIMIT 10
    """, (symbol,))
    history_rows = cursor.fetchall()

    # 3.2 周线：获取近12周数据（周期趋势层：8周明细 + 12周统计）
    cursor.execute("""
        SELECT date, open, high, low, close, change_percent, volume, ma20, rsi
        FROM weekly_prices 
        WHERE symbol = ? 
        ORDER BY date DESC LIMIT 12
    """, (symbol,))
    weekly_rows = cursor.fetchall()
    
    weekly_detail = weekly_rows[:8] if weekly_rows else []
    weekly_stats = {
        "high": max([w[2] for w in weekly_rows]) if weekly_rows else 0,
        "low": min([w[3] for w in weekly_rows]) if weekly_rows else 0,
    }

    # 3.3 月线：获取近12个月数据（战略背景层：3个月明细 + 12个月统计）
    cursor.execute("""
        SELECT date, open, high, low, close, change_percent, volume, ma20, rsi
        FROM monthly_prices 
        WHERE symbol = ? 
        ORDER BY date DESC LIMIT 12
    """, (symbol,))
    monthly_rows = cursor.fetchall()
    
    monthly_detail = monthly_rows[:3] if monthly_rows else []
    monthly_stats = {
        "high": max([m[2] for m in monthly_rows]) if monthly_rows else 0,
        "low": min([m[3] for m in monthly_rows]) if monthly_rows else 0,
        "ma20": monthly_rows[0][7] if monthly_rows else 0,
        "rsi": monthly_rows[0][8] if monthly_rows else 0
    }

    # 4. 获取近5次 AI 预测记录（用于闭环反馈）
    cursor.execute("""
        SELECT date, signal, confidence, ai_reasoning, validation_status, actual_change
        FROM ai_predictions 
        WHERE symbol = ? AND validation_status != 'Pending'
        ORDER BY date DESC LIMIT 5
    """, (symbol,))
    recent_predictions = cursor.fetchall()
    
    # 5. 获取全局预测统计
    cursor.execute("""
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN validation_status = 'Correct' THEN 1 ELSE 0 END) as correct,
            SUM(CASE WHEN validation_status = 'Incorrect' THEN 1 ELSE 0 END) as incorrect
        FROM ai_predictions 
        WHERE symbol = ? AND validation_status != 'Pending'
    """, (symbol,))
    stats = cursor.fetchone()
    total_predictions, correct_count, incorrect_count = stats if stats else (0, 0, 0)
    accuracy_rate = (correct_count / total_predictions * 100) if total_predictions > 0 else 0
    
    # 构建历史预测回顾
    prediction_review = ""
    if recent_predictions:
        prediction_rows = []
        for pred in recent_predictions:
            pred_date, pred_signal, pred_confidence, pred_reasoning, pred_status, pred_actual = pred
            signal_cn = {"Long": "做多", "Side": "观望", "Short": "避险"}.get(pred_signal, pred_signal)
            status_icon = "✅" if pred_status == "Correct" else ("❌" if pred_status == "Incorrect" else "➖")
            
            # 解析 summary
            try:
                reasoning_data = json.loads(pred_reasoning) if pred_reasoning else {}
                summary = reasoning_data.get("summary", "")[:15]  # 截取前15字
            except:
                summary = ""
            
            actual_str = f"{pred_actual:+.2f}%" if pred_actual is not None else "N/A"
            prediction_rows.append(f"| {pred_date} | {signal_cn} | {pred_confidence:.0%} | {summary} | {status_icon} | {actual_str} |")
        
        prediction_review = f"""## AI 历史预测回顾（近5次）
| 预测日期 | 信号 | 置信度 | 核心判断 | 结果 | 实际涨跌 |
|----------|------|--------|----------|------|----------|
{chr(10).join(prediction_rows)}

**历史准确率**: 总预测 {total_predictions} 次，正确 {correct_count} 次，错误 {incorrect_count} 次，准确率 **{accuracy_rate:.1f}%**

**反思参考**：请结合历史预测的正确/错误模式，评估当前判断是否有类似的陷阱或可借鉴之处。
"""
    
    conn.close()
    
    # 构建历史行情摘要
    history_summary = []
    cumulative_change = 0
    for i, h_row in enumerate(history_rows):
        h_date, h_open, h_high, h_low, h_close, h_change, h_volume = h_row
        cumulative_change += (h_change or 0)
        trend_icon = "📈" if (h_change or 0) > 0 else ("📉" if (h_change or 0) < 0 else "➡️")
        history_summary.append(f"| {h_date} | {h_open} | {h_high} | {h_low} | {h_close} | {h_change:+.2f}% {trend_icon} | {int(h_volume)} |")
    
    # 计算连涨/连跌天数
    consecutive_days = 0
    consecutive_direction = None
    for h_row in history_rows:
        h_change = h_row[5] or 0
        if consecutive_direction is None:
            consecutive_direction = "涨" if h_change > 0 else ("跌" if h_change < 0 else None)
            if consecutive_direction:
                consecutive_days = 1
        elif (consecutive_direction == "涨" and h_change > 0) or (consecutive_direction == "跌" and h_change < 0):
            consecutive_days += 1
        else:
            break
    
    trend_narrative = ""
    if consecutive_days >= 2:
        trend_narrative = f"**日线趋势**: 连续 {consecutive_days} 日{consecutive_direction}，最近10日累计涨跌幅 {cumulative_change:+.2f}%"
    else:
        trend_narrative = f"**日线趋势**: 近期震荡，10日累计涨跌幅 {cumulative_change:+.2f}%"

    # 构建周线摘要
    weekly_summary = []
    for w_row in weekly_detail:
        w_date, w_open, w_high, w_low, w_close, w_change, w_volume, w_ma20, w_rsi = w_row
        w_trend = "📈" if (w_change or 0) > 0 else "📉"
        weekly_summary.append(f"| {w_date} | {w_close} | {w_change:+.2f}% {w_trend} | MA20:{w_ma20:.2f} | RSI:{w_rsi:.1f} |")

    # 构建月线摘要
    monthly_summary = []
    for m_row in monthly_detail:
        m_date, m_open, m_high, m_low, m_close, m_change, m_volume, m_ma20, m_rsi = m_row
        m_trend = "📈" if (m_change or 0) > 0 else "📉"
        monthly_summary.append(f"| {m_date} | {m_close} | {m_change:+.2f}% {m_trend} |")

    # 3. 准备模板数据
    target_date = "下一个交易日"
    rsi = data.get('rsi', 0)
    rsi_status = "超买" if rsi > 70 else ("超卖" if rsi < 30 else "运行稳健")
    
    macd_hist = data.get('macd_hist', 0)
    macd_status = "金叉/多头" if macd_hist > 0 else "死叉/空头"

    # 4. 组装全量提示词
    full_prompt = f"""# 系统提示词 (System Prompt)
你是 StockWise 的 AI 决策助手，专门为个人投资者提供股票操作建议。

## 你的核心原则：
1. **理性锚点**：你不预测涨跌，你提供"执行纪律"的触发条件。
2. **个性化**：根据用户是"已持仓"还是"未建仓"，提供差异化的行动建议。
3. **可验证**：每条建议都有明确的触发条件，事后可验证对错。
4. **简洁直白**：使用普通人能秒懂的语言，避免晦涩术语。
5. **板块联动**：请结合你对该公司所属行业、板块特性及市场环境的理解，给出更有背景的建议。
6. **事件驱动**：如果你具备搜索能力，请尝试搜索该公司近期的重大新闻、公告或事件，并将其纳入分析（如无搜索能力可跳过此步）。

## 你的输出格式：
你必须严格按照以下 JSON 格式输出，不要添加任何其他文字（确保输出是合法的 JSON）：

{{
  "signal": "Long" | "Side" | "Short",
  "confidence": 0.0 ~ 1.0,
  "summary": "一句话核心结论（15字以内）",
  "reasoning_trace": [
    {{ "step": "trend", "data": "关键趋势数据", "conclusion": "趋势判断（≤15字）" }},
    {{ "step": "momentum", "data": "动能指标数据", "conclusion": "动能判断（≤15字）" }},
    {{ "step": "volume", "data": "量能数据", "conclusion": "量能判断（≤15字）" }},
    {{ "step": "history", "data": "历史预测数据", "conclusion": "历史参考判断（≤15字）" }},
    {{ "step": "decision", "data": "综合关键因素", "conclusion": "最终决策理由（≤15字）" }}
  ],
  "tactics": {{
    "holding": [
        {{ "priority": "P1", "action": "...", "trigger": "...", "reason": "..." }},
        ...
    ],
    "empty": [
        {{ "priority": "P1", "action": "...", "trigger": "...", "reason": "..." }},
        ...
    ],
    "general": [
        {{ "priority": "P3", "action": "...", "trigger": "...", "reason": "..." }},
        ...
    ]
  }},
  "key_levels": {{
    "support": 数值,
    "resistance": 数值,
    "stop_loss": 数值
  }},
  "conflict_resolution": "当指标冲突时的决策原则",
  "tomorrow_focus": "明日需重点关注的事项"
}}

## 示例输出（仅供参考格式）：
```json
{{
  "signal": "Side",
  "confidence": 0.65,
  "summary": "量缩震荡，观望为主",
  "reasoning_trace": [
    {{ "step": "trend", "data": "MA20下方运行", "conclusion": "空头趋势偏弱" }},
    {{ "step": "momentum", "data": "MACD死叉 RSI=42", "conclusion": "弱势但未超卖" }},
    {{ "step": "volume", "data": "缩量60%", "conclusion": "观望情绪浓厚" }},
    {{ "step": "history", "data": "准确率37.7%", "conclusion": "不宜盲从历史" }},
    {{ "step": "decision", "data": "空+缩量+假日效应", "conclusion": "观望优于追空" }}
  ],
  "tactics": {{
    "holding": [
      {{ "priority": "P1", "action": "持仓观望", "trigger": "股价维持在 15.0 上方", "reason": "短期支撑有效" }},
      {{ "priority": "P2", "action": "止损离场", "trigger": "跌破 14.5 且30分钟不收回", "reason": "防止亏损扩大" }}
    ],
    "empty": [
      {{ "priority": "P1", "action": "观望等待", "trigger": "放量突破 16.0", "reason": "右侧确认更安全" }},
      {{ "priority": "P2", "action": "小仓试探", "trigger": "缩量回踩 14.8 不破", "reason": "博取超跌反弹" }}
    ],
    "general": [
      {{ "priority": "P3", "action": "关注板块", "trigger": "港股医药板块整体回暖", "reason": "板块共振提高胜率" }}
    ]
  }},
  "key_levels": {{
    "support": 14.8,
    "resistance": 16.27,
    "stop_loss": 14.5
  }},
  "conflict_resolution": "趋势（MA20）权重最高，其次看量能，最后看 RSI",
  "tomorrow_focus": "观察能否放量站稳 15.0，若缩量震荡则继续观望"
}}
```

---

# 用户输入 (User Input)

## 股票信息
- **名称**: {stock_name}
- **代码**: {symbol}.HK
- **日期**: {data['date']}

{profile_section}

## 近10日行情走势 (Tactical)
| 日期 | 开盘 | 最高 | 最低 | 收盘 | 涨跌幅 | 成交量 |
|------|------|------|------|------|--------|--------|
{chr(10).join(history_summary)}

{trend_narrative}

## 最新技术指标 (Indicators)
| 指标 | 数值 | 状态 |
|------|------|------|
| MA5/10/20 | {data['ma5']}/{data['ma10']}/{data['ma20']} | { "多头排列" if data['ma5']>data['ma10']>data['ma20'] else "均线纠缠/空头" } |
| MA60 | {data['ma60']} | {"价格在支撑线上方" if data['close']>data['ma60'] else "价格在压力线下方"} |
| RSI(14) | {rsi} | {rsi_status} |
| MACD | DIF={data['macd']}, DEA={data['macd_signal']}, 柱={data['macd_hist']} | {macd_status} |
| KDJ | K={data['kdj_k']}, D={data['kdj_d']}, J={data['kdj_j']} | - |
| 布林带 | 上轨={data['boll_upper']}, 中轨={data['boll_mid']}, 下轨={data['boll_lower']} | - |

## 周线行情及波段趋势 (Meso)
### 最近8周数据
| 周末日期 | 收盘价 | 周涨跌幅 | 周MA20 | 周RSI |
|----------|--------|----------|--------|-------|
{chr(10).join(weekly_summary)}

### 季度统计 (近12周)
- **12周最高**: {weekly_stats['high']}
- **12周最低**: {weekly_stats['low']}

## 月度行情及战略背景 (Macro)
### 最近3个月数据
| 月末日期 | 收盘价 | 月涨跌幅 |
|----------|--------|----------|
{chr(10).join(monthly_summary)}

### 年度统计 (近12个月)
- **12个月最高**: {monthly_stats['high']}
- **12个月最低**: {monthly_stats['low']}
- **月线关键指标**: MA20={monthly_stats['ma20']:.2f}, RSI={monthly_stats['rsi']:.1f}
- **长线定位**: {"股价在20月线上方，处于大周期上升通道" if data['close'] > monthly_stats['ma20'] else "股价在20月线下方，大周期处于弱势调整期"}

{prediction_review}
## 请求
请基于以上数据，为该股票生成明日（{target_date}）的操作建议。
"""
    
    print("-" * 30 + " 复制以下内容 " + "-" * 30)
    print(full_prompt)
    print("-" * 75)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('symbol', help='股票代码，例如 02171')
    args = parser.parse_args()
    
    generate_full_prompt(args.symbol)
