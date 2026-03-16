import akshare as ak
import pandas as pd
import time
import os
import requests

def audit_providers():
    providers = [
        ("Eastmoney (EM)", ak.stock_zh_a_spot_em),
        ("Sina (Sina)", ak.stock_zh_a_spot)
    ]
    
    print("🔬 Systematic Data Provider Audit")
    print("-" * 40)
    
    # Check current network environment
    proxies = {k: v for k, v in os.environ.items() if 'proxy' in k.lower()}
    if proxies:
        print(f"⚠️ Proxy detected: {proxies}")
    
    for name, func in providers:
        print(f"\n🔍 Auditing {name}...")
        
        # Test 1: With current environment
        print("   -> Testing with current environment (Direct)...")
        start_time = time.time()
        try:
            df = func()
            if df is not None and not df.empty:
                print(f"   ✅ Success: Found {len(df)} records in {time.time()-start_time:.2f}s")
            else:
                print(f"   ❌ Failed: Empty result")
        except Exception as e:
            print(f"   ❌ Error: {type(e).__name__} - {str(e)[:100]}")
            
        # Test 2: Environmental Isolation (Clear proxies)
        print("   -> Testing with environment isolation (No Proxy)...")
        start_isolated = time.time()
        try:
            # Save original
            orig_http = os.environ.get('http_proxy')
            orig_https = os.environ.get('https_proxy')
            orig_all = os.environ.get('all_proxy')
            
            # Clear
            if 'http_proxy' in os.environ: del os.environ['http_proxy']
            if 'https_proxy' in os.environ: del os.environ['https_proxy']
            if 'all_proxy' in os.environ: del os.environ['all_proxy']
            
            df_isolated = func()
            
            # Restore
            if orig_http: os.environ['http_proxy'] = orig_http
            if orig_https: os.environ['https_proxy'] = orig_https
            if orig_all: os.environ['all_proxy'] = orig_all
            
            if df_isolated is not None and not df_isolated.empty:
                print(f"   ✅ Success: Found {len(df_isolated)} records in {time.time()-start_isolated:.2f}s")
            else:
                print(f"   ❌ Failed: Empty result")
        except Exception as e_iso:
            print(f"   ❌ Error: {type(e_iso).__name__} - {str(e_iso)[:100]}")

if __name__ == "__main__":
    audit_providers()
