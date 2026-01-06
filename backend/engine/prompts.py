import json
from database import get_connection, get_stock_profile

def prepare_stock_analysis_prompt(symbol: str, as_of_date: str = None):
    """
    准备用于 LLM 分析的系统提示词和用户输入数据
    
    Args:
        symbol: 股票代码
        as_of_date: 截止日期 (YYYY-MM-DD)，用于回填历史分析。
                    如果为 None，则使用最新数据（正常每日分析场景）
    """
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
    
    # 2. 获取行情和指标 (根据 as_of_date 决定是最新还是历史)
    if as_of_date:
        # 回填模式：获取指定日期的数据
        cursor.execute("""
            SELECT * FROM daily_prices 
            WHERE symbol = ? AND date = ?
        """, (symbol, as_of_date))
    else:
        # 正常模式：获取最新数据
        cursor.execute("""
            SELECT * FROM daily_prices 
            WHERE symbol = ? 
            ORDER BY date DESC LIMIT 1
        """, (symbol,))
    
    # 获取列名映射
    columns = [description[0] for description in cursor.description]
    row = cursor.fetchone()
    
    if not row:
        # Don't close global connection
        return None, f"未找到股票 {symbol} 的行情数据" + (f" (日期: {as_of_date})" if as_of_date else "")

    data = dict(zip(columns, row))
    analysis_date = data['date']  # 实际分析的日期
    
    # 3. 获取历史行情 (以 analysis_date 为基准往前取)
    # 3.1 日线：获取近10日历史行情
    cursor.execute("""
        SELECT date, open, high, low, close, change_percent, volume
        FROM daily_prices 
        WHERE symbol = ? AND date <= ?
        ORDER BY date DESC LIMIT 10
    """, (symbol, analysis_date))
    history_rows = cursor.fetchall()

    # 3.2 周线：获取近12周数据 (截止到 analysis_date)
    cursor.execute("""
        SELECT date, open, high, low, close, change_percent, volume, ma20, rsi
        FROM weekly_prices 
        WHERE symbol = ? AND date <= ?
        ORDER BY date DESC LIMIT 12
    """, (symbol, analysis_date))
    weekly_rows = cursor.fetchall()
    
    weekly_detail = weekly_rows[:8] if weekly_rows else []
    weekly_stats = {
        "high": max([w[2] for w in weekly_rows]) if weekly_rows else 0,
        "low": min([w[3] for w in weekly_rows]) if weekly_rows else 0,
    }

    # 3.3 月线：获取近12个月数据 (截止到 analysis_date)
    cursor.execute("""
        SELECT date, open, high, low, close, change_percent, volume, ma20, rsi
        FROM monthly_prices 
        WHERE symbol = ? AND date <= ?
        ORDER BY date DESC LIMIT 12
    """, (symbol, analysis_date))
    monthly_rows = cursor.fetchall()
    
    monthly_detail = monthly_rows[:3] if monthly_rows else []
    monthly_stats = {
        "high": max([m[2] for m in monthly_rows]) if monthly_rows else 0,
        "low": min([m[3] for m in monthly_rows]) if monthly_rows else 0,
        "ma20": monthly_rows[0][7] if monthly_rows else 0,
        "rsi": monthly_rows[0][8] if monthly_rows else 0
    }

    # 4. 获取历史 AI 预测记录 (截止到 analysis_date 之前)
    cursor.execute("""
        SELECT date, signal, confidence, ai_reasoning, validation_status, actual_change
        FROM ai_predictions 
        WHERE symbol = ? AND validation_status != 'Pending' AND date < ?
        ORDER BY date DESC LIMIT 5
    """, (symbol, analysis_date))
    recent_predictions = cursor.fetchall()
    
    # 5. 获取全局预测统计 (截止到 analysis_date 之前)
    cursor.execute("""
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN validation_status = 'Correct' THEN 1 ELSE 0 END) as correct,
            SUM(CASE WHEN validation_status = 'Incorrect' THEN 1 ELSE 0 END) as incorrect
        FROM ai_predictions 
        WHERE symbol = ? AND validation_status != 'Pending' AND date < ?
    """, (symbol, analysis_date))
    stats = cursor.fetchone()
    total_predictions, correct_count, incorrect_count = stats if stats else (0, 0, 0)
    accuracy_rate = (correct_count / total_predictions * 100) if total_predictions > 0 else 0
    
    # Don't close global connection

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

    # System Prompt (融合版：由简入繁，既要格式也要灵魂)
    system_prompt = """你是 StockWise 的 AI 决策助手，专门为个人投资者提供股票操作建议。

## 你的核心原则
1. **理性锚点**：你不预测涨跌，你提供"执行纪律"的触发条件。
2. **个性化**：根据用户是"已持仓"还是"未建仓"，提供差异化的行动建议。
3. **可验证**：每条建议都有明确的触发条件，事后可验证对错。
4. **简洁直白**：使用普通人能秒懂的语言，避免晦涩术语。
5. **板块联动**：请结合你对该公司所属行业、板块特性及市场环境的理解，给出更有背景的建议。
6. **事件驱动**：如果你具备搜索能力，请尝试搜索该公司近期的重大新闻、公告或事件，并将其纳入分析（如无搜索能力可跳过此步）。

## 任务目标
根据提供的股票数据，生成 JSON 格式的操作建议。

## 严格约束
1. **必须输出纯 JSON**：不要包含 ```json 或 ``` 标记，不要包含任何前言或后记。
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
