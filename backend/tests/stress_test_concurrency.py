import sys
import os
import time
import logging
import random
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from logger import logger

# 模拟 800 个任务
TOTAL_TASKS = 800
MAX_WORKERS = 8 # 稍微加大一点并发压力

def mock_process_stock(i):
    """
    模拟单个股票处理:
    1. 模拟网络 I/O (随机 0.5 - 1.5 秒)
    2. 模拟 DB 写入 (微小耗时)
    """
    sleep_time = random.uniform(0.5, 1.5)
    time.sleep(sleep_time)
    
    # 模拟 1% 的失败率
    if random.random() < 0.01:
        raise Exception("Mock Network Error")
        
    return f"Stock-{i}"

def run_stress_test():
    logger.info(f"🔥 [Stress Test] 开始压力测试: {TOTAL_TASKS} 个任务, 并发数={MAX_WORKERS}...")
    start_time = time.time()
    
    success_count = 0
    fail_count = 0
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # 提交所有任务
        futures = {executor.submit(mock_process_stock, i): i for i in range(TOTAL_TASKS)}
        
        # 实时监控进度
        for i, future in enumerate(as_completed(futures)):
            try:
                future.result()
                success_count += 1
            except Exception as e:
                fail_count += 1
                
            # 每完成 100 个打印一次进度
            if (i + 1) % 100 == 0:
                elapsed = time.time() - start_time
                speed = (i + 1) / elapsed
                logger.info(f"   ⏩ 进度: {i + 1}/{TOTAL_TASKS} | 成功: {success_count} | 处理速度: {speed:.1f} 个/秒")

    duration = time.time() - start_time
    logger.info(f"✅ 压力测试完成!")
    logger.info(f"   - 总耗时: {duration:.2f}s")
    logger.info(f"   - 理论串行耗时 (预估): {TOTAL_TASKS * 1.0:.2f}s")
    logger.info(f"   - 实际加速比: { (TOTAL_TASKS * 1.0) / duration:.1f}x")

if __name__ == "__main__":
    logger.setLevel(logging.INFO)
    run_stress_test()
