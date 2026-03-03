import asyncio
import time
import sys
import os

# Add parent directories to path for imports
current_file = os.path.abspath(__file__)
scripts_dir = os.path.dirname(current_file)
backend_dir = os.path.dirname(scripts_dir)
root_dir = os.path.dirname(backend_dir)
sys.path.insert(0, root_dir)
sys.path.insert(0, backend_dir)

from backend.engine.services.news_service import fetch_news_for_stock
from backend.logger import logger

async def test_concurrency(symbols, semaphore_limit):
    sem = asyncio.Semaphore(semaphore_limit)
    
    async def task(symbol):
        async with sem:
            start = time.time()
            res = await fetch_news_for_stock(symbol, "")
            duration = time.time() - start
            status = "✅ SUCCESS" if "found" in res.lower() or "-" in res else "❌ FAILED"
            if "failed" in res.lower() or "error" in res.lower():
                 status = f"❌ ERROR: {res[:50]}..."
            print(f"[{symbol}] {status} ({duration:.2f}s)")
            return status

    print(f"\n🚀 Testing Concurrency Limit: {semaphore_limit} for {len(symbols)} symbols...")
    start_total = time.time()
    results = await asyncio.gather(*(task(s) for s in symbols))
    total_duration = time.time() - start_total
    
    success_count = sum(1 for r in results if "SUCCESS" in r)
    print(f"📊 Summary (Limit {semaphore_limit}): {success_count}/{len(symbols)} passed in {total_duration:.2f}s")
    return success_count == len(symbols)

async def main():
    test_symbols = ["00700", "00981", "01398", "002413", "001267", "300059", "600519", "02800", "01810", "09988"]
    
    # Test 1: Aggressive (10 concurrency)
    print("\n--- Testing Aggressive Limit (10) ---")
    ok = await test_concurrency(test_symbols, 10)
    
    if ok:
        # Test 2: Extreme (20 concurrency - multiple requests per symbol to simulate load)
        print("\n--- Testing Extreme Limit (20) ---")
        # Reuse symbols to make a larger list
        large_test_set = test_symbols * 2
        await test_concurrency(large_test_set, 20)
    else:
        print("\n--- Failed at 10, no need to push further ---")

if __name__ == "__main__":
    asyncio.run(main())
