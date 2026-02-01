import json
from typing import Dict, Any, List
from database import get_connection, get_stock_profile
from backend.db_repo.queries import (
    GET_STOCK_NAME_QUERY, 
    FETCH_PREDICTION_HISTORY_QUERY, 
    FETCH_ACCURACY_STATS_QUERY,
    get_fetch_history_sql
)
from backend.engine.context import SessionContext
from backend.templating import render_template

def fetch_full_analysis_context(symbol: str, as_of_date: str = None, ctx: SessionContext = None) -> Dict[str, Any]:
    """
    Fetch all raw data needed for a comprehensive stock analysis.
    Supports SessionContext for caching across multiple model runs.
    """
    # 0. Check Cache
    if ctx and ctx.metadata and ctx.price_data["daily"]:
        ctx.hits += 1
        return {
            "symbol": symbol,
            "name": ctx.metadata.get("name"),
            "date": ctx.date,
            "profile": ctx.metadata.get("profile"),
            "latest_data": ctx.metadata.get("latest_data"),
            "daily_prices": ctx.price_data["daily"],
            "weekly_prices": ctx.price_data["weekly"],
            "monthly_prices": ctx.price_data["monthly"],
            "market_context": ctx.market_mood,
            "altitude_context": ctx.altitude
        }

    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Basic Meta
    cursor.execute(GET_STOCK_NAME_QUERY, (symbol,))
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
    
    # 3. History (Cacheable)
    # 3.1 Daily (10 days)
    cursor.execute("""
        SELECT date, open, high, low, close, change_percent, volume,
               ma5, ma10, ma20, ma60,
               macd, macd_signal, macd_hist,
               rsi, kdj_k, kdj_d, kdj_j,
               boll_upper, boll_mid, boll_lower
        FROM daily_prices 
        WHERE symbol = ? AND date <= ?
        ORDER BY date DESC LIMIT 10
    """, (symbol, analysis_date))
    daily_history = [dict(zip([
        "date", "open", "high", "low", "close", "change_percent", "volume",
        "ma5", "ma10", "ma20", "ma60",
        "macd", "macd_signal", "macd_hist",
        "rsi", "kdj_k", "kdj_d", "kdj_j",
        "boll_upper", "boll_mid", "boll_lower"
    ], h)) for h in cursor.fetchall()]
    daily_history = daily_history[::-1]

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

    # 4. Global Market Context
    from backend.engine.context_service import ContextService
    ctx_service = ContextService()
    market_context = ctx_service._get_cached_market_mood(analysis_date, symbol)
    altitude_context = ctx_service._calculate_altitude(symbol, analysis_date)

    # 5. Populate Context if provided
    if ctx:
        ctx.metadata = {"name": stock_name, "profile": profile, "latest_data": latest_data}
        ctx.price_data["daily"] = daily_history
        ctx.price_data["weekly"] = weekly_history
        ctx.price_data["monthly"] = monthly_history
        ctx.market_mood = market_context
        ctx.altitude = altitude_context

    return {
        "symbol": symbol,
        "name": stock_name,
        "date": analysis_date,
        "profile": profile,
        "latest_data": latest_data,
        "daily_prices": daily_history, 
        "weekly_prices": weekly_history,
        "monthly_prices": monthly_history,
        "market_context": market_context,
        "altitude_context": altitude_context
    }

def fetch_ai_history_for_model(symbol: str, analysis_date: str, model_id: str = None, cursor = None, ctx: SessionContext = None) -> Dict[str, Any]:
    """
    Fetch historical predictions for a specific model or the primary decisions.
    Supports SessionContext for caching.
    """
    # 0. Check Cache
    cache_key = model_id if model_id else "primary"
    if ctx:
        cached = ctx.get_model_history(cache_key)
        if cached: return cached

    _conn = None
    if cursor is None:
        _conn = get_connection()
        cursor = _conn.cursor()
    
    # If model_id is None, use is_primary = 1
    filter_sql = "is_primary = 1" if model_id is None else "model_id = ?"
    params = (symbol, analysis_date) if model_id is None else (symbol, model_id, analysis_date)

    try:
        # 1. History
        cursor.execute(FETCH_PREDICTION_HISTORY_QUERY.format(filter_sql=filter_sql), params + (5,))
        ai_history = [dict(zip(["date", "signal", "confidence", "ai_reasoning", "validation_status", "actual_change", "model"], a)) for a in cursor.fetchall()]

        # 2. Accuracy Stats
        cursor.execute(FETCH_ACCURACY_STATS_QUERY.format(filter_sql=filter_sql), params)
        stats_row = cursor.fetchone()
        total_predictions = stats_row[0] if stats_row else 0
        correct_count = stats_row[1] if stats_row else 0
        accuracy_rate = (correct_count / total_predictions * 100) if total_predictions > 0 else 0
        
        result = {
            "ai_history": ai_history,
            "accuracy": {
                "total": total_predictions,
                "rate": accuracy_rate
            }
        }
        
        # 3. Save to Cache
        if ctx:
            ctx.set_model_history(cache_key, result)
            
        return result
    finally:
        if _conn:
            _conn.close()

def prepare_stock_analysis_prompt(symbol: str, as_of_date: str = None, ctx: Dict[str, Any] = None):
    """
    准备用于 LLM 分析的系统提示词和用户输入数据
    (One-shot 模式专用) - 已迁移至 Jinja2 模板
    """
    if ctx is None:
        ctx = fetch_full_analysis_context(symbol, as_of_date)
    if "error" in ctx:
        return None, ctx["error"]

    # System Prompt (Jinja2 Template)
    try:
        system_prompt = render_template('prompts/stock_analysis_system.j2')
    except Exception as e:
        print(f"System Template rendering failed: {e}")
        return None, f"System Template Error: {e}"

    data = ctx["latest_data"]
    
    # --- Data Preparation for User Prompt ---

    # 1. Tech Analysis Logic (Calculated here, passed to template)
    ma5, ma10, ma20, ma60 = data.get('ma5', 0), data.get('ma10', 0), data.get('ma20', 0), data.get('ma60', 0)
    close = data.get('close', 0)
    
    # Trend
    if ma5 and ma10 and ma20:
        if ma5 > ma10 > ma20:
            ma_alignment = f"MA5({ma5}) > MA10({ma10}) > MA20({ma20}) ✅ 短期多头"
            trend_score = 2
        elif ma5 < ma10 < ma20:
            ma_alignment = f"MA5({ma5}) < MA10({ma10}) < MA20({ma20}) ❌ 短期空头"
            trend_score = -2
        else:
            ma_alignment = "均线纠缠震荡"
            trend_score = 0
    else:
        ma_alignment = "均线数据不足"
        trend_score = 0
        
    if close > ma5: price_pos_desc = "站上所有短期均线 ✅"
    elif close > ma20: price_pos_desc = "回踩MA20支撑"
    else: price_pos_desc = "跌破MA20支撑 ❌"
    
    mid_term_desc = f"MA60({ma60}) {'向上' if close > ma60 else '承压'}" if ma60 else "MA60 数据不足"

    # Momentum
    rsi = data.get('rsi', 50)
    if rsi > 70: 
        rsi_desc = "超买 (Overbought)"
        rsi_score = -1
    elif rsi < 30: 
        rsi_desc = "超卖 (Oversold)"
        rsi_score = 1
    else: 
        rsi_desc = "中性区间"
        rsi_score = 0
    
    k, d, j = data.get('kdj_k', 50), data.get('kdj_d', 50), data.get('kdj_j', 50)
    if k > d:
        kdj_desc = "K>D 金叉向上"
        kdj_score = 1
    else:
        kdj_desc = "K<D 死叉向下"
        kdj_score = -1
        
    macd = data.get('macd', 0)
    macd_hist = data.get('macd_hist', 0)
    # Get previous hist for trend
    daily_history = ctx.get("daily_prices", [])
    prev_hist = daily_history[-2].get('macd_hist', 0) if len(daily_history) >= 2 else 0
    
    if macd_hist > 0:
        macd_desc = "金叉 (多头)"
        macd_score = 1
        if macd_hist < prev_hist: 
            macd_desc += " ⚠️ 动能减弱"
            macd_score = 0 
    else:
        macd_desc = "死叉 (空头)"
        macd_score = -1
        if macd_hist > prev_hist: 
            macd_desc += " 💡 快线收敛中"
            macd_score = 0 

    # Position
    b_up = data.get('boll_upper', 0)
    b_mid = data.get('boll_mid', 0)
    b_low = data.get('boll_lower', 0)
    
    boll_score = 0
    boll_desc = "通道无效"
    if b_up and b_low and b_up > b_low:
        pct_b = (close - b_low) / (b_up - b_low) * 100
        if pct_b > 90:
            boll_desc = f"{pct_b:.0f}% (触及上轨压力)"
            boll_score = -1 
        elif pct_b > 70:
            boll_desc = f"{pct_b:.0f}% (强势区)"
            boll_score = 1 
        elif pct_b > 30:
            boll_desc = f"{pct_b:.0f}% (中轨平衡区)"
            boll_score = 0
        elif pct_b > 10:
            boll_desc = f"{pct_b:.0f}% (弱势区)"
            boll_score = -1
        else:
            boll_desc = f"{pct_b:.0f}% (触及下轨支撑)"
            boll_score = 1 
            
    total_score = trend_score + rsi_score + kdj_score + macd_score + boll_score
    score_meaning = "强烈看多" if total_score >= 4 else ("偏多" if total_score > 0 else ("强烈看空" if total_score <= -4 else ("偏空" if total_score < 0 else "完全中性")))

    tech_data = {
        "ma_alignment": ma_alignment,
        "price_pos_desc": price_pos_desc,
        "mid_term_desc": mid_term_desc,
        "macd_desc": macd_desc,
        "rsi": rsi,
        "rsi_desc": rsi_desc,
        "k": k, "d": d,
        "kdj_desc": kdj_desc,
        "boll_desc": boll_desc,
        "trend_score": trend_score,
        "macd_score": macd_score,
        "rsi_score": rsi_score,
        "kdj_score": kdj_score,
        "boll_score": boll_score,
        "total_score": total_score,
        "score_meaning": score_meaning
    }

    # 2. Process AI History (Extract summary from JSON)
    processed_ai_history = []
    if ctx.get("ai_history"):
        for pred in ctx["ai_history"]:
            p = pred.copy()
            summary = ""
            try:
                reasoning_data = json.loads(pred['ai_reasoning']) if pred['ai_reasoning'] else {}
                summary = reasoning_data.get("summary", "")[:15]
            except: pass
            p['summary'] = summary
            processed_ai_history.append(p)

    # 3. Stats
    weekly_stats = {
        "high": max([w['high'] for w in ctx["weekly_prices"]]) if ctx["weekly_prices"] else 0,
        "low": min([w['low'] for w in ctx["weekly_prices"]]) if ctx["weekly_prices"] else 0,
    }
    monthly_stats = {
        "high": max([m['high'] for m in ctx["monthly_prices"]]) if ctx["monthly_prices"] else 0,
        "low": min([m['low'] for m in ctx["monthly_prices"]]) if ctx["monthly_prices"] else 0,
    }

    # 4. Context Instruction
    if as_of_date:
        context_instruction = f"👉 **回填模式**：请假装今天是 {data['date']}。仅基于提供的数据判断。"
    else:
        context_instruction = f"👉 **实时分析**：今天是 {data['date']}。请基于提供的数据判断。"

    # Get Version
    from backend.templating import get_template_version
    final_version = get_template_version('prompts/stock_analysis_system.j2', default="v1.0")

    # Render User Prompt
    try:
        user_prompt = render_template('prompts/stock_analysis_user.j2',
            stock_name=ctx.get("name", "未知股票"),
            symbol=symbol,
            date=data['date'],
            market_context=ctx.get("market_context", "数据同步中，请以此个股分析为主"),
            altitude_str="短期(20d) {} | 中期(60d) {} | 长期(250d) {}".format(
                ctx.get("altitude_context", {}).get('short_term_20d', '-'),
                ctx.get("altitude_context", {}).get('medium_term_60d', '-'),
                ctx.get("altitude_context", {}).get('long_term_250d', '-')
            ),
            profile=ctx["profile"],
            daily_history=ctx["daily_prices"][::-1],
            weekly_history=ctx["weekly_prices"][:8],
            weekly_stats=weekly_stats,
            monthly_history=ctx["monthly_prices"][:3],
            monthly_stats=monthly_stats,
            long_term_trend="牛市" if data['close'] > (ctx["monthly_prices"][0]['ma20'] if ctx["monthly_prices"] else 0) else "熊市/调整",
            ai_history=processed_ai_history,
            ai_accuracy=ctx.get("accuracy", {"total":0, "rate":0}),
            tech=tech_data,
            context_instruction=context_instruction
        )
    except Exception as e:
        print(f"User Template rendering failed: {e}")
        return None, f"User Template Error: {e}"

    return system_prompt, user_prompt, final_version
