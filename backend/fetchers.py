import os
import sys
import io

# 修复 Windows 控制台编码问题
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    except (AttributeError, io.UnsupportedOperation):
        pass

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

    # 2. A 股列表 (分交易所独立获取，任一失败不影响其他)
    print("   正在获取 A 股列表...")
    cn_count = 0
    
    # 策略 A: 使用东财 HTTP API 获取全量沪深 A 股 (最稳定，覆盖 5000+ 只)
    # 注意: API 服务端限制每页最多 100 条，需要分页获取
    http_success = False
    try:
        url = "http://82.push2.eastmoney.com/api/qt/clist/get"
        all_a_stocks = []
        
        # 沪深主板(m:0+t:6, m:1+t:2)，创业板(m:0+t:80)，科创板(m:1+t:23)
        for fs_code in ["m:0+t:6,m:0+t:80", "m:1+t:2,m:1+t:23"]:
            page = 1
            while True:
                params = {
                    "pn": str(page), "pz": "100", "po": "1", "np": "1",
                    "ut": "bd1d9ddb04089700cf9c27f6f7426281",
                    "fltt": "2", "invt": "2", "fid": "f12",
                    "fs": fs_code,
                    "fields": "f12,f14"
                }
                resp = requests.get(url, params=params, timeout=15)
                data = resp.json()
                stocks = data.get("data", {}).get("diff", [])
                if not stocks:
                    break
                all_a_stocks.extend(stocks)
                total = data.get("data", {}).get("total", 0)
                if page * 100 >= total:
                    break
                page += 1
        
        if all_a_stocks:
            for s in all_a_stocks:
                symbol = str(s.get("f12", ""))
                name = str(s.get("f14", ""))
                if symbol.isdigit() and len(symbol) == 6:
                    py, abbr = get_pinyin_info(name)
                    all_records.append((symbol, name, "CN", now_str, py, abbr))
                    cn_count += 1
            print(f"   ✅ [HTTP API] 沪深 A 股: {cn_count} 条")
            http_success = True
    except Exception as e_http:
        print(f"   ⚠️ HTTP API 失败: {e_http}")

    # 策略 B: 如果 HTTP 失败，使用 AkShare 分交易所获取 (每个独立容错)
    if not http_success:
        # B1: 上证主板
        try:
            sh_main = ak.stock_info_sh_name_code(symbol="主板A股")
            for _, row in sh_main.iterrows():
                symbol = str(row.get("证券代码", "")).strip()
                name = str(row.get("证券简称", "")).strip()
                if symbol.isdigit() and len(symbol) == 6:
                    py, abbr = get_pinyin_info(name)
                    all_records.append((symbol, name, "CN", now_str, py, abbr))
                    cn_count += 1
            print(f"   ✅ [AkShare] 上证主板: {len(sh_main)} 条")
        except Exception as e:
            print(f"   ⚠️ 上证主板获取失败: {e}")

        # B2: 上证科创板
        try:
            sh_kcb = ak.stock_info_sh_name_code(symbol="科创板")
            for _, row in sh_kcb.iterrows():
                symbol = str(row.get("证券代码", "")).strip()
                name = str(row.get("证券简称", "")).strip()
                if symbol.isdigit() and len(symbol) == 6:
                    py, abbr = get_pinyin_info(name)
                    all_records.append((symbol, name, "CN", now_str, py, abbr))
                    cn_count += 1
            print(f"   ✅ [AkShare] 上证科创板: {len(sh_kcb)} 条")
        except Exception as e:
            print(f"   ⚠️ 上证科创板获取失败: {e}")

        # B3: 深证 A 股 (含主板+创业板)
        try:
            sz_a = ak.stock_info_sz_name_code(symbol="A股列表")
            for _, row in sz_a.iterrows():
                symbol = str(row.get("A股代码", "")).strip()
                name = str(row.get("A股简称", "")).strip()
                if symbol.isdigit() and len(symbol) == 6:
                    py, abbr = get_pinyin_info(name)
                    all_records.append((symbol, name, "CN", now_str, py, abbr))
                    cn_count += 1
            print(f"   ✅ [AkShare] 深证A股: {len(sz_a)} 条")
        except Exception as e:
            print(f"   ⚠️ 深证A股获取失败: {e}")

    # 策略 C: 北交所 (独立获取，因为经常有 SSL 问题)
    try:
        bj = ak.stock_info_bj_name_code()
        for _, row in bj.iterrows():
            symbol = str(row.get("证券代码", "")).strip()
            name = str(row.get("证券简称", "")).strip()
            if symbol.isdigit() and len(symbol) == 6:
                py, abbr = get_pinyin_info(name)
                all_records.append((symbol, name, "CN", now_str, py, abbr))
                cn_count += 1
        print(f"   ✅ [AkShare] 北交所: {len(bj)} 条")
    except Exception as e:
        print(f"   ⚠️ 北交所获取失败 (可忽略，占比极小): {e}")

    print(f"   📊 A 股合计: {cn_count} 条")

    # 批量写入数据库 (每 500 条一批，优化 Turso 远程写入性能)
    if all_records:
        import time
        start_time = time.time()
        conn = get_connection()
        cursor = conn.cursor()
        
        batch_size = 500
        total = len(all_records)
        for i in range(0, total, batch_size):
            batch = all_records[i:i+batch_size]
            # 使用单条 INSERT 语句批量插入
            placeholders = ",".join(["(?, ?, ?, ?, ?, ?)"] * len(batch))
            flat_values = tuple(val for record in batch for val in record)
            cursor.execute(f"""
                INSERT OR REPLACE INTO stock_meta (symbol, name, market, last_updated, pinyin, pinyin_abbr)
                VALUES {placeholders}
            """, flat_values)
        if (i + batch_size) % 2000 == 0 or i + batch_size >= total:
                print(f"   💾 已写入 {min(i + batch_size, total)}/{total} 条...")
        
        conn.commit()
        conn.close()
        
        duration = time.time() - start_time
        hk_count = len([r for r in all_records if r[2] == "HK"])
        cn_count = len([r for r in all_records if r[2] == "CN"])
        
        print(f"✅ 元数据同步完成 ({total} 条, 耗时 {duration:.1f}s)")
        
        # 发送企微通知
        from utils import send_wecom_notification
        report = f"### 📦 StockWise: 元数据同步\n"
        report += f"> **Status**: ✅ 完成\n"
        report += f"- **港股**: {hk_count} 条\n"
        report += f"- **A 股**: {cn_count} 条\n"
        report += f"- **耗时**: {duration:.1f}s"
        send_wecom_notification(report)

def sync_profiles(limit=20):
    """
    同步股票基本面概况 (Company Profile)
    策略: 优先同步有人关注的股票 (global_stock_pool)，其次补全 stock_meta 中缺失的信息
    限制: 默认每次只同步 20 个，避免接口限流
    """
    print(f"📡 开始同步公司概况 (Limit: {limit})...")
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. 找出所有关注的股票
    # 注意: 我们优先更新那些已经被关注但还没有 industry 信息的股票
    try:
        # 获取关注列表 (Left join to check if profile exists)
        query = """
            SELECT p.symbol, m.name, m.market
            FROM global_stock_pool p
            JOIN stock_meta m ON p.symbol = m.symbol
            WHERE m.industry IS NULL OR m.industry = ''
            LIMIT ?
        """
        cursor.execute(query, (limit,))
        targets = cursor.fetchall()
        
        if not targets:
            print("✨ 所有关注股票的概况信息已是最新的。")
            conn.close()
            return

        print(f"🔍 发现 {len(targets)} 只关注股票缺失概况信息，开始更新...")
        
        success_count = 0
        for symbol, name, market in targets:
            print(f"   Getting profile for {symbol} ({name}) [{market}]...")
            try:
                industry = ""
                main_bus = ""
                desc = ""
                
                if market == "CN":
                    # A 股接口
                    df = ak.stock_profile_cninfo(symbol=symbol)
                    if not df.empty:
                        record = df.iloc[0]
                        industry = record.get("所属行业", "")
                        main_bus = record.get("主营业务", "")
                        desc = record.get("经营范围")
                        intro = record.get("机构简介", "")
                        if not desc or len(str(desc)) < 5:
                            desc = intro
                
                elif market == "HK":
                    # 港股接口：公司资料 (包含所属行业和公司介绍)
                    try:
                        df_info = ak.stock_hk_company_profile_em(symbol=symbol)
                        if not df_info.empty:
                            record = df_info.iloc[0]
                            # 调试发现: 港股接口的"所属行业"在公司资料里，不在证券资料里
                            industry = record.get("所属行业", "")
                            desc = record.get("公司介绍", "")
                            # 港股没找到专门的主营业务字段，暂时为空
                            main_bus = "" 
                    except Exception as e_hk:
                        print(f"     ⚠️ 港股接口异常: {e_hk}")

                # 共有逻辑：更新数据库
                if industry or main_bus or desc:
                    # 截断过长文本
                    if desc and len(str(desc)) > 500:
                        desc = str(desc)[:497] + "..."
                    
                    cursor.execute("""
                        UPDATE stock_meta 
                        SET industry = ?, main_business = ?, description = ?
                        WHERE symbol = ?
                    """, (industry, main_bus, desc, symbol))
                    conn.commit()
                    success_count += 1
                else:
                    print(f"   ⚠️ 无数据: {symbol}")
                    
            except Exception as e:
                print(f"   ❌ 失败 {symbol}: {e}")
                import time
                time.sleep(1) # 出错歇一秒

        print(f"✅ 公司概况同步完成: 成功 {success_count}/{len(targets)}")
        
    except Exception as e:
        print(f"❌ 同步公司概况失败: {e}")
    finally:
        conn.close()

