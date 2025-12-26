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
    
    # 构建决策树
    tactics = {
        "holding": [
            {"p": "P1", "a": "止损/减仓", "c": f"跌破 {support_price:.2f} 且30分钟不收回", "r": "防止趋势转盈为亏"},
            {"p": "P2", "a": "持仓待涨", "c": "股价运行在MA20上方", "r": "跟随趋势"}
        ],
        "empty": [
            {"p": "P1", "a": "观望/谨慎", "c": f"等待站稳 {ma20:.2f} 且放量", "r": "右侧交易更稳健"},
            {"p": "P2", "a": "小仓试错", "c": f"回踩 {support_price:.2f} 不破", "r": "博取反弹"}
        ]
    }
    
    reasoning_data = {
        "summary": f"当前价 {'站稳' if close > ma20 else '跌破'} MA20，RSI 指标显示{'动能充沛' if rsi > 50 else '超卖反弹需求'}。",
        "tactics": tactics,
        "conflict": "趋势优先（MA20） > 动能（RSI）"
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
