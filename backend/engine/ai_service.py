import json
import pandas as pd
from datetime import datetime, timedelta
from database import get_connection

def generate_ai_prediction(symbol: str, today_data: pd.Series):
    """根据今日行情生成对明日的 AI 预测 (T 预测 T+1)"""
    # 提取关键数据
    close = today_data.get('close', 0)
    ma20 = today_data.get('ma20', 0)
    rsi = today_data.get('rsi', 50)
    support_price = today_data.get('ma20', close * 0.95)
    
    # 策略决策
    if close < support_price * 0.98:
        signal = 'Short'
    elif close > ma20:
        signal = 'Long'
    else:
        signal = 'Side'
        
    if 45 <= rsi <= 55 and signal != 'Short': 
        signal = 'Side'
    
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
    
    reasoning_data = {
        "summary": "缩量震荡，维持观望" if signal == 'Side' else ("顺势做多" if signal == 'Long' else "避险为主"),
        "analysis": {
            "trend": f"价格在 MA20 {'上方' if close > ma20 else '下方'}运行，短期趋势{'偏强' if close > ma20 else '偏弱'}。",
            "momentum": f"RSI 读数 {rsi:.0f}，{'进入超买区' if rsi > 70 else ('进入超卖区' if rsi < 30 else '处于中性区域')}。",
            "volume": f"成交量 {'正常' if today_data.get('volume', 0) > 100 else '低迷'}"
        },
        "tactics": tactics,
        "key_levels": {
            "support": round(support_price, 3),
            "resistance": round(ma20 * 1.05, 3),
            "stop_loss": round(support_price * 0.97, 3)
        },
        "conflict_resolution": "趋势优先（MA20） > 动能（RSI）",
        "tomorrow_focus": f"能否有效突破 {ma20:.2f} 并实现量比 > 1.2"
    }
    
    reasoning = json.dumps(reasoning_data, ensure_ascii=False)
    confidence = 0.72 if signal != 'Side' else 0.5

    # 存储到数据库
    conn = get_connection()
    cursor = conn.cursor()
    
    today_str = today_data.get('date')
    if not today_str:
        return
        
    dt = datetime.strptime(today_str, "%Y-%m-%d")
    target_date = (dt + timedelta(days=1)).strftime("%Y-%m-%d")

    cursor.execute("""
        INSERT OR REPLACE INTO ai_predictions 
        (symbol, date, target_date, signal, confidence, support_price, ai_reasoning, validation_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')
    """, (symbol, today_str, target_date, signal, confidence, support_price, reasoning))
    
    conn.commit()
    conn.close()
    print(f"   🔮 系统建议 ({today_str}): 信号={signal}")
    return signal, support_price
