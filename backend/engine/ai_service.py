import json
import pandas as pd
from datetime import datetime, timedelta
from database import get_connection
from trading_calendar import get_next_trading_day_str
from config import LLM_CONFIG
from .llm_client import get_llm_client
from .prompts import prepare_stock_analysis_prompt
from logger import logger

def generate_ai_prediction(symbol: str, today_data: pd.Series, mode: str = 'ai', as_of_date: str = None):
    """
    根据今日行情生成对明日的 AI 预测 (T 预测 T+1)
    
    Args:
        symbol: 股票代码
        today_data: 当日行情数据 (pandas Series)
        mode: 分析模式 ('ai' 或 'rule')
        as_of_date: 回填日期，传入此参数时会使用历史数据构建 prompt
    """
    today_str = today_data.get('date')
    if not today_str:
        return None

    # 1. 尝试使用 LLM 生成预测
    is_llm_enabled = LLM_CONFIG.get("enabled", False)
    if is_llm_enabled and mode == 'ai':
        try:
            logger.info(f"   🤖 正在为 {symbol} 调用 {LLM_CONFIG.get('provider', 'LLM').upper()} 进行分析...")
            # 传入 as_of_date 用于回填场景
            system_prompt, user_prompt = prepare_stock_analysis_prompt(symbol, as_of_date=as_of_date)
            
            client = get_llm_client()
            ai_result = client.generate_stock_prediction(system_prompt, user_prompt, symbol=symbol)
            
            if ai_result and "signal" in ai_result:
                # 成功获取 LLM 预测
                ai_result["is_llm"] = True
                
                # --- 置信度熔断 (Circuit Breaker) ---
                # 即使 AI 给出了信号，如果置信度不足，强制转为观望。
                # 这是 LLM "Rejection" 的风控兜底，抵消 Hallucination 和 Overconfidence。
                SAFE_THRESHOLD = 0.75
                raw_signal = ai_result.get("signal", "Side")
                raw_confidence = ai_result.get("confidence", 0.0)

                if raw_signal in ["Long", "Short"] and raw_confidence < SAFE_THRESHOLD:
                    logger.warning(f"   🛡️ 触发风控熔断: {symbol} 原始信号 {raw_signal} (置信度 {raw_confidence:.2f} < {SAFE_THRESHOLD}) -> 强制观望")
                    ai_result["signal"] = "Side"
                    ai_result["confidence"] = 0.5  # 重置为中性分
                    # 在摘要中追加说明，告知用户
                    original_summary = ai_result.get("summary", "")
                    ai_result["summary"] = f"[系统风控] 原始信心不足({raw_confidence:.0%})，强制防御。{original_summary}"
                # ------------------------------------

                model_name = ai_result.get("model") or LLM_CONFIG.get("model", "unknown-llm")
                return _process_and_store_prediction(symbol, today_str, ai_result, model=model_name)
            else:
                logger.warning(f"   ⚠️ LLM 返回结果无效 (缺失 signal)，将退回到规则引擎。")
        except Exception as e:
            logger.error(f"   ❌ LLM 调用异常: {e}，将退回到规则引擎。")
    else:
        reason = "LLM 已禁用" if not is_llm_enabled else "分析模式非 AI"
        logger.info(f"   ⚪ 跳过 LLM 分析 ({reason})，正在进入规则引擎...")

    # 2. 规则引擎 (回退方案)
    return _generate_rule_based_prediction(symbol, today_data)

def _process_and_store_prediction(symbol, date, ai_result, model="rule-based"):
    """处理并存储 AI/规则生成的预测结果"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 提取核心指标
    signal = ai_result.get("signal", "Side")
    confidence = ai_result.get("confidence", 0.5)
    support_price = ai_result.get("key_levels", {}).get("support", 0)
    
    # 计算下一个交易日
    target_date = get_next_trading_day_str(date, symbol=symbol)
    
    # 序列化推理过程
    reasoning = json.dumps(ai_result, ensure_ascii=False)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        INSERT OR REPLACE INTO ai_predictions 
        (symbol, date, target_date, signal, confidence, support_price, ai_reasoning, validation_status, model, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)
    """, (symbol, date, target_date, signal, confidence, support_price, reasoning, model, now))
    
    conn.commit()
    conn.close()
    
    source = "AI" if ai_result.get("is_llm") else "Rule"
    print(f"   🔮 {source} 建议 ({date}): 信号={signal}, 置信度={confidence:.0%}, 模型={model}")
    
    return ai_result


def _generate_rule_based_prediction(symbol: str, today_data: pd.Series):
    """基于 QuantEngine 的预测逻辑（回退方案）"""
    today_str = today_data.get('date')
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # 获取月度/周度参考数据
    cursor.execute("SELECT * FROM monthly_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
    m_row = cursor.fetchone()
    if m_row:
        m_cols = [d[0] for d in cursor.description]
        monthly_series = pd.Series(dict(zip(m_cols, m_row)))
    else:
        monthly_series = None

    cursor.execute("SELECT * FROM weekly_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
    w_row = cursor.fetchone()
    if w_row:
         w_cols = [d[0] for d in cursor.description]
         weekly_series = pd.Series(dict(zip(w_cols, w_row)))
    else:
         weekly_series = None
    
    conn.close()

    # Call Quant Engine
    from backend.quant.engine import QuantEngine
    engine = QuantEngine()
    
    context = {
        'daily_row': today_data,
        'weekly_row': weekly_series,
        'monthly_row': monthly_series
    }
    
    # Run Strategy
    analysis_result = engine.run(symbol, context, strategy_name="trend")
    sig = analysis_result.signal
    
    # Convert back to legacy dictionary format for compatibility
    # Explicitly mapping QuantSignal fields to the dictionary expected by _process_and_store_prediction
    
    # Re-construct reasoning trace to match legacy format EXACTLY for frontend compatibility
    monthly_trend = sig.factors.get('monthly_trend', '未知')
    weekly_trend = sig.factors.get('weekly_trend', '未知')
    resonance_count = sig.factors.get('resonance', 0)
    rsi = sig.factors.get('rsi', 0)
    macd_hist = sig.factors.get('macd_hist', 0)
    macd_status = "金叉" if macd_hist > 0 else "死叉"
    
    ai_result = {
        "signal": sig.action,
        "confidence": sig.confidence,
        "summary": "缩量震荡，维持观望" if sig.action == 'Side' else ("顺势做多" if sig.action == 'Long' else "避险为主"),
        "reasoning_trace": [
            {"step": "trend", "data": f"月:{monthly_trend} | 周:{weekly_trend}", "conclusion": "周期共振" if resonance_count == 2 else "长短博弈"},
            {"step": "momentum", "data": f"日线 RSI({rsi:.0f}) | MACD {macd_status}", "conclusion": "动能健康" if 40 <= rsi <= 60 else "行情极端"},
            {"step": "decision", "data": f"量化引擎 ({sig.source_model})", "conclusion": f"{sig.reason}"}
        ],
        "tactics": {
            "holding": [{"priority": "P1", "action": "持仓待涨" if sig.action == 'Long' else "分批减仓", "trigger": "均线支撑", "reason": "跟随趋势"}],
            "empty": [{"priority": "P1", "action": "小仓试错" if sig.action != 'Short' else "观望", "trigger": "跌破点位", "reason": "风控"}],
            "general": [{"priority": "P3", "action": "关注板块", "trigger": "整体行情", "reason": "大盘环境"}]
        },
        "key_levels": {
            # Recalculate or use what we have. Support was roughly ma20. 
            # TrendStrategy doesn't return key_levels explicitly in factors yet, but factors has ma20.
            "support": round(float(sig.factors.get('ma20', 0)), 3),
            "resistance": round(float(sig.factors.get('ma20', 0)) * 1.05, 3),
            "stop_loss": round(float(sig.factors.get('ma20', 0)) * 0.97, 3)
        },
        "is_llm": False
    }
    
    return _process_and_store_prediction(symbol, today_str, ai_result)

