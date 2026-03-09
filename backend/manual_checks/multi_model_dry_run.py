import asyncio
import logging
import os
import sys


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.engine.runner import PredictionRunner
from backend.logger import logger


handler = logging.StreamHandler(sys.stdout)
logger.addHandler(handler)
logger.setLevel(logging.INFO)


async def main() -> None:
    print("🚀 Starting dry run...")
    runner = PredictionRunner()
    await runner.run_analysis("00700")
    print("✅ Dry run finished.")


if __name__ == "__main__":
    if os.name == "nt":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
