import sys
import os
import time
import json
import logging
import sqlite3 # Added missing import
from datetime import datetime

# Force Local DB for this test script
os.environ["DB_SOURCE"] = "local"
os.environ["TURSO_DB_URL"] = "" 
os.environ["TURSO_AUTH_TOKEN"] = ""

# Define Absolute DB Path
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/stockwise.db'))

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.engine.llm_client import get_llm_client
from backend.engine.prompts import prepare_stock_analysis_prompt
from backend.database import get_connection
from backend.engine.models.openai import OpenAIAdapter

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("load_test_full.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

async def run_batch_test(limit=60):
    logger.info(f"🚀 Starting FULL Batch Load Test (Target: {limit} stocks)")
    logger.info("🔧 Mode: DB_SOURCE=local (Analyzing and Saving to local SQLite)")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Get symbols (fetch more to ensure we have enough)
        cursor.execute("SELECT DISTINCT symbol FROM daily_prices LIMIT ?", (limit,))
        symbols = [row[0] for row in cursor.fetchall()]
        
        if len(symbols) < 5:
             # Fallback if local DB has few stocks: Duplicate them to simulate load
             logger.warning(f"⚠️ Only {len(symbols)} stocks found. Duplicating list to simulate load.")
             base_symbols = symbols if symbols else ['00700', '600519', '02171']
             while len(symbols) < limit:
                 symbols.extend(base_symbols)
             symbols = symbols[:limit]

        logger.info(f"📋 Prepared {len(symbols)} tasks for analysis")
        
        # Initialize Model (Direct Adapter via Env Var)
        # Note: Local proxy expects 'gpt-3.5-turbo' per .env, not the actual upstream model name
        model = OpenAIAdapter("gemini-3-flash", { 
            "provider": "gemini",
            "model": "gpt-3.5-turbo", 
            "api_key_env": "LLM_API_KEY", 
            "base_url_env": "LLM_BASE_URL"
        })
        
        # Duplicate symbols to meet target load (Target: 60 tasks)
        target_count = 60
        while len(symbols) < target_count:
            symbols.extend(symbols[:target_count - len(symbols)])
            
        logger.info(f"📋 Prepared {len(symbols)} tasks for analysis (Target: {target_count})")
        
        # Initialize Model (Direct Adapter via Env Var)
        model = OpenAIAdapter("gemini-3-flash", { 
            "provider": "gemini",
            "model": "gpt-3.5-turbo", 
            "api_key_env": "LLM_API_KEY", 
            "base_url_env": "LLM_BASE_URL"
        })
        
        success_count = 0
        total_time = 0
        concurrency_limit = 1 # Serial execution for stability
        semaphore = asyncio.Semaphore(concurrency_limit)
        
        async def limited_predict(symbol, idx, total):
            start_time = time.time()
            current_date = datetime.now().strftime("%Y-%m-%d")
            async with semaphore:
                logger.info(f"\n[{idx}/{total}] Analyzing {symbol}...")
                
                # Mock data dict
                mock_data = {"date": current_date} 
                
                # Predict (Use None for date to fetch latest available data)
                result = await model.predict(symbol, None, mock_data)
                
                if result and result.get("signal"):
                    # Save to DB (Direct Insert)
                    try:
                        clean_reasoning = json.dumps(result, ensure_ascii=False)
                        conn_local = sqlite3.connect(DB_PATH) # Use absolute path
                        cursor_local = conn_local.cursor()
                        cursor_local.execute("""
                            INSERT OR REPLACE INTO ai_predictions_v2 
                            (symbol, model_id, date, target_date, signal, confidence, ai_reasoning, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            symbol, 
                            "gemini-3-flash", 
                            current_date, 
                            current_date, # target_date matches execute date for this test
                            result["signal"], 
                            result["confidence"], 
                            clean_reasoning,
                            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        ))
                        conn_local.commit()
                        conn_local.close()
                        duration = time.time() - start_time
                        logger.info(f"   ✅ Processed & Saved ({duration:.2f}s) | Signal: {result['signal']} | Conf: {result['confidence']}")
                        return True, duration
                    except Exception as e:
                        duration = time.time() - start_time
                        logger.error(f"   ❌ DB Error ({duration:.2f}s): {e}")
                        return False, duration
                else:
                    duration = time.time() - start_time
                    err = result.get("reasoning", "Unknown Error") if result else "Empty Result"
                    logger.error(f"   ❌ Failed ({duration:.2f}s): {err}")
                    return False, duration

        # Execution Loop (Sequential with Delay)
        start_global = time.time()
        for i, symbol in enumerate(symbols):
            if i > 0:
                logger.info(f"⏳ Sleeping 15s... (Target > 30 mins)")
                await asyncio.sleep(15)
            
            success, dur = await limited_predict(symbol, i+1, len(symbols))
            if success:
                success_count += 1
            total_time += dur
            
        total_global = time.time() - start_global

        # Summary
        logger.info("\n" + "="*50)
        logger.info(f"📊 Full Load Test Complete")
        logger.info(f"   Total Tasks: {len(symbols)}")
        logger.info(f"   Success Rate: {success_count}/{len(symbols)} ({success_count/len(symbols)*100:.1f}%)")
        logger.info(f"   Total Duration: {total_global/60:.2f} mins")
        logger.info("="*50)

    finally:
        conn.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_batch_test())
