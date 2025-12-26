import json
import sqlite3
from datetime import datetime
from database import get_connection

def generate_full_prompt(symbol: str):
    """
    为你生成该股票的全量 LLM 提示词，可直接复制到 Gemini/DeepSeek Chat 界面。
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. 获取股票基础信息
    cursor.execute("SELECT name FROM stock_meta WHERE symbol = ?", (symbol,))
    name_row = cursor.fetchone()
    stock_name = name_row[0] if name_row else "未知股票"
    
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
        print(f"❌ 未找到股票 {symbol} 的行情数据，请确保已执行同步。")
        return

    data = dict(zip(columns, row))
    conn.close()

    # 3. 准备模板数据
    target_date = "下一个交易日"
    rsi = data.get('rsi', 0)
    rsi_status = "超买" if rsi > 70 else ("超卖" if rsi < 30 else "运行稳健")
    
    macd_hist = data.get('macd_hist', 0)
    macd_status = "金叉/多头" if macd_hist > 0 else "死叉/空头"

    # 4. 组装全量提示词
    full_prompt = f"""# 系统提示词 (System Prompt)
你是 StockWise 的 AI 决策助手，专门为个人投资者提供股票操作建议。

## 你的核心原则：
1. **理性锚点**：你不预测涨跌，你提供"执行纪律"的触发条件。
2. **个性化**：根据用户是"已持仓"还是"未建仓"，提供差异化的行动建议。
3. **可验证**：每条建议都有明确的触发条件，事后可验证对错。
4. **简洁直白**：使用普通人能秒懂的语言，避免晦涩术语。

## 你的输出格式：
你必须严格按照以下 JSON 格式输出，不要添加任何其他文字（确保输出是合法的 JSON）：

{{
  "signal": "Long" | "Side" | "Short",
  "confidence": 0.0 ~ 1.0,
  "summary": "一句话核心结论（15字以内）",
  "analysis": {{
    "trend": "趋势判断简述",
    "momentum": "动能判断简述",
    "volume": "量能判断简述"
  }},
  "tactics": {{
    "holding": [
        {{ "priority": "P1", "action": "...", "trigger": "...", "reason": "..." }},
        ...
    ],
    "empty": [
        {{ "priority": "P1", "action": "...", "trigger": "...", "reason": "..." }},
        ...
    ],
    "general": [
        {{ "priority": "P3", "action": "...", "trigger": "...", "reason": "..." }},
        ...
    ]
  }},
  "key_levels": {{
    "support": 数值,
    "resistance": 数值,
    "stop_loss": 数值
  }},
  "conflict_resolution": "当指标冲突时的决策原则",
  "tomorrow_focus": "明日需重点关注的事项"
}}

---

# 用户输入 (User Input)

## 股票信息
- **名称**: {stock_name}
- **代码**: {symbol}.HK
- **日期**: {data['date']}

## 今日行情数据
| 指标 | 数值 |
|------|------|
| 开盘价 | {data['open']} |
| 最高价 | {data['high']} |
| 最低价 | {data['low']} |
| 收盘价 | {data['close']} |
| 涨跌幅 | {data['change_percent']}% |
| 成交量 | {int(data['volume'])} |

## 技术指标
| 指标 | 数值 | 状态 |
|------|------|------|
| MA5 | {data['ma5']} | - |
| MA10 | {data['ma10']} | - |
| MA20 | {data['ma20']} | - |
| RSI(14) | {rsi} | {rsi_status} |
| MACD | DIF={data['macd']}, DEA={data['macd_signal']}, 柱={data['macd_hist']} | {macd_status} |
| KDJ | K={data['kdj_k']}, D={data['kdj_d']}, J={data['kdj_j']} | - |
| 布林带 | 上轨={data['boll_upper']}, 中轨={data['boll_mid']}, 下轨={data['boll_lower']} | - |

## 请求
请基于以上数据，为该股票生成明日（{target_date}）的操作建议。
"""
    
    print("-" * 30 + " 复制以下内容 " + "-" * 30)
    print(full_prompt)
    print("-" * 75)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('symbol', help='股票代码，例如 02171')
    args = parser.parse_args()
    
    generate_full_prompt(args.symbol)
