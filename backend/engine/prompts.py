import asyncio
import json
from typing import Dict, Any, List
import pandas as pd
from database import get_connection, get_stock_profile
from backend.db_repo.queries import (
    GET_STOCK_NAME_QUERY, 
    FETCH_PREDICTION_HISTORY_QUERY, 
    FETCH_ACCURACY_STATS_QUERY,
    get_fetch_history_sql
)
from backend.engine.context import SessionContext
from backend.templating import render_template


def _is_period_history_sane(rows: List[Dict[str, Any]], period: str) -> bool:
    """
    Detect daily-like leakage in weekly/monthly history.
    """
    if not rows or len(rows) < 3:
        return True

    date_series = pd.to_datetime(
        pd.Series([r.get("date") for r in rows]),
        errors="coerce",
    ).dropna().sort_values()

    if len(date_series) < 3:
        return True

    diffs = date_series.diff().dropna().dt.days
    if diffs.empty:
        return True

    threshold = 4 if period == "weekly" else 20
    bad_ratio = float((diffs < threshold).sum()) / float(len(diffs))
    return bad_ratio <= 0.15


def _aggregate_daily_to_period_bars(daily_rows: List[Dict[str, Any]], period: str) -> List[Dict[str, Any]]:
    if not daily_rows:
        return []

    df = pd.DataFrame(daily_rows)
    required_cols = {"date", "open", "high", "low", "close", "volume"}
    if not required_cols.issubset(df.columns):
        return []

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = (
        df.dropna(subset=["date", "open", "high", "low", "close", "volume"])
        .sort_values("date")
        .drop_duplicates(subset=["date"], keep="last")
    )
    if df.empty:
        return []

    if period == "weekly":
        df["_bucket"] = df["date"].dt.to_period("W-FRI")
    else:
        df["_bucket"] = df["date"].dt.to_period("M")

    bars = (
        df.groupby("_bucket", sort=True, as_index=False)
        .agg(
            date=("date", "max"),
            open=("open", "first"),
            high=("high", "max"),
            low=("low", "min"),
            close=("close", "last"),
            volume=("volume", "sum"),
        )
        .sort_values("date")
        .reset_index(drop=True)
    )
    bars["change_percent"] = bars["close"].pct_change().fillna(0) * 100

    # Rebuild period indicators so prompt fields (MA20/RSI/MACD) remain consistent.
    try:
        from backend.engine.indicators import calculate_indicators
        bars = calculate_indicators(bars)
    except Exception:
        # Small samples can break third-party indicator internals; degrade gracefully.
        for col in [
            "ma5", "ma10", "ma20", "ma60",
            "macd", "macd_signal", "macd_hist",
            "boll_lower", "boll_mid", "boll_upper",
            "rsi", "kdj_k", "kdj_d", "kdj_j",
        ]:
            if col not in bars.columns:
                bars[col] = 0
    bars["date"] = bars["date"].dt.strftime("%Y-%m-%d")

    fields = ["date", "open", "high", "low", "close", "change_percent", "volume", "ma20", "rsi", "macd_hist"]
    records = bars[fields].to_dict("records")
    records.sort(key=lambda x: x["date"], reverse=True)
    return records


async def fetch_full_analysis_context(symbol: str, as_of_date: str = None, ctx: SessionContext = None) -> Dict[str, Any]:
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
            "altitude_context": ctx.altitude,
            "macro_context": ctx.metadata.get("macro_context"),
            "market_flow_context": ctx.metadata.get("market_flow_context"),
            "stock_flow_context": ctx.metadata.get("stock_flow_context")
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
    # 3.1 Daily (Increased to 30 days for better support/resistance discovery)
    cursor.execute("""
        SELECT date, open, high, low, close, change_percent, volume,
               ma5, ma10, ma20, ma60,
               macd, macd_signal, macd_hist,
               rsi, kdj_k, kdj_d, kdj_j,
               boll_upper, boll_mid, boll_lower
        FROM daily_prices 
        WHERE symbol = ? AND date <= ?
        ORDER BY date DESC LIMIT 30
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

    # 3.4 Safety fallback: If period tables look daily-like, derive W/M from daily bars.
    weekly_ok = _is_period_history_sane(weekly_history, "weekly")
    monthly_ok = _is_period_history_sane(monthly_history, "monthly")
    need_weekly_fallback = (len(weekly_history) < 8) or (not weekly_ok)
    need_monthly_fallback = (len(monthly_history) < 3) or (not monthly_ok)

    if need_weekly_fallback or need_monthly_fallback:
        cursor.execute("""
            SELECT date, open, high, low, close, volume
            FROM daily_prices
            WHERE symbol = ? AND date <= ?
            ORDER BY date DESC LIMIT 1200
        """, (symbol, analysis_date))
        raw_daily = [dict(zip(["date", "open", "high", "low", "close", "volume"], r)) for r in cursor.fetchall()]
        raw_daily = raw_daily[::-1]  # oldest -> newest for aggregation

        if need_weekly_fallback:
            derived_weekly = _aggregate_daily_to_period_bars(raw_daily, "weekly")
            if derived_weekly:
                weekly_history = derived_weekly[:12]

        if need_monthly_fallback:
            derived_monthly = _aggregate_daily_to_period_bars(raw_daily, "monthly")
            if derived_monthly:
                monthly_history = derived_monthly[:12]

    # 4. Global Market Context (Via ContextService)
    from backend.engine.context_service import ContextService
    ctx_service = ContextService()
    
    # Use comprehensive context fetcher
    comprehensive_ctx = await ctx_service.get_comprehensive_context(symbol, analysis_date, stock_name)
    
    market_context = comprehensive_ctx.get("market_context", "数据同步中")
    altitude_context = comprehensive_ctx.get("price_altitude", {})
    macro_context = comprehensive_ctx.get("macro_context", {})
    market_flow_context = comprehensive_ctx.get("market_flow_context", {})
    stock_flow_context = comprehensive_ctx.get("stock_flow_context", {})

    # 5. Populate Context if provided
    if ctx:
        ctx.metadata = {
            "name": stock_name, 
            "profile": profile, 
            "latest_data": latest_data,
            "macro_context": macro_context,
            "market_flow_context": market_flow_context,
            "stock_flow_context": stock_flow_context
        }
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
        "altitude_context": altitude_context,
        "macro_context": macro_context,
        "market_flow_context": market_flow_context,
        "stock_flow_context": stock_flow_context
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
        # Backward-compatible sync bridge for callers that still use this helper
        # outside async execution (e.g., legacy ai_service/test scripts).
        try:
            asyncio.get_running_loop()
            return None, "prepare_stock_analysis_prompt requires pre-fetched ctx when called inside async loop"
        except RuntimeError:
            ctx = asyncio.run(fetch_full_analysis_context(symbol, as_of_date))
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

    # --- Structural levels & Volatility Insights ---
    daily_history = ctx.get("daily_prices", [])
    
    # 1. ATR-14 calculation (Approximate using 14-day history)
    atr_14 = 0
    if len(daily_history) >= 15:
        # TR = max(high - low, abs(high - prev_close), abs(low - prev_close))
        trs = []
        for i in range(1, 15):
            curr = daily_history[-(i)]
            prev = daily_history[-(i+1)]
            tr = max(
                curr['high'] - curr['low'],
                abs(curr['high'] - prev['close']),
                abs(curr['low'] - prev['close'])
            )
            trs.append(tr)
        atr_14 = sum(trs) / len(trs)

    # 2. Support/Resistance (20-day range)
    hist_20 = daily_history[-20:] if len(daily_history) >= 20 else daily_history
    high_20d = max([h['high'] for h in hist_20]) if hist_20 else close
    low_20d = min([h['low'] for h in hist_20]) if hist_20 else close
    
    # 3. Heavy Volume Area (Price of the highest volume day in 20 days)
    heavy_volume_price = 0
    if hist_20:
        max_vol_day = max(hist_20, key=lambda x: x['volume'] or 0)
        heavy_volume_price = max_vol_day['close']
    
    structural_hints = {
        "atr_14": round(atr_14, 3),
        "high_20d": high_20d,
        "low_20d": low_20d,
        "heavy_volume_anchor": heavy_volume_price,
        "ma60": ma60,
        "ma20": ma20
    }
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
        context_instruction = (
            f"👉 **历史复盘模式**：本次分析基准日为 {data['date']}。"
            "请仅基于该日及之前已提供的数据判断，不要引入之后的信息。"
        )
    else:
        context_instruction = f"👉 **实时分析**：今天是 {data['date']}。请基于提供的数据判断。"
    layer1 = ctx.get("layer1") or {}
    layer1_status = str(layer1.get("status") or "")
    if layer1_status:
        if layer1_status == "TriggeredLong":
            layer1_guidance = (
                "当前量化约束允许做多方向判断。"
                "若价格行为与结构位不支持，可降低置信度，但不要反向给出做空/避险结论。"
            )
        elif layer1_status in {"RiskOff", "Wait", "NoTrade", "Blocked"}:
            layer1_guidance = (
                "当前量化约束偏防守，不代表走势完全中性。"
                "你的职责是解释风险来源并给出等待/防守型战术，不要输出激进进攻判断。"
            )
        else:
            layer1_guidance = (
                "请将该状态视为优先级更高的风险约束信号。"
                "你的职责是解释其含义，并在战术与风控上保持一致，不要擅自弱化。"
            )
        context_instruction += (
            f"\n👉 **Layer-1 硬约束**：当前量化状态={layer1_status}。"
            f"{layer1_guidance}"
        )

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
            macro_context=ctx.get("macro_context") or {},
            market_flow_context=ctx.get("market_flow_context") or {},
            stock_flow_context=ctx.get("stock_flow_context") or {},
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
            structural_hints=structural_hints,
            context_instruction=context_instruction
        )
    except Exception as e:
        print(f"User Template rendering failed: {e}")
        return None, f"User Template Error: {e}"

    return system_prompt, user_prompt, final_version
