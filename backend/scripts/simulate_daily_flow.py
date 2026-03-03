
"""
Simulate Daily Flow (Dry Run)
-----------------------------
此脚本用于模拟 StockWise Phase 2 的完整数据流，验证：
1. Signal Flip 检测逻辑 (Bearish -> Bullish)
2. NotificationManager 的通知分级
3. Daily Brief 的排版与动态文案生成

不依赖真实 AI 调用，不发送真实推送。
"""
import sys
import os
import json
import logging
from datetime import datetime

# Add backend and root to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(backend_dir)
sys.path.append(backend_dir)
sys.path.append(root_dir)

from database import get_connection
from notification_service import NotificationManager
from engine.brief_generator import assemble_user_brief
from logger import logger

# 配置日志输出到控制台
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

def setup_mock_data(conn, user_id, symbol, today):
    """准备模拟数据：用户关注、历史状态、今日预测"""
    cursor = conn.cursor()
    
    print(f"\n[1] 🛠️  正在初始化模拟环境 (User: {user_id}, Stock: {symbol})...")
    
    # 1. 确保用户和股票元数据存在 (Order matters for FK)
    cursor.execute("""
        INSERT OR REPLACE INTO users (user_id, notification_settings, registration_type, subscription_tier) 
        VALUES (?, ?, 'simulation', 'free')
    """, (user_id, json.dumps({"enabled": True})))
    cursor.execute("INSERT OR REPLACE INTO stock_meta (symbol, name, market) VALUES (?, ?, ?)", (symbol, "腾讯控股模拟", "HK"))
                   
    # 2. 插入关注列表
    cursor.execute("INSERT OR IGNORE INTO user_watchlist (user_id, symbol) VALUES (?, ?)", (user_id, symbol))
    
    # 2. 设置"昨天"的状态 (Bearish) -> 用于触发 Flip
    print(f"    - 设置前置状态: {symbol} = Bearish (看跌)")
    
    # Ensure model exists for FK, but keep it INACTIVE to avoid 'Provider not supported' errors in runner.py
    cursor.execute("INSERT OR REPLACE INTO prediction_models (model_id, display_name, provider, is_active) VALUES (?, ?, ?, ?)", 
                   ('simulation-model', 'Simulation Model', 'simulation', 0))

    cursor.execute("""
        INSERT OR REPLACE INTO signal_states (user_id, symbol, last_signal, last_confidence, last_notified_at)
        VALUES (?, ?, 'Bearish', 0.65, datetime('now', '-1 day'))
    """, (user_id, symbol))
    
    # 3. 模拟"今天"的 AI 预测 (Bullish) -> 存入 ai_predictions_v2
    # 这通常由 run_prediction.ps1 -> PredictionRunner 完成
    print(f"    - 注入今日 AI 预测: {symbol} = Bullish (看涨) [Confidence: 0.92]")
    cursor.execute("""
        INSERT OR REPLACE INTO ai_predictions_v2 
        (symbol, date, model_id, target_date, signal, confidence, ai_reasoning, is_primary, created_at)
        VALUES (?, ?, 'simulation-model', ?, 'Bullish', 0.92, 
        '基于干跑测试的模拟推理：技术指标金叉，且有重大利好消息支撑。', 1, datetime('now'))
    """, (symbol, today, today))
    
    # 4. 模拟 Phase 1 生成的 Stock Brief (用于日报)
    # 这通常由 brief_generator.py -> generate_stock_briefs_batch 完成
    print(f"    - 注入今日 Stock Brief 数据")
    analysis_md = """
    #### 关键指标
    - **趋势**: 📈 强力反转
    - **建议**: 买入持有
    
    模拟分析内容：腾讯控股今日展现出极强的反弹动能。**关键阻力位已突破**，成交量显著放大。建议投资者关注后续表现。
    """
    cursor.execute("""
        INSERT OR REPLACE INTO stock_briefs 
        (symbol, date, stock_name, analysis_markdown, raw_news, signal, confidence)
        VALUES (?, ?, '腾讯控股模拟', ?, '模拟新闻内容', 'Bullish', 0.92)
    """, (symbol, today, analysis_md))
    
    conn.commit()
    print("    ✅ 模拟数据准备就绪。")

def simulate_flip_detection(conn, user_id, symbol):
    """模拟 run_ai_analysis 中的 Flip 检测环节"""
    print(f"\n[2] ⚡ 正在执行 Signal Flip 检测...")
    
    manager = NotificationManager(conn=conn, dry_run=True)
    
    # 1. 加载状态
    manager.load_signal_states([user_id], [symbol])
    
    # 2. 模拟 Runner 调用 check_signal_flip
    # 假设 Runner 刚刚跑出了 Bullish, 0.92
    event = manager.check_signal_flip(user_id, symbol, "Bullish", 0.92)
    
    if event:
        print(f"    ✅ 成功检测到信号翻转!")
        print(f"       Old: {event['old_signal']} -> New: {event['new_signal']}")
        
        # 3. 模拟 Flush (生成紧急推送)
        print(f"    -> 正在生成【紧急推送】通知...")
        manager.flush()
        
        # 检查日志表看是否生成了记录
        cursor = conn.cursor()
        cursor.execute("SELECT title, body, url FROM notification_logs WHERE user_id = ? AND type = 'signal_flip' ORDER BY sent_at DESC LIMIT 1", (user_id,))
        log = cursor.fetchone()
        if log:
            print(f"    📝 [Notification Generated]")
            print(f"       Title: {log[0]}")
            print(f"       Body:  {log[1]}")
            print(f"       URL:   {log[2]}")
        else:
            print("    ❌ 未找到通知日志 (Dry Run Mode 可能未写入 DB?)")
            # NotificationManager dry_run matches _log_to_db, so it should suffice if verify
            
    else:
        print("    ❌ 未检测到翻转 (Check logic!)")

async def simulate_daily_brief(conn, user_id, today):
    """模拟 Phase 2 日报组装"""
    print(f"\n[3] 📑 正在执行 Daily Brief 组装...")
    
    # 调用真实的组装逻辑
    content = await assemble_user_brief(user_id, today)
    
    if content:
        print("    ✅ 日报生成成功!")
        
        # Refresh connection to avoid stream timeout/not found error
        conn.close()
        conn = get_connection()
        cursor = conn.cursor()
        
        # 检查数据库中的 Push Hook
        cursor.execute("SELECT push_hook FROM daily_briefs WHERE user_id = ? AND date = ?", (user_id, today))
        row = cursor.fetchone()
        if row:
            print(f"    🎣 [Smart Hook Generated]")
            print(f"       '{row[0]}'")
            print("       (期待看到: '📈 腾讯控股模拟出现看涨信号...')")
        
        # 验证简报内容是否包含 Emoji 和加粗 (虽由 Prompt 决定，但这里验证我们在 mock data 里放的格式)
        if "📈" in content:
            print("    ✅ 简报内容包含可视化 Emoji")
    else:
        print("    ❌ 日报生成失败")

def main():
    import asyncio
    
    # Config
    TEST_USER = "dry_run_tester"
    TEST_SYMBOL = "SIM700"
    TODAY = datetime.now().strftime("%Y-%m-%d")
    
    conn = get_connection()
    try:
        # Step 1
        setup_mock_data(conn, TEST_USER, TEST_SYMBOL, TODAY)
        
        # Step 2
        simulate_flip_detection(conn, TEST_USER, TEST_SYMBOL)
        
        # Step 3
        asyncio.run(simulate_daily_brief(conn, TEST_USER, TODAY))
        
        print(f"\n✅ Dry Run 完成。请检查上方输出确认逻辑是否符合预期。")
        
    finally:
        # Cleanup (Optional, keep for inspection)
        # conn.execute("DELETE FROM users WHERE user_id = ?", (TEST_USER,))
        conn.close()

if __name__ == "__main__":
    main()
