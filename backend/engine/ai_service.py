import json
import pandas as pd
from datetime import datetime, timedelta
from database import get_connection
from trading_calendar import get_next_trading_day_str
from config import LLM_CONFIG
from .llm_client import get_llm_client
from .prompts import prepare_stock_analysis_prompt

def generate_ai_prediction(symbol: str, today_data: pd.Series):
    """根据今日行情生成对明日的 AI 预测 (T 预测 T+1)"""
    today_str = today_data.get('date')
    if not today_str:
        return None

    # 1. 尝试使用 LLM 生成预测
    if LLM_CONFIG.get("enabled", False):
        try:
            print(f"   🤖 正在为 {symbol} 调用本地 LLM 进行分析...")
            system_prompt, user_prompt = prepare_stock_analysis_prompt(symbol)
            
            client = get_llm_client()
            ai_result = client.generate_stock_prediction(system_prompt, user_prompt, symbol=symbol)
            
            if ai_result and "signal" in ai_result:
                # 成功获取 LLM 预测
                ai_result["is_llm"] = True
                model_name = LLM_CONFIG.get("model", "unknown-llm")
                return _process_and_store_prediction(symbol, today_str, ai_result, model=model_name)
            else:
                print(f"   ⚠️ LLM 返回结果无效，将退回到规则引擎。")
        except Exception as e:
            print(f"   ❌ LLM 调用异常: {e}，将退回到规则引擎。")

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
    """基于硬编码规则的预测逻辑（回退方案）"""
    close = today_data.get('close', 0)
    ma20 = today_data.get('ma20', 0)
    rsi = today_data.get('rsi', 50)
    macd_hist = today_data.get('macd_hist', 0)
    macd_status = "金叉" if macd_hist > 0 else "死叉"
    support_price = today_data.get('ma20', close * 0.95)
    today_str = today_data.get('date')
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # 获取月度/周度参考数据
    cursor.execute("SELECT close, ma20 FROM monthly_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
    m_row = cursor.fetchone()
    monthly_trend = "Bull" if m_row and m_row[0] > m_row[1] else "Bear"

    cursor.execute("SELECT close, ma20 FROM weekly_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
    w_row = cursor.fetchone()
    weekly_trend = "Bull" if w_row and w_row[0] > w_row[1] else "Bear"
    
    # 基础信号判定
    if close < support_price * 0.98:
        signal = 'Short'
    elif close > ma20:
        signal = 'Long'
    else:
        signal = 'Side'
        
    if 45 <= rsi <= 55 and signal != 'Short': 
        signal = 'Side'

    resonance_count = 0
    if signal == 'Long':
        if monthly_trend == "Bull": resonance_count += 1
        if weekly_trend == "Bull": resonance_count += 1
    elif signal == 'Short':
        if monthly_trend == "Bear": resonance_count += 1
        if weekly_trend == "Bear": resonance_count += 1
    
    confidence_map = {0: 0.65, 1: 0.75, 2: 0.88}
    confidence = confidence_map.get(resonance_count, 0.60)
    if signal == 'Side': confidence = 0.50
    
    # 构建战术建议 (保持与 LLM 格式一致)
    ai_result = {
        "signal": signal,
        "confidence": confidence,
        "summary": "缩量震荡，维持观望" if signal == 'Side' else ("顺势做多" if signal == 'Long' else "避险为主"),
        "reasoning_trace": [
            {"step": "trend", "data": f"月:{'多' if monthly_trend=='Bull' else '空'} | 周:{'多' if weekly_trend=='Bull' else '空'}", "conclusion": "周期共振" if resonance_count == 2 else "长短博弈"},
            {"step": "momentum", "data": f"日线 RSI({rsi:.0f}) | MACD {macd_status}", "conclusion": "动能健康" if 40 <= rsi <= 60 else "极端行情"},
            {"step": "decision", "data": f"规则引擎计算", "conclusion": "执行策略库建议"}
        ],
        "tactics": {
            "holding": [{"priority": "P1", "action": "持仓待涨" if signal == 'Long' else "分批减仓", "trigger": "均线支撑", "reason": "跟随趋势"}],
            "empty": [{"priority": "P1", "action": "小仓试错" if signal != 'Short' else "观望", "trigger": "跌破点位", "reason": "风控"}],
            "general": [{"priority": "P3", "action": "关注板块", "trigger": "整体行情", "reason": "大盘环境"}]
        },
        "key_levels": {
            "support": round(float(support_price), 3),
            "resistance": round(float(ma20) * 1.05, 3),
            "stop_loss": round(float(support_price) * 0.97, 3)
        },
        "is_llm": False
    }
    
    conn.close()
    return _process_and_store_prediction(symbol, today_str, ai_result)

