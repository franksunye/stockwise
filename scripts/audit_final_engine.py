import sys
import os
import pandas as pd

# Path setup
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

from engine.market_facts_service import _fetch_a_spot, _is_representative
from logger import logger

def audit_tiers():
    print("🧪 Testing High-Reliability 4-Tier Engine")
    print("-" * 40)
    
    df, meta = _fetch_a_spot()
    
    if df is not None:
        print(f"\n🎯 FINAL RESULT: SUCCESS")
        print(f"   Source: {meta.get('source')}")
        print(f"   Size: {len(df)} rows")
        print(f"   Representative (>4500): {_is_representative(df, 4500)}")
    else:
        print(f"\n🎯 FINAL RESULT: FAILED")
        print(f"   Error: {meta.get('error')}")

if __name__ == "__main__":
    # Ensure logs reflect the tier transitions
    audit_tiers()
