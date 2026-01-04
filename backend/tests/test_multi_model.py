import sys
import os
import asyncio
import logging

# Add backend to path
# Add backend dir AND project root to path to support both legacy and new imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # backend/
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))) # root

from backend.engine.runner import PredictionRunner
from backend.logger import logger

# Set logger to stdout
handler = logging.StreamHandler(sys.stdout)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

async def main():
    print("🚀 Starting Dry Run...")
    runner = PredictionRunner()
    
    # Use a symbol that likely exists, e.g., 00700 (Tencent) or 600519 (Moutai)
    symbol = "00700" 
    
    await runner.run_analysis(symbol)
    
    print("✅ Dry Run Finished.")

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
