import sys
import os
import requests

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import fetchers

print("Testing AkShare/EastMoney connectivity...")

try:
    # Test EastMoney API (direct requests)
    url = "http://82.push2.eastmoney.com/api/qt/clist/get"
    params = {
        "pn": "1", "pz": "10", "po": "1", "np": "1",
        "ut": "bd1d9ddb04089700cf9c27f6f7426281",
        "fltt": "2", "invt": "2", "fid": "f12",
        "fs": "m:0+t:6,m:0+t:80",
        "fields": "f12,f14"
    }
    resp = requests.get(url, params=params, timeout=5)
    print(f"EastMoney HTTP: {resp.status_code}")
except Exception as e:
    print(f"EastMoney HTTP Failed: {e}")

try:
    # Test AkShare (HK Spot) - this usually hits standard HTTPS endpoints
    import akshare as ak
    print("Fetching HK spots...")
    df = ak.stock_hk_spot_em()
    print(f"AkShare HK Data: {len(df)} rows")
except Exception as e:
    print(f"AkShare HK Failed: {e}")

print("✅ SSL verification finished")
