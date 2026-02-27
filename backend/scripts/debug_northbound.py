"""
Debug Script: Comprehensive Market Flow Data Audit
Purpose: Compare all available AkShare APIs for sector/industry fund flow
         to determine the optimal data source for the Market Almanac.

Current setup:
  - Primary: ak.stock_fund_flow_industry(symbol="即时")  [THS/同花顺]
  - Fallback: ak.stock_market_fund_flow                   [东方财富 broad market]

APIs to test:
  1. stock_fund_flow_industry (THS) - "即时", "3日排行", "5日排行"
  2. stock_sector_fund_flow_rank (Eastmoney) - "今日", "5日", "10日"  
  3. stock_market_fund_flow (Eastmoney) - broad market main force
"""
import sys
import os
import time

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

try:
    import backend.config
except ImportError:
    pass

import akshare as ak
import pandas as pd

def divider(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")

def test_api(name, fn, show_cols=True, head_n=5, tail_n=3):
    """Generic API tester with timing and error handling."""
    print(f"\n--- {name} ---")
    t0 = time.time()
    try:
        df = fn()
        elapsed = time.time() - t0
        print(f"  ✅ Success in {elapsed:.2f}s | Shape: {df.shape}")
        if show_cols:
            print(f"  Columns: {list(df.columns)}")
        if not df.empty:
            if head_n:
                print(f"\n  Top {head_n} rows:")
                print(df.head(head_n).to_string(index=True))
            if tail_n:
                print(f"\n  Bottom {tail_n} rows:")
                print(df.tail(tail_n).to_string(index=True))
        return df
    except Exception as e:
        elapsed = time.time() - t0
        print(f"  ❌ FAILED in {elapsed:.2f}s | {type(e).__name__}: {e}")
        return None

# ════════════════════════════════════════════════════════════════
# GROUP 1: THS (同花顺) Industry Flow  
# ════════════════════════════════════════════════════════════════
divider("GROUP 1: THS 同花顺 - stock_fund_flow_industry")

# 1a. Real-time ("即时") — Currently used
df_ths_rt = test_api(
    "THS 即时 (CURRENT PRIMARY)", 
    lambda: ak.stock_fund_flow_industry(symbol="即时")
)

if df_ths_rt is not None and not df_ths_rt.empty:
    print(f"\n  >>> Data Quality Check:")
    print(f"  Total industries: {len(df_ths_rt)}")
    # Check if '净额' column has meaningful data
    if '净额' in df_ths_rt.columns:
        df_ths_rt['net_val'] = pd.to_numeric(df_ths_rt['净额'], errors='coerce')
        non_null = df_ths_rt['net_val'].notna().sum()
        print(f"  Non-null '净额': {non_null}/{len(df_ths_rt)}")
        print(f"  '净额' range: {df_ths_rt['net_val'].min():.2f} to {df_ths_rt['net_val'].max():.2f}")
        
        # Show top 3 inflow and top 2 outflow
        sorted_df = df_ths_rt.dropna(subset=['net_val']).sort_values('net_val', ascending=False)
        print(f"\n  🔺 Top 3 Inflow:")
        for _, row in sorted_df.head(3).iterrows():
            print(f"     {row.get('行业', '?')}: {row['net_val']:+.2f}亿")
        print(f"\n  🔻 Bottom 2 Outflow:")
        for _, row in sorted_df.tail(2).iterrows():
            print(f"     {row.get('行业', '?')}: {row['net_val']:+.2f}亿")

time.sleep(0.5)

# ════════════════════════════════════════════════════════════════
# GROUP 2: Eastmoney (东方财富) Sector Fund Flow Rank
# ════════════════════════════════════════════════════════════════
divider("GROUP 2: Eastmoney 东方财富 - stock_sector_fund_flow_rank")

for indicator in ["今日", "5日", "10日"]:
    for sector_type in ["行业资金流"]:
        df_em = test_api(
            f"Eastmoney {sector_type} ({indicator})",
            lambda ind=indicator, st=sector_type: ak.stock_sector_fund_flow_rank(indicator=ind, sector_type=st),
            head_n=5, tail_n=2
        )
        
        if df_em is not None and not df_em.empty:
            print(f"\n  >>> Data Quality Check:")
            # Try to identify the net flow column
            net_cols = [c for c in df_em.columns if '净' in c and '流入' in c]
            if net_cols:
                col = net_cols[0]
                df_em['net_val'] = pd.to_numeric(df_em[col], errors='coerce')
                sorted_em = df_em.dropna(subset=['net_val']).sort_values('net_val', ascending=False)
                print(f"  Using column '{col}' for net flow")
                print(f"  🔺 Top 3 Inflow:")
                for _, row in sorted_em.head(3).iterrows():
                    name = row.get('名称', row.get('行业', '?'))
                    print(f"     {name}: {row['net_val']:+.2f}")
                print(f"  🔻 Bottom 2 Outflow:")
                for _, row in sorted_em.tail(2).iterrows():
                    name = row.get('名称', row.get('行业', '?'))
                    print(f"     {name}: {row['net_val']:+.2f}")
        time.sleep(0.3)

# ════════════════════════════════════════════════════════════════
# GROUP 3: Broad Market Main Force Flow
# ════════════════════════════════════════════════════════════════
divider("GROUP 3: Broad Market - stock_market_fund_flow (FALLBACK)")

df_mf = test_api(
    "Eastmoney Main Force (Broad)",
    lambda: ak.stock_market_fund_flow(),
    head_n=0, tail_n=5
)

if df_mf is not None and not df_mf.empty:
    latest = df_mf.iloc[-1]
    print(f"\n  >>> Latest row analysis:")
    for col in df_mf.columns:
        print(f"     {col}: {latest[col]}")

# ════════════════════════════════════════════════════════════════
# GROUP 4: Concept Fund Flow (概念资金流)
# ════════════════════════════════════════════════════════════════
divider("GROUP 4: Eastmoney 概念资金流 (Concept Flow)")

df_concept = test_api(
    "Eastmoney 概念资金流 (今日)",
    lambda: ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="概念资金流"),
    head_n=5, tail_n=0
)

# ════════════════════════════════════════════════════════════════
# TIMING ANALYSIS
# ════════════════════════════════════════════════════════════════
divider("TIMING & FRESHNESS ANALYSIS")

from datetime import datetime
try:
    from backend.config import BEIJING_TZ
except ImportError:
    from datetime import timezone, timedelta
    BEIJING_TZ = timezone(timedelta(hours=8))

now = datetime.now(BEIJING_TZ)
print(f"Current Beijing Time: {now.strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Is A-share market open? {'Yes' if 9 <= now.hour < 15 else 'No'}")
print()

print("Key Question: Does '即时' data update after market close?")
print("  If current time > 15:00 and data looks populated,")
print("  then '即时' returns end-of-day snapshot (good for post-market almanac).")
print()

if df_ths_rt is not None and not df_ths_rt.empty:
    # Check if there's a date/time column
    date_cols = [c for c in df_ths_rt.columns if '日期' in c or '时间' in c or 'date' in c.lower()]
    if date_cols:
        print(f"  THS date columns found: {date_cols}")
        print(f"  Latest date: {df_ths_rt[date_cols[0]].iloc[0]}")
    else:
        print(f"  THS: No date column found. Available cols: {list(df_ths_rt.columns)}")

# ════════════════════════════════════════════════════════════════
# COMPARISON SUMMARY
# ════════════════════════════════════════════════════════════════
divider("COMPARISON SUMMARY")

print("""
┌─────────────────────────────────┬──────────┬──────────┬──────────┐
│ API                             │ Speed    │ Sectors  │ Status   │
├─────────────────────────────────┼──────────┼──────────┼──────────┤""")

apis = [
    ("THS stock_fund_flow_industry", df_ths_rt),
    ("EM stock_sector_fund_flow_rank", df_em),
    ("EM stock_market_fund_flow", df_mf),
]

for name, df in apis:
    if df is not None and not df.empty:
        print(f"│ {name:<31} │ {'OK':<8} │ {len(df):<8} │ {'✅':<8} │")
    else:
        print(f"│ {name:<31} │ {'--':<8} │ {'--':<8} │ {'❌':<8} │")

print("└─────────────────────────────────┴──────────┴──────────┴──────────┘")

print("""
RECOMMENDATION:
  1. Check if THS "即时" and EM "今日" return the SAME sectors/rankings
  2. If EM is more reliable, consider switching primary source
  3. Verify data units (亿 vs 万) to ensure correct display
""")
