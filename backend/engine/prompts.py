import json
from database import get_connection, get_stock_profile

def prepare_stock_analysis_prompt(symbol: str):
    """准备用于 LLM 分析的系统提示词和用户输入数据"""
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
        conn.close()
        return None, f"未找到股票 {symbol} 的行情数据"

    data = dict(zip(columns, row))
    
    # 3. 获取历史行情
    # 3.1 日线：获取近10日历史行情
    cursor.execute("""
        SELECT date, open, high, low, close, change_percent, volume
        FROM daily_prices 
        WHERE symbol = ? 
        ORDER BY date DESC LIMIT 10
    """, (symbol,))
    history_rows = cursor.fetchall()

    # 3.2 周线：获取近12周数据
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

    # 3.3 月线：获取近12个月数据
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

    # 4. 获取历史 AI 预测记录
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
    
    conn.close()

    # 构建历史预测回顾
    prediction_review = ""
    if recent_predictions:
        prediction_rows = []
        for pred in recent_predictions:
            pred_date, pred_signal, pred_confidence, pred_reasoning, pred_status, pred_actual = pred
            signal_cn = {"Long": "做多", "Side": "观望", "Short": "避险"}.get(pred_signal, pred_signal)
            status_icon = "✅" if pred_status == "Correct" else ("❌" if pred_status == "Incorrect" else "➖")
            
            try:
                reasoning_data = json.loads(pred_reasoning) if pred_reasoning else {}
                summary = reasoning_data.get("summary", "")[:15]
            except:
                summary = ""
            
            actual_str = f"{pred_actual:+.2f}%" if pred_actual is not None else "N/A"
            prediction_rows.append(f"| {pred_date} | {signal_cn} | {pred_confidence:.0%} | {summary} | {status_icon} | {actual_str} |")
        
        prediction_review = f"""## AI 历史预测回顾（近5次）
| 预测日期 | 信号 | 置信度 | 核心判断 | 结果 | 实际涨跌 |
|----------|------|--------|----------|------|----------|
{chr(10).join(prediction_rows)}

**历史准确率**: 累计预测 {total_predictions} 次，准确率 **{accuracy_rate:.1f}%**
"""

    # 构建历史行情摘要
    history_summary = []
    cumulative_change = 0
    for h_row in history_rows:
        h_date, h_open, h_high, h_low, h_close, h_change, h_volume = h_row
        cumulative_change += (h_change or 0)
        trend_icon = "📈" if (h_change or 0) > 0 else ("📉" if (h_change or 0) < 0 else "➡️")
        history_summary.append(f"| {h_date} | {h_open} | {h_high} | {h_low} | {h_close} | {h_change:+.2f}% {trend_icon} | {int(h_volume)} |")
    
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

    rsi = data.get('rsi', 0)
    rsi_status = "超买" if rsi > 70 else ("超卖" if rsi < 30 else "运行稳健")
    macd_hist = data.get('macd_hist', 0)
    macd_status = "金叉/多头" if macd_hist > 0 else "死叉/空头"

    # 系统提示词
    system_prompt = """你是 StockWise 的 AI 决策助手，专门为个人投资者提供股票操作建议。

## 你的核心原则：
1. **理性锚点**：你不预测涨跌，你提供"执行纪律"的触发条件。
2. **个性化**：根据用户是"已持仓"还是"未建仓"，提供差异化的行动建议。
3. **可验证**：每条建议都有明确的触发条件，事后可验证对错。
4. **简洁直白**：使用普通人能秒懂的语言，避免晦涩术语。
5. **严禁搜索**：禁止调用任何搜索工具或进行联网搜索，仅基于提供的上下文进行分析。

## 你的输出格式：
你必须严格按照以下 JSON 格式输出，**禁止在 JSON 内容中嵌套代码块或特殊标记**：
{
  "signal": "Long" | "Side" | "Short",
  "confidence": 0.0 ~ 1.0,
  "summary": "一句话核心结论（15字以内）",
  "reasoning_trace": [
    { "step": "trend", "data": "趋势数据（简短）", "conclusion": "判断（≤15字）" },
    { "step": "momentum", "data": "指标数据（简短）", "conclusion": "判断（≤15字）" },
    { "step": "volume", "data": "量能数据", "conclusion": "量能判断（≤15字）" },
    { "step": "history", "data": "历史数据说明", "conclusion": "总结（≤15字）" },
    { "step": "decision", "data": "关键原因", "conclusion": "最终决策（≤15字）" }
  ],
  "tactics": {
    "holding": [
        { "priority": "P1", "action": "...", "trigger": "...", "reason": "..." },
        { "priority": "P2", "action": "...", "trigger": "...", "reason": "..." }
    ],
    "empty": [
        { "priority": "P1", "action": "...", "trigger": "...", "reason": "..." },
        { "priority": "P2", "action": "...", "trigger": "...", "reason": "..." }
    ],
    "general": [
        { "priority": "P3", "action": "...", "trigger": "...", "reason": "..." }
    ]
  },
  "key_levels": {
    "support": 数值,
    "resistance": 数值,
    "stop_loss": 数值
  },
  "conflict_resolution": "指标冲突决策原则",
  "tomorrow_focus": "关注重点"
}

请确保不要在 data 或 conclusion 字段中包含诸如 ```json 等内容。直接输出合法的 JSON 字符串。"""

    # 用户输入提示词
    user_prompt = f"""# 用户输入 (User Input)

## 股票信息
- **名称**: {stock_name}
- **代码**: {symbol}.HK
- **日期**: {data['date']}

{profile_section}

## 近10日行情走势 (Tactical)
| 日期 | 开盘 | 最高 | 最低 | 收盘 | 涨跌幅 | 成交量 |
|------|------|------|------|------|--------|--------|
{chr(10).join(history_summary)}

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
请基于以上数据，为该股票生成明日的操作建议。"""

    return system_prompt, user_prompt
