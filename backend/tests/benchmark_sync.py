import sys
import os
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from logger import logger
from main import process_stock_period

# 模拟 8 只股票 (混合 A 股和港股)
TEST_STOCKS = [
    "00700", "09988", "03690", "01810", # HK
    "600519", "601398", "002594", "300750" # CN
]

def run_serial():
    logger.info(f"🐢 [Serial] 开始串行同步 {len(TEST_STOCKS)} 只股票...")
    start_time = time.time()
    for stock in TEST_STOCKS:
        try:
            # 仅测试 daily，减少时间
            process_stock_period(stock, period="daily")
        except Exception as e:
            logger.error(f"❌ {stock} error: {e}")
    duration = time.time() - start_time
    logger.info(f"🐢 [Serial] 完成，耗时: {duration:.2f}s")
    return duration

def run_parallel(max_workers=4):
    logger.info(f"🚀 [Parallel] 开始并行同步 (Workers={max_workers}) {len(TEST_STOCKS)} 只股票...")
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(process_stock_period, stock, "daily"): stock for stock in TEST_STOCKS}
        
        for future in as_completed(futures):
            stock = futures[future]
            try:
                future.result()
            except Exception as e:
                logger.error(f"❌ {stock} error: {e}")
                
    duration = time.time() - start_time
    logger.info(f"🚀 [Parallel] 完成，耗时: {duration:.2f}s")
    return duration

if __name__ == "__main__":
    # 确保日志可见
    logger.setLevel(logging.INFO)
    
    print("\n" + "="*50)
    print("🧪并发性能基准测试 (Benchmark)")
    print("="*50 + "\n")
    
    t_serial = run_serial()
    print("-" * 30)
    time.sleep(1) # 歇一会
    t_parallel = run_parallel(max_workers=4)
    
    print("\n" + "="*50)
    print(f"📊 结果对比:")
    print(f"🐢 串行 (Serial):   {t_serial:.2f}s")
    print(f"🚀 并行 (Parallel): {t_parallel:.2f}s")
    
    speedup = t_serial / t_parallel if t_parallel > 0 else 0
    print(f"⚡ 提升倍数: {speedup:.1f}x")
    print("="*50 + "\n")
