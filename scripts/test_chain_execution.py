import sys
import os
import asyncio
import json
from pathlib import Path
from datetime import datetime

# Path setup
sys.path.append(str(Path(__file__).parent.parent))
sys.path.append(str(Path(__file__).parent.parent / "backend"))

from backend.engine.models.hunyuan_chain import HunyuanChainModel
from backend.engine.prompts import fetch_full_analysis_context
from loguru import logger

async def run_test():
    symbol = "00700"
    logger.info(f"🚀 Starting Chain Engine Integration Test for {symbol}...")
    
    # Check API Key
    if not os.getenv("HUNYUAN_API_KEY"):
         logger.warning("⚠️ HUNYUAN_API_KEY not found in env. Test might fail if not mocked.")
    
    try:
        # 1. Fetch REAL data (same as production)
        logger.info("📊 Fetching real data from database...")
        data = fetch_full_analysis_context(symbol)
        
        if "error" in data:
            logger.error(f"❌ Data fetch failed: {data['error']}")
            return
        
        date = data['date']
        logger.info(f"✅ Data fetched for {date}: {len(data.get('daily_prices', []))} daily prices")
        
        # 2. Instantiate Model
        model = HunyuanChainModel(model_id="hunyuan-lite", config={"display_name": "Test"})
        logger.info(f"✅ Model Instantiated: {model.strategy_config}")

        # 3. Run Predict
        logger.info("⏳ Running predict() ...")
        result = await model.predict(symbol=symbol, date=date, data=data)
        
        # 4. Validation
        logger.info("✅ Prediction Completed!")
        logger.info(f"Signal: {result.get('signal')}")
        logger.info(f"Result Keys: {result.keys()}")
        
        # Check key improvements
        print("\n--- KEY FIELDS CHECK ---")
        print(f"key_levels.support: {result.get('key_levels', {}).get('support')} (should NOT be 123.45)")
        print(f"key_levels.resistance: {result.get('key_levels', {}).get('resistance')} (should NOT be 456.78)")
        print(f"tactics.holding: {len(result.get('tactics', {}).get('holding', []))} items (should > 0)")
        print(f"tactics.empty: {len(result.get('tactics', {}).get('empty', []))} items (should > 0)")
        
        if result.get('reasoning_trace'):
            print("\n--- REASONING TRACE ---")
            for step in result['reasoning_trace']:
                data_preview = step.get('data', '')[:40] + "..." if len(step.get('data', '')) > 40 else step.get('data', '')
                conclusion = step.get('conclusion', '')
                print(f"  {step['step'].upper()}: conclusion='{conclusion}' | data='{data_preview}'")
        
        # Full JSON
        print("\n--- FINAL JSON ---")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    except Exception as e:
        logger.error(f"❌ Test Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_test())

