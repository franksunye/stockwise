
import akshare as ak
import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def test_news():
    print("Testing News Data...")
    try:
        # Cailianshe Global 7x24
        # Note: Function name varies. Let's try stock_info_global_cls or similar
        # Based on docs, it might be `stock_telegraph_cls` or `stock_info_global_cls`
        # Let's try `stock_telegraph_cls` first as it's common.
        print("\n[CLS Telegraph]")
        df = ak.stock_telegraph_cls()
        print(df.head(2))
    except Exception as e:
        print(f"CLS Failed: {e}")
        try: 
             # Fallback
             print("Trying fallback stock_info_global_cls...")
             df = ak.stock_info_global_cls()
             print(df.head(2))
        except Exception as e2:
             print(f"Fallback Failed: {e2}")

    try:
        # CCTV News
        print("\n[CCTV News]")
        df = ak.news_cctv(date="20260215") # Try yesterday
        print(df.head(2))
    except Exception as e:
         print(f"CCTV Failed: {e}")

if __name__ == "__main__":
    test_news()
