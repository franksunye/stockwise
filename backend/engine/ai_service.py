import json
import pandas as pd
from datetime import datetime, timedelta
from database import get_connection
from trading_calendar import get_next_trading_day_str

def generate_ai_prediction(symbol: str, today_data: pd.Series):
    """根据今日行情生成对明日的 AI 预测 (T 预测 T+1)"""
    # 提取关键数据
    close = today_data.get('close', 0)
    ma20 = today_data.get('ma20', 0)
    rsi = today_data.get('rsi', 50)
    macd_hist = today_data.get('macd_hist', 0)
    macd_status = "金叉" if macd_hist > 0 else "死叉"
    support_price = today_data.get('ma20', close * 0.95)
    
    # 策略决策
    conn = get_connection()
    cursor = conn.cursor()
    
    # 获取月度/周度参考数据 (战略与波段背景)
    cursor.execute("""
        SELECT close, ma20 FROM monthly_prices 
        WHERE symbol = ? ORDER BY date DESC LIMIT 1
    """, (symbol,))
    m_row = cursor.fetchone()
    monthly_trend = "Bull" if m_row and m_row[0] > m_row[1] else "Bear"

    cursor.execute("""
        SELECT close, ma20 FROM weekly_prices 
        WHERE symbol = ? ORDER BY date DESC LIMIT 1
    """, (symbol,))
    w_row = cursor.fetchone()
    weekly_trend = "Bull" if w_row and w_row[0] > w_row[1] else "Bear"
    
    # 基础信号判定 (基于日线)
    if close < support_price * 0.98:
        signal = 'Short'
    elif close > ma20:
        signal = 'Long'
    else:
        signal = 'Side'
        
    if 45 <= rsi <= 55 and signal != 'Short': 
        signal = 'Side'

    # 置信度权重分配：基于三期共振
    # 规则：多周期方向一致则大幅提升置信度
    confidence = 0.60
    resonance_count = 0
    if signal == 'Long':
        if monthly_trend == "Bull": resonance_count += 1
        if weekly_trend == "Bull": resonance_count += 1
    elif signal == 'Short':
        if monthly_trend == "Bear": resonance_count += 1
        if weekly_trend == "Bear": resonance_count += 1
    
    # 根据共振程度计算置信度
    confidence_map = {0: 0.65, 1: 0.75, 2: 0.88}
    confidence = confidence_map.get(resonance_count, 0.60)
    if signal == 'Side': confidence = 0.50
    
    # 构建更详细的战术建议
    tactics = {
        "holding": [
            {"priority": "P1", "action": "持仓待涨", "trigger": "股价保持在 MA20 上方", "reason": "跟随趋势"} if signal == 'Long' else 
            {"priority": "P1", "action": "分批减仓", "trigger": f"反弹至 {ma20:.2f} 遇阻", "reason": "降低风险"},
            {"priority": "P2", "action": "止损离场", "trigger": f"跌破 {support_price:.2f} 且30分钟不收回", "reason": "防止亏损扩大"}
        ],
        "empty": [
            {"priority": "P1", "action": "小仓试错", "trigger": f"回踩 {support_price:.2f} 不破且放量", "reason": "博取反弹"} if signal != 'Short' else
            {"priority": "P1", "action": "观望/谨慎", "trigger": f"等待站稳 {ma20:.2f}", "reason": "右侧交易更稳健"},
            {"priority": "P2", "action": "加入自选", "trigger": "量能缩至极致后出现倍量", "reason": "识别变盘信号"}
        ],
        "general": [
            {"priority": "P3", "action": "关注板块", "trigger": "港股生物医药板块整体回暖", "reason": "板块共振提高胜率"},
            {"priority": "P3", "action": "风控提醒", "trigger": "若大盘跌破关键支撑", "reason": "系统性风险需防范"}
        ]
    }
    
    # 构建三层透明体验：推理链 (Reasoning Trace)
    # 注意：需要将 numpy 类型转换为 Python 原生类型以支持 JSON 序列化
    volume_int = int(today_data['volume']) if today_data.get('volume') else 0
    
    reasoning_trace = [
        {
            "step": "trend",
            "data": f"月:{'多' if monthly_trend=='Bull' else '空'} | 周:{'多' if weekly_trend=='Bull' else '空'}",
            "conclusion": "周期共振" if resonance_count == 2 else "长短博弈"
        },
        {
            "step": "momentum",
            "data": f"日线 RSI({rsi:.0f}) | MACD {macd_status}",
            "conclusion": "动能健康" if 40 <= rsi <= 60 else "极端行情"
        },
        {
            "step": "volume",
            "data": f"今日成交 {volume_int:,}",
            "conclusion": "量能稳定" if volume_int > 1000000 else "缩量震荡"
        },
        {
            "step": "decision",
            "data": f"共振得分: {resonance_count}/2 | 信号: {signal}",
            "conclusion": "执行防御" if signal != 'Long' else "执行进攻"
        }
    ]
    
    reasoning_data = {
        "summary": "缩量震荡，维持观望" if signal == 'Side' else ("顺势做多" if signal == 'Long' else "避险为主"),
        "reasoning_trace": reasoning_trace,
        "tactics": tactics,
        "key_levels": {
            "support": round(float(support_price), 3),
            "resistance": round(float(ma20) * 1.05, 3),
            "stop_loss": round(float(support_price) * 0.97, 3)
        },
        "conflict_resolution": "趋势优先（MA20） > 动能（RSI）",
        "tomorrow_focus": f"能否有效突破 {ma20:.2f} 并实现量比 > 1.2"
    }
    
    reasoning = json.dumps(reasoning_data, ensure_ascii=False)

    # 存储到数据库
    today_str = today_data.get('date')
    if not today_str:
        return None
        
    # 计算下一个交易日（考虑周末和假期，根据股票代码自动选择市场日历）
    target_date = get_next_trading_day_str(today_str, symbol=symbol)

    cursor.execute("""
        INSERT OR REPLACE INTO ai_predictions 
        (symbol, date, target_date, signal, confidence, support_price, ai_reasoning, validation_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')
    """, (symbol, today_str, target_date, signal, confidence, support_price, reasoning))
    
    conn.commit()
    conn.close()
    print(f"   🔮 系统建议 ({today_str}): 信号={signal}, 置信度={confidence:.0%}, 共振={resonance_count}/2")
    
    return {
        "signal": signal,
        "confidence": confidence,
        "resonance_count": resonance_count,
        "support_price": support_price,
        **reasoning_data
    }
