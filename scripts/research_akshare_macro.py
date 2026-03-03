
import akshare as ak
import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def test_macro():
    print("Testing Macro Data...")
    try:
        print("\n[GDP]")
        df = ak.macro_china_gdp()
        print(df.head(2))
    except Exception as e:
        print(f"GDP Failed: {e}")

    try:
        print("\n[CPI]")
        df = ak.macro_china_cpi()
        print(df.head(2))
    except Exception as e:
        print(f"CPI Failed: {e}")
    
    try:
        print("\n[Bond Yield 10Y]")
        # Try a specific bond yield function
        # bond_zh_us_rate usually returns major country yields including China
        df = ak.bond_zh_us_rate()
        print(df.head(2))
    except Exception as e:
        print(f"Bond Yield Failed: {e}")

if __name__ == "__main__":
    test_macro()
