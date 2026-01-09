import json
from typing import Dict, Any, List
from database import get_connection, get_stock_profile

def fetch_full_analysis_context(symbol: str, as_of_date: str = None) -> Dict[str, Any]:
    """
    Fetch all raw data needed for a comprehensive stock analysis.
    This ensures strict parity between different models/run modes.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Basic Meta
    cursor.execute("SELECT name FROM stock_meta WHERE symbol = ?", (symbol,))
    name_row = cursor.fetchone()
    stock_name = name_row[0] if name_row else "未知股票"

    # 1.1 Profile
    profile_row = get_stock_profile(symbol)
    profile = {}
    if profile_row:
        industry, main_bus, desc = profile_row
        profile = {
            "industry": industry or "未知",
            "main_business": main_bus or "暂无",
            "description": desc or "暂无简介"
        }
    
    # 2. Latest/Target Day Price Action
    if as_of_date:
        cursor.execute("SELECT * FROM daily_prices WHERE symbol = ? AND date = ?", (symbol, as_of_date))
    else:
        cursor.execute("SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
    
    columns = [description[0] for description in cursor.description]
    row = cursor.fetchone()
    if not row:
        return {"error": f"未找到股票 {symbol} 的行情数据" + (f" (日期: {as_of_date})" if as_of_date else "")}

    latest_data = dict(zip(columns, row))
    analysis_date = latest_data['date']
    
    # 3. History
    # 3.1 Daily (10 days)
    cursor.execute("""
        SELECT date, open, high, low, close, change_percent, volume
        FROM daily_prices 
        WHERE symbol = ? AND date <= ?
        ORDER BY date DESC LIMIT 10
    """, (symbol, analysis_date))
    daily_history = [dict(zip(["date", "open", "high", "low", "close", "change_percent", "volume"], h)) for h in cursor.fetchall()]

    # 3.2 Weekly (12 weeks)
    cursor.execute("""
        SELECT date, open, high, low, close, change_percent, volume, ma20, rsi, macd_hist
        FROM weekly_prices 
        WHERE symbol = ? AND date <= ?
        ORDER BY date DESC LIMIT 12
    """, (symbol, analysis_date))
    weekly_history = [dict(zip(["date", "open", "high", "low", "close", "change_percent", "volume", "ma20", "rsi", "macd_hist"], w)) for w in cursor.fetchall()]
    
    # 3.3 Monthly (12 months)
    cursor.execute("""
        SELECT date, open, high, low, close, change_percent, volume, ma20, rsi, macd_hist
        FROM monthly_prices 
        WHERE symbol = ? AND date <= ?
        ORDER BY date DESC LIMIT 12
    """, (symbol, analysis_date))
    monthly_history = [dict(zip(["date", "open", "high", "low", "close", "change_percent", "volume", "ma20", "rsi", "macd_hist"], m)) for m in cursor.fetchall()]

    # 4. AI History (last 5)
    cursor.execute("""
        SELECT date, signal, confidence, ai_reasoning, validation_status, actual_change
        FROM ai_predictions 
        WHERE symbol = ? AND validation_status != 'Pending' AND date < ?
        ORDER BY date DESC LIMIT 5
    """, (symbol, analysis_date))
    ai_history = [dict(zip(["date", "signal", "confidence", "ai_reasoning", "validation_status", "actual_change"], a)) for a in cursor.fetchall()]

    # 5. Accuracy Stats
    cursor.execute("""
        SELECT COUNT(*) as total,
               SUM(CASE WHEN validation_status = 'Correct' THEN 1 ELSE 0 END) as correct
        FROM ai_predictions 
        WHERE symbol = ? AND validation_status != 'Pending' AND date < ?
    """, (symbol, analysis_date))
    stats_row = cursor.fetchone()
    total_predictions = stats_row[0] if stats_row else 0
    correct_count = stats_row[1] if stats_row else 0
    accuracy_rate = (correct_count / total_predictions * 100) if total_predictions > 0 else 0

    return {
        "symbol": symbol,
        "name": stock_name,
        "date": analysis_date,
        "profile": profile,
        "latest_data": latest_data,
        "daily_prices": daily_history[::-1], # Oldest first for tables? Or newest first? Benchmark uses DESC but then iterates.
        "weekly_prices": weekly_history,
        "monthly_prices": monthly_history,
        "ai_history": ai_history,
        "accuracy": {
            "total": total_predictions,
            "rate": accuracy_rate
        }
    }

def prepare_stock_analysis_prompt(symbol: str, as_of_date: str = None):
    """
    准备用于 LLM 分析的系统提示词和用户输入数据
    (One-shot 模式专用，内部调用 fetch_full_analysis_context)
    """
    ctx = fetch_full_analysis_context(symbol, as_of_date)
    if "error" in ctx:
        return None, ctx["error"]

    data = ctx["latest_data"]
    profile = ctx["profile"]
    
    # 1. Profile Section
    profile_section = f"""## 公司基本面 (Profile)
- **行业**: {profile.get('industry', '未知')}
- **主营业务**: {profile.get('main_business', '暂无')}
- **公司简介**: {profile.get('description', '暂无')[:100]}...
"""
    
    # 2. History Table
    history_summary = []
    for h in ctx["daily_prices"][::-1]: # Use reverse to restore chronological for string generation if needed, but benchmark used latest first?
        # Re-check benchmark: history_rows fetched LIMIT 10 ORDER BY date DESC. 
        # So it's [Latest, T-1, ... T-9].
        # In implementation_plan.md I should keep it identical.
        date_str = h['date']
        trend_icon = "📈" if (h['change_percent'] or 0) > 0 else ("📉" if (h['change_percent'] or 0) < 0 else "➡️")
        history_summary.append(f"| {date_str} | {h['open']} | {h['high']} | {h['low']} | {h['close']} | {h['change_percent']:+.2f}% {trend_icon} | {int(h['volume'])} |")
    
    # 3. Weekly Summary
    weekly_summary = []
    weekly_detail = ctx["weekly_prices"][:8]
    for w in weekly_detail:
        w_trend = "📈" if (w['change_percent'] or 0) > 0 else "📉"
        weekly_summary.append(f"| {w['date']} | {w['close']} | {w['change_percent']:+.2f}% {w_trend} | MA20:{w['ma20']:.2f} | RSI:{w['rsi']:.1f} |")

    weekly_stats = {
        "high": max([w['high'] for w in ctx["weekly_prices"]]) if ctx["weekly_prices"] else 0,
        "low": min([w['low'] for w in ctx["weekly_prices"]]) if ctx["weekly_prices"] else 0,
    }

    # 4. Monthly Summary
    monthly_summary = []
    monthly_detail = ctx["monthly_prices"][:3]
    for m in monthly_detail:
        m_trend = "📈" if (m['change_percent'] or 0) > 0 else "📉"
        monthly_summary.append(f"| {m['date']} | {m['close']} | {m['change_percent']:+.2f}% {m_trend} |")

    monthly_stats = {
        "high": max([m['high'] for m in ctx["monthly_prices"]]) if ctx["monthly_prices"] else 0,
        "low": min([m['low'] for m in ctx["monthly_prices"]]) if ctx["monthly_prices"] else 0,
        "ma20": ctx["monthly_prices"][0]['ma20'] if ctx["monthly_prices"] else 0,
        # "rsi": monthly_rows[0][8] ... matching monthly_history zip
    }

    # 5. AI Review
    prediction_review = ""
    if ctx["ai_history"]:
        prediction_rows = []
        for pred in ctx["ai_history"]:
            pred_date = pred['date']
            signal_cn = {"Long": "做多", "Side": "观望", "Short": "避险"}.get(pred['signal'], pred['signal'])
            status_icon = "✅" if pred['validation_status'] == "Correct" else ("❌" if pred['validation_status'] == "Incorrect" else "➖")
            
            summary = ""
            try:
                reasoning_data = json.loads(pred['ai_reasoning']) if pred['ai_reasoning'] else {}
                summary = reasoning_data.get("summary", "")[:15]
            except: pass
            
            actual_str = f"{pred['actual_change']:+.2f}%" if pred['actual_change'] is not None else "N/A"
            prediction_rows.append(f"| {pred_date} | {signal_cn} | {pred['confidence']:.0%} | {summary} | {status_icon} | {actual_str} |")
        
        prediction_review = f"""## AI 历史预测回顾（近5次）
| 预测日期 | 信号 | 置信度 | 核心判断 | 结果 | 实际涨跌 |
|----------|------|--------|----------|------|----------|
{chr(10).join(prediction_rows)}

**历史准确率**: 累计预测 {ctx['accuracy']['total']} 次，准确率 **{ctx['accuracy']['rate']:.1f}%**
"""

    rsi = data.get('rsi', 0)
    rsi_status = "超买" if rsi > 70 else ("超卖" if rsi < 30 else "运行稳健")
    macd_hist = data.get('macd_hist', 0)
    macd_status = "金叉/多头" if macd_hist > 0 else "死叉/空头"

    # System Prompt (融合版：由简入繁，既要格式也要灵魂)
    system_prompt = """你是 StockWise 的 AI 决策助手，专门为个人投资者提供股票操作建议。

## 数据声明
**以下所有数据均为来自香港联交所、上海证券交易所、深圳证券交易所的真实市场数据，绝非模拟或虚拟数据。请基于这些真实数据进行专业分析。**

## 你的核心原则
1. **理性锚点**：你不预测涨跌，你提供"执行纪律"的触发条件。
2. **个性化**：根据用户是"已持仓"还是"未建仓"，提供差异化的行动建议。
3. **可验证**：每条建议都有明确的触发条件，事后可验证对错。
4. **简洁直白**：使用普通人能秒懂的语言，避免晦涩术语。
5. **板块联动**：请结合你对该公司所属行业、板块特性及市场环境的理解，给出更有背景的建议。
6. **事件驱动**：如果你具备搜索能力，请搜索该公司近期的重大新闻并纳入分析。如无法联网，请在 news_analysis 中简单注明"无实时新闻输入"，仅基于技术面分析即可，严谨编造新闻。

## 任务目标
根据提供的股票数据，生成 JSON 格式的操作建议。

## 严格约束
1. **必须输出纯 JSON**：不要包含 ```json 或 ``` 标记，不要包含任何前言或后记。
   ❌ 错误: ```json {"signal": "Side"} ```
   ✅ 正确: {"signal": "Side", ...}
2. **严禁幻觉**：仅根据提供的数据分析，不要编造新闻。
3. **格式保证**：确保所有括号正确闭合，确保是合法的 JSON 对象。

## 输出结构示例
{
  "signal": "Side",
  "confidence": 0.9,
  "summary": "股价严重超买，基本面存在风险且公司已发布风险提示，建议观望。",
  "reasoning_trace": [
    { "step": "trend", "data": "MA20向上，周月线强势上涨", "conclusion": "趋势强劲" },
    { "step": "momentum", "data": "日线RSI超买(82.3)，MACD金叉", "conclusion": "动能过热" },
    { "step": "volume", "data": "成交量显著放大，高位换手率增高", "conclusion": "筹码松动风险" },
    { "step": "level", "data": "股价远离布林上轨，乖离率过大", "conclusion": "超买需回归" },
    { "step": "fundamentals", "data": "市盈率为负，业绩不支持高估值", "conclusion": "基本面风险" },
    { "step": "news_impact", "data": "公司发布股价异动公告，警示炒作风险", "conclusion": "事件风险" },
    { "step": "decision", "data": "技术超买叠加基本面风险，风险大于机会", "conclusion": "观望" }
  ],
  "news_analysis": [
    "2025年12月28日，公司发布股价异动公告，警示非理性炒作风险。",
    "公告澄清前三季度净利润亏损，商业航天业务占比不足1%。"
  ],
  "tactics": {
    "holding": [{"priority": "P1", "action": "止盈/减仓", "trigger": "跌破MA5", "reason": "获利回吐压力大"}],
    "empty": [{"priority": "P1", "action": "观望", "trigger": "等待回调企稳", "reason": "风险收益比不佳"}],
    "general": [{"priority": "P2", "action": "关注公告", "trigger": "基本面变化", "reason": "需甄别概念炒作"}]
  },
  "key_levels": { "support": 31.6, "resistance": 33.88, "stop_loss": 31.0 },
  "conflict_resolution": "技术面超买与基本面风险共振，优先风控。",
  "tomorrow_focus": "能否守住31.6元支撑"
}

### 示例 2: 做多信号 (Long) - 关键字段
{
  "signal": "Long",
  "confidence": 0.85,
  "summary": "多周期共振向上，突破关键阻力位，量价配合良好。",
  "reasoning_trace": [
    { "step": "trend", "data": "MA20/60金叉，周月线趋势向上", "conclusion": "趋势健康" },
    { "step": "decision", "data": "多周期共振+突破+量能配合", "conclusion": "做多" }
  ]
}

### 示例 3: 避险信号 (Short) - 关键字段
{
  "signal": "Short",
  "confidence": 0.80,
  "summary": "跌破关键支撑，均线空头排列，建议避险。",
  "reasoning_trace": [
    { "step": "trend", "data": "MA20/60死叉，周线破位下行", "conclusion": "趋势恶化" },
    { "step": "decision", "data": "多周期共振下跌+破位+放量", "conclusion": "避险" }
  ]
}"""

    # Dynamic Context Instruction
    if as_of_date:
        context_instruction = f"👉 **回填模式**：请假装今天是 {data['date']}。严禁使用该日期之后的任何数据或新闻（防泄露）。"
    else:
        context_instruction = f"👉 **实时分析**：今天是 {data['date']}。请务必结合最新的市场资讯进行分析。"

    # 用户输入提示词 (优化版，末尾增强指令)
    user_prompt = f"""# 股票数据输入

## 1. 基础信息
- **{stock_name}** ({symbol}.HK)
- 日期: {data['date']}
{profile_section}

## 2. 价格行为 (Price Action)
近10日行情:
| 日期 | 开盘 | 最高 | 最低 | 收盘 | 涨跌幅 | 成交量 |
|------|------|------|------|------|--------|--------|
{chr(10).join(history_summary)}

## 3. 技术指标 (Indicators - 日线)
- **趋势**: MA20={data['ma20']}, MA60={data['ma60']} ({ "多头" if data['close']>data['ma20'] else "空头/震荡" })
- **动能**: RSI={rsi:.1f} ({rsi_status}), MACD={macd_status}
- **位置**: 收盘{data['close']}, 布林上轨{data['boll_upper']}, 下轨{data['boll_lower']}

## 4. 周期背景 (Context)
### 周线透视 (最近8周)
| 周末日期 | 收盘 | 涨跌幅 | MA20 | RSI |
|----------|------|--------|------|-----|
{chr(10).join(weekly_summary)}
- **季度区间(近12周)**: {weekly_stats['low']} ~ {weekly_stats['high']}

### 月线透视 (最近3个月)
| 月末日期 | 收盘 | 涨跌幅 |
|----------|------|--------|
{chr(10).join(monthly_summary)}
- **年度区间(近12个月)**: {monthly_stats['low']} ~ {monthly_stats['high']}
- **长期趋势**: {"牛市" if data['close'] > monthly_stats['ma20'] else "熊市/调整"} (当前价 vs 20月线)

{prediction_review}

## 核心指令
请基于上述数据进行推理，并生成**严格合法的 JSON**响应。

👉 **核心原则：宁缺勿滥 (Better safe than sorry)。**
- **默认观望**：请默认输出 **Side**。只有当你发现胜率超过 **80%** 的极佳机会（多周期共振、且有明确催化剂）时，才允许输出 **Long** 或 **Short**。
- **拒识机制**：对于任何模棱两可、缺乏关键催化剂、或风险收益比不佳的情况，请坚决输出 **Side**。

{context_instruction}

👉 **如果具备联网能力，请务必搜索该股票在过去48小时内的重磅新闻（财报、监管、重大合同），并将新闻影响纳入决策。**
    **IMPORTANT OUTPUT RULE**: Generate PURE JSON only. NO Markdown. NO ```json fencing. Ensure the JSON is valid and closed with '}}'. """

    return system_prompt, user_prompt
