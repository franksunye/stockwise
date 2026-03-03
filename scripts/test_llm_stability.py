"""
LLM 稳定性与 JSON 解析压力测试脚本
用于验证 Prompt 结构和客户端解析器的鲁棒性
"""
import sys
import os
import time
import pandas as pd

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.engine.llm_client import get_llm_client
from backend.engine.prompts import prepare_stock_analysis_prompt
from backend.database import get_connection

def get_test_symbol():
    """获取一个有数据的股票代码用于测试"""
    conn = get_connection()
    try:
        # 获取最近有行情的股票
        df = pd.read_sql("SELECT symbol FROM daily_prices ORDER BY date DESC LIMIT 10", conn)
        if not df.empty:
            return df.iloc[0]['symbol']
            
        # 兜底
        return "00700" 
    finally:
        conn.close()

def run_stability_test(rounds=5):
    print(f"🚀 开始 LLM 稳定性测试 (共 {rounds} 轮)...")
    
    # 1. 准备数据
    symbol = get_test_symbol()
    print(f"📋 测试标的: {symbol}")
    
    try:
        system_prompt, user_prompt = prepare_stock_analysis_prompt(symbol)
    except Exception as e:
        print(f"❌ 准备 Prompt 失败: {e}")
        return

    client = get_llm_client()
    if not client.is_available():
        print("❌ LLM 服务未连接，请检查本地代理。")
        return

    print(f"🔹 System Prompt 长度: {len(system_prompt)} chars")
    print(f"🔹 User Prompt 长度: {len(user_prompt)} chars")
    print("-" * 50)

    success_count = 0
    total_latency = 0
    
    for i in range(1, rounds + 1):
        print(f"\n🔄 第 {i}/{rounds} 轮测试中...", end="", flush=True)
        
        start_time = time.time()
        # 强制不重试 (retries=0)，我们要看一次性成功率
        # 同时为了测试稳定性，这里我们直接调用底层的 chat 和 _parse_json_response
        # 以便捕获原始错误，而不是被 generate_stock_prediction 掩盖
        
        # 模拟 generate_stock_prediction 的行为(带追踪)
        result = client.generate_stock_prediction(system_prompt, user_prompt, symbol=f"TEST-{i}", retries=0)
        
        duration = time.time() - start_time
        total_latency += duration
        
        if result:
            success_count += 1
            signal = result.get('signal', 'Unknown')
            conf = result.get('confidence', 0)
            print(f" ✅ 成功 ({duration:.1f}s) | 信号: {signal} | 置信度: {conf}")
        else:
            print(f" ❌ 失败 ({duration:.1f}s)")
            # 尝试获取最近一次的 trace 看看发生了什么
            # 这里我们不直接读库，为了简单，我们信任 client 内部的 print 输出

    print("-" * 50)
    print(f"📊 测试总结:")
    print(f"   成功率: {success_count}/{rounds} ({success_count/rounds*100:.0f}%)")
    print(f"   平均耗时: {total_latency/rounds:.1f}s")
    
    if success_count < rounds:
        print("\n⚠️ 建议: 如果出现解析失败，请检查 backend/engine/llm_client.py 中的 _parse_json_response 方法，"
              "或者检查本地 LLM 代理的 stream buffer 设置。")
              
    # 强制退出，防止 libsql-client 后台线程卡住进程
    import sys
    sys.exit(0)

if __name__ == "__main__":
    # 如果带了参数，作为轮数
    import sys
    rounds = 3
    if len(sys.argv) > 1:
        try:
            rounds = int(sys.argv[1])
        except:
            pass
            
    run_stability_test(rounds)
