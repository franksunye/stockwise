import sys
import os
from pathlib import Path

# Add project root AND backend dir to path (for legacy imports inside backend)
sys.path.append(str(Path(__file__).parent.parent))
sys.path.append(str(Path(__file__).parent.parent / "backend"))

from backend.config import CHAIN_STRATEGIES
from backend.engine.chain.step_factory import StepFactory
from loguru import logger

def test_chain_init():
    strategy_name = "hunyuan-lite"
    config = CHAIN_STRATEGIES.get(strategy_name)
    
    if not config:
        logger.error(f"❌ Strategy {strategy_name} not found in config")
        return

    logger.info(f"✅ Found strategy: {strategy_name}")
    logger.info(f"⚙️  Retries: {config['max_retries_per_step']}, Timeout: {config['total_timeout']}")
    
    try:
        steps = StepFactory.create_steps(config["steps"])
        logger.info(f"✅ Successfully instantiated {len(steps)} steps:")
        for i, step in enumerate(steps):
            logger.info(f"  [{i+1}] {step.__class__.__name__} (config={step.config})")
            
        logger.info("🎉 ChainEngine Core is wired correctly!")
        
    except Exception as e:
        logger.error(f"❌ Initialization failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_chain_init()
