import os
import ssl
import requests
import akshare as ak
import pandas as pd
from datetime import datetime, timedelta
from utils import get_market, get_pinyin_info
from database import get_connection

# 解决某些环境下 akshare 接口的 SSL 握手问题
try:
    ssl._create_default_https_context = ssl._create_unverified_context
except:
    pass

def fetch_stock_data(symbol: str, period: str = "daily", start_date: str = None) -> pd.DataFrame:
    """获取历史行情数据 (支持 A/H)"""
    if not start_date:
        start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")
    
    market = get_market(symbol)
    print(f"📡 正在获取 {market}:{symbol} {period} 数据 (从 {start_date} 起)...")
    
    try:
        if market == "HK":
            df = ak.stock_hk_hist(
                symbol=symbol,
                period=period,
                start_date=start_date,
                end_date=datetime.now().strftime("%Y%m%d"),
                adjust="qfq"
            )
        else:
            df = ak.stock_zh_a_hist(
                symbol=symbol,
                period=period,
                start_date=start_date,
                end_date=datetime.now().strftime("%Y%m%d"),
                adjust="qfq"
            )
        return df
    except Exception as e:
        print(f"❌ {symbol} {period} 获取失败: {e}")
        return pd.DataFrame()

def sync_stock_meta():
    """同步股票基础信息 (名称、市场、拼音)"""
    print("\n📦 同步股票元数据...")
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    all_records = []

    # 1. 港股列表
    try:
        hk_stocks = ak.stock_hk_spot_em()
        if not hk_stocks.empty:
            symbol_col = "代码" if "代码" in hk_stocks.columns else "symbol"
            name_col = "名称" if "名称" in hk_stocks.columns else "name"
            for _, row in hk_stocks.iterrows():
                symbol = str(row[symbol_col])
                name = str(row[name_col])
                if symbol.isdigit():
                    py, abbr = get_pinyin_info(name)
                    all_records.append((symbol, name, "HK", now_str, py, abbr))
            print(f"   已获取 {len(hk_stocks)} 条港股元数据")
    except Exception as e:
        print(f"   ⚠️ 港股列表获取失败: {e}")

    # 2. A 股列表 (多策略)
    try:
        print("   正在获取 A 股列表...")
        # 策略 A: 直接调用东财 HTTP 接口
        try:
            url = "http://82.push2.eastmoney.com/api/qt/clist/get"
            params = {
                "pn": "1", "pz": "6000", "po": "1", "np": "1", 
                "ut": "bd1d9ddb04089700cf9c27f6f7426281",
                "fltt": "2", "invt": "2", "fid": "f12",
                "fs": "m:0+t:6,m:1+t:2,m:1+t:23,m:0+t:80",
                "fields": "f12,f14"
            }
            resp = requests.get(url, params=params, timeout=10)
            data = resp.json()
            stocks = data.get("data", {}).get("diff", [])
            if stocks:
                for s in stocks:
                    symbol = str(s["f12"])
                    name = str(s["f14"])
                    if symbol.isdigit():
                        py, abbr = get_pinyin_info(name)
                        all_records.append((symbol, name, "CN", now_str, py, abbr))
                print(f"   ✅ 已通过 HTTP API 成功获取 {len(stocks)} 条 A 股全量元数据")
        except Exception as e_http:
            print(f"   ⚠️ HTTP 接口获取失败 ({e_http})，尝试 AkShare 接口...")
            # 策略 B & C 的逻辑可以精简到这里
            a_stocks = ak.stock_zh_a_spot_em()
            if not a_stocks.empty:
                s_col = "代码" if "代码" in a_stocks.columns else "symbol"
                n_col = "名称" if "名称" in a_stocks.columns else "name"
                for _, row in a_stocks.iterrows():
                    symbol, name = str(row[s_col]), str(row[n_col])
                    if symbol.isdigit():
                        py, abbr = get_pinyin_info(name)
                        all_records.append((symbol, name, "CN", now_str, py, abbr))
                print(f"   ✅ 已通过 AkShare 获取 {len(a_stocks)} 条 A 股元数据")
    except Exception as e:
        print(f"   ⚠️ A 股列表整体获取异常: {e}")

    if all_records:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.executemany("""
            INSERT OR REPLACE INTO stock_meta (symbol, name, market, last_updated, pinyin, pinyin_abbr)
            VALUES (?, ?, ?, ?, ?, ?)
        """, all_records)
        conn.commit()
        conn.close()
        print(f"✅ 元数据同步完成 ({len(all_records)} 条)")
