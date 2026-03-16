import akshare as ak
import pandas as pd
import time

def test_live_network():
    print("📡 Starting Live Network Test...")
    
    # 1. Test Eastmoney (Primary)
    start_em = time.time()
    try:
        df_em = ak.stock_zh_a_spot_em()
        print(f"✅ Eastmoney (EM) Fetch successful in {time.time()-start_em:.2f}s (Count: {len(df_em)})")
    except Exception as e:
        print(f"❌ Eastmoney (EM) Fetch failed: {e}")
    
    # 2. Test Sina (Fallback)
    start_sina = time.time()
    try:
        df_sina = ak.stock_zh_a_spot()
        print(f"✅ Sina Fetch successful in {time.time()-start_sina:.2f}s (Count: {len(df_sina)})")
        
        # Check columns
        print(f"Sina Columns: {df_sina.columns.tolist()[:10]}...")
        
        # Test Normalization logic from code
        rename_map = {
            "code": "代码",
            "name": "名称",
            "trade": "最新价",
            "changepercent": "涨跌幅",
            "amount": "成交额",
            "turnoverratio": "换手率"
        }
        df_norm = df_sina.rename(columns=rename_map)
        print(f"✅ Normalization Test: '成交额' in columns: {'成交额' in df_norm.columns}")
        print(f"Sample Data (First row):")
        print(df_norm[['代码', '名称', '最新价', '涨跌幅', '成交额']].head(1))
        
    except Exception as e:
        print(f"❌ Sina Fetch failed: {e}")

if __name__ == "__main__":
    test_live_network()
