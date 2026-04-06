import os
import sys
import io
import json
from pathlib import Path
from abc import ABC, abstractmethod
from typing import List, Optional

# 修复 Windows 控制台编码问题
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    except (AttributeError, io.UnsupportedOperation):
        pass

import requests
import akshare as ak
import pandas as pd
from datetime import datetime, timedelta
from config import BEIJING_TZ
from utils import get_market, get_pinyin_info, retry_request
from name_en_sanitize import sanitize_hk_name_en_candidate
from name_en_backfill import run_name_en_backfill
from database import get_connection
from backend.db_repo.queries import build_upsert_stock_meta_sql, UPDATE_STOCK_PROFILE_QUERY
from backend.logger import logger


class BaseFetcher(ABC):
    """數據獲取器基類，定義統一接口"""
    
    @abstractmethod
    def fetch_history(self, symbol: str, period: str = "daily", start_date: str = None) -> pd.DataFrame:
        """獲取歷史行情數據"""
        pass
        
    def fetch_realtime(self, symbol: str) -> dict:
        """获取并返回包含价格/时间/涨跌幅的实时字典 (Optional)"""
        return None


class AkShareFetcher(BaseFetcher):
    """AkShare 數據獲取器實現"""
    
    def fetch_realtime(self, symbol: str) -> dict:
        """使用 AkShare 通道获取实时数据 (AkShare 实现较重，建议优先使用 SmartFetcher 的轻量级实现)"""
        # 为保持一致性，AkSharefetcher 主要用于历史数据，实时数据由专门的逻辑处理
        return None

    def fetch_history(self, symbol: str, period: str = "daily", start_date: str = None) -> pd.DataFrame:
        beijing_now = datetime.now(BEIJING_TZ)
        end_date = beijing_now.strftime("%Y%m%d")
        
        if not start_date:
            start_date = (beijing_now - timedelta(days=365)).strftime("%Y%m%d")
        
        market = get_market(symbol)
        logger.info(f"📡 [AkShare] 正在获取 {market}:{symbol} {period} 数据 (从 {start_date} 起)...")
        
        @retry_request(max_retries=3, delay=3.0)
        def _fetch_hk():
            # 1. EastMoney (Primary)
            try:
                df = ak.stock_hk_hist(symbol=symbol, period=period, start_date=start_date, 
                                        end_date=end_date, adjust="qfq")
                if not df.empty: 
                    logger.info(f"✅ [AkShare] HK {symbol} fetched from EastMoney ({len(df)} rows)")
                    return df
            except Exception as e:
                logger.warning(f"⚠️ [AkShare] HK {symbol} EastMoney Hist failed: {e}")
            
            # Guard rail: Sina HK fallback endpoint is daily-only.
            # Running it for weekly/monthly can leak daily rows into period tables.
            if period == "daily":
                logger.info(f"📡 [AkShare] HK {symbol} Falling back to Sina...")
                try:
                    df = ak.stock_hk_daily(symbol=symbol, adjust="qfq")
                    if not df.empty:
                        if "date" in df.columns:
                            s_dt = datetime.strptime(start_date, "%Y%m%d").date()
                            df["date"] = pd.to_datetime(df["date"]).dt.date
                            df = df[df["date"] >= s_dt]

                        df = df.rename(columns={
                            "date": "日期", "open": "开盘", "high": "最高", "low": "最低", "close": "收盘", "volume": "成交量"
                        })
                        if "涨跌幅" not in df.columns:
                            df["涨跌幅"] = df["收盘"].pct_change() * 100
                        logger.info(f"✅ [AkShare] HK {symbol} fetched from Sina Fallback")
                        return df
                except Exception as e:
                    logger.error(f"❌ [AkShare] HK {symbol} Sina Fallback failed: {e}")
            return pd.DataFrame()

        @retry_request(max_retries=3, delay=3.0)
        def _fetch_cn():
            # 1. EastMoney (Primary)
            try:
                df = ak.stock_zh_a_hist(symbol=symbol, period=period, start_date=start_date, 
                                        end_date=end_date, adjust="qfq")
                if not df.empty: 
                    logger.info(f"✅ [AkShare] CN {symbol} fetched from EastMoney ({len(df)} rows)")
                    return df
            except Exception as e:
                logger.warning(f"⚠️ [AkShare] CN {symbol} EastMoney Hist failed: {e}")
            
            # 2. Sina (Fallback - Daily Only)
            # 注意: 排除 ETF (51/15等) 和 指数 (sh000/sz399)，它们有专用接口，调用个股接口会报错
            is_likely_etf = symbol.startswith(('51', '56', '58', '15', '16'))
            is_likely_index = symbol.startswith(('sh000', 'sz399')) or (symbol.isdigit() and symbol.startswith('000') and market=='CN' and False) # 简单判断
            
            if period == "daily" and not is_likely_etf and not is_likely_index:
                logger.info(f"📡 [AkShare] CN {symbol} Falling back to Sina...")
                try:
                    sina_sym = symbol
                    if symbol.startswith(('6', '9')): sina_sym = f"sh{symbol}"
                    elif symbol.startswith(('0', '3', '2')): sina_sym = f"sz{symbol}"
                    elif symbol.startswith(('4', '8')): sina_sym = f"bj{symbol}"
                    
                    df = ak.stock_zh_a_daily(symbol=sina_sym, start_date=start_date, 
                                             end_date=end_date, adjust="qfq")
                    if not df.empty:
                        df = df.rename(columns={
                            "date": "日期", "open": "开盘", "high": "最高", "low": "最低", "close": "收盘", "volume": "成交量"
                        })
                        if "涨跌幅" not in df.columns:
                            df["涨跌幅"] = df["收盘"].pct_change() * 100
                        logger.info(f"✅ [AkShare] CN {symbol} fetched from Sina Fallback")
                        return df
                except Exception as e:
                    logger.error(f"❌ [AkShare] CN {symbol} Sina Fallback failed: {e}")

            # 3. ETF (Fund)
            try:
                df = ak.fund_etf_hist_em(symbol=symbol, period=period, start_date=start_date, 
                                         end_date=end_date, adjust="qfq")
                if not df.empty: return df
            except: pass

            # 3b. ETF Sina Fallback
            if period == "daily":
                try:
                    prefix = "sh" if symbol.startswith('5') else "sz"
                    df = ak.fund_etf_hist_sina(symbol=f"{prefix}{symbol}")
                    if not df.empty:
                        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
                        s_dt = datetime.strptime(start_date, "%Y%m%d").strftime("%Y-%m-%d")
                        df = df[df['date'] >= s_dt]
                        df = df.rename(columns={
                            "date": "日期", "open": "开盘", "high": "最高", "low": "最低", "close": "收盘", "volume": "成交量"
                        })
                        if "涨跌幅" not in df.columns:
                            df["涨跌幅"] = df["收盘"].pct_change() * 100
                        return df
                except: pass

            # Guard rail: index daily fallback is daily-only.
            # Do not reuse it for weekly/monthly requests.
            if period == "daily":
                # 4. Index
                try:
                    df = ak.stock_zh_index_daily(symbol=symbol)
                    if not df.empty:
                        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
                        s_dt = datetime.strptime(start_date, "%Y%m%d").strftime("%Y-%m-%d")
                        df = df[df['date'] >= s_dt]
                        df = df.rename(columns={
                            "date": "日期", "open": "开盘", "high": "最高", "low": "最低", "close": "收盘", "volume": "成交量"
                        })
                        if "涨跌幅" not in df.columns:
                            df["涨跌幅"] = df["收盘"].pct_change() * 100
                        return df
                except:
                    pass
            
            return pd.DataFrame()

        @retry_request(max_retries=2, delay=2.0)
        def _fetch_us():
            # Yahoo is the primary free source for US prices.
            try:
                import yfinance as yf
            except ImportError:
                logger.warning("⚠️ [Yahoo] yfinance 未安装，无法获取 US 行情")
                return pd.DataFrame()

            try:
                ticker = str(symbol).strip().upper()
                s_dt = datetime.strptime(start_date, "%Y%m%d").strftime("%Y-%m-%d")
                hist = yf.Ticker(ticker).history(start=s_dt, interval="1d", auto_adjust=False)
                if hist is None or hist.empty:
                    return pd.DataFrame()
                hist = hist.reset_index()
                date_col = "Date" if "Date" in hist.columns else hist.columns[0]
                hist = hist.rename(
                    columns={
                        date_col: "日期",
                        "Open": "开盘",
                        "High": "最高",
                        "Low": "最低",
                        "Close": "收盘",
                        "Volume": "成交量",
                    }
                )
                hist["日期"] = pd.to_datetime(hist["日期"]).dt.strftime("%Y-%m-%d")
                hist["涨跌幅"] = pd.to_numeric(hist["收盘"], errors="coerce").pct_change() * 100
                out_cols = ["日期", "开盘", "最高", "最低", "收盘", "成交量", "涨跌幅"]
                hist = hist[[c for c in out_cols if c in hist.columns]]
                logger.info(f"✅ [Yahoo] US {symbol} fetched ({len(hist)} rows)")
                return hist
            except Exception as e:
                logger.warning(f"⚠️ [Yahoo] US {symbol} history failed: {e}")
                return pd.DataFrame()


        try:
            if market == "HK":
                return _fetch_hk()
            elif market == "US":
                return _fetch_us()
            else:
                return _fetch_cn()
        except Exception as e:
            logger.error(f"❌ AkShareFetcher {symbol} 获取失败: {e}")
            return pd.DataFrame()


class EODHDFetcher(BaseFetcher):
    """EODHD 數據獲取器 (全球數據，收費源 - 佔位實現)"""
    
    def fetch_history(self, symbol: str, period: str = "daily", start_date: str = None) -> pd.DataFrame:
        # TODO: 未來集成 EODHD API
        logger.warning(f"⚠️ EODHDFetcher 尚未實現，跳過 {symbol}")
        return pd.DataFrame()


class SinaSpotFetcher(BaseFetcher):
    """
    轻量级 HTTP 实时数据获取器 (Sina)
    Bypasses AkShare wrapper for maximum speed and stability.
    """
    def fetch_history(self, symbol: str, period: str = "daily", start_date: str = None) -> pd.DataFrame:
        # Sina 历史接口实现复杂且不稳定，这里只做实时
        return pd.DataFrame()
        
    def fetch_realtime(self, symbol: str) -> dict:
        headers = {'Referer': 'http://finance.sina.com.cn/'}
        market = get_market(symbol)
        
        # 1. 构建 Code
        if market == 'US':
            # Yahoo fallback for US realtime snapshot
            try:
                import yfinance as yf
                ticker = str(symbol).strip().upper()
                info = yf.Ticker(ticker).fast_info
                last_price = float(info.get("lastPrice") or 0)
                prev_close = float(info.get("previousClose") or 0)
                if last_price <= 0:
                    return None
                change_pct = ((last_price - prev_close) / prev_close * 100) if prev_close > 0 else 0.0
                now = datetime.now(BEIJING_TZ)
                d = now.strftime("%Y-%m-%d")
                return {
                    "symbol": symbol,
                    "price": last_price,
                    "open": float(info.get("open") or last_price),
                    "high": float(info.get("dayHigh") or last_price),
                    "low": float(info.get("dayLow") or last_price),
                    "close": last_price,
                    "volume": float(info.get("lastVolume") or 0),
                    "change_pct": change_pct,
                    "date": d,
                    "time": f"{d} {now.strftime('%H:%M:%S')}",
                }
            except Exception as e:
                logger.warning(f"⚠️ [YahooSpot] {symbol} US realtime failed: {e}")
                return None
        elif market == 'HK':
            code = f"rt_hk{symbol}"
        else:
            # A 股
            if symbol.startswith('6'): code = f"sh{symbol}"
            elif symbol.startswith(('0', '3')): code = f"sz{symbol}"
            elif symbol.startswith(('4', '8')): code = f"bj{symbol}"
            else: code = f"sz{symbol}" # Fallback
            
        url = f"http://hq.sinajs.cn/list={code}"
        
        try:
            resp = requests.get(url, headers=headers, timeout=4)
            text = resp.text.strip()
            
            # Format Check
            if not text or '=""' in text:
                return None
                
            content = text.split('=')[1].strip('";').split(',')
            if len(content) < 3: return None
            
            result = {}
            beijing_now = datetime.now(BEIJING_TZ)
            
            if market == 'HK':
                # HK: 6=Last, 7=Change, 8=Pct, 17=Date, 18=Time
                # Volume is at index 12 (Shares), Turnover at 11 (Amount in HKD) check?
                # Actually for HK: 
                # 0:EnName, 1:CnName, 2:Open, 3:PrevClose, 4:High, 5:Low, 6:Last, 7:Diff, 8:Pct, 9:Bid, 10:Ask, 11:Turnover, 12:Vol
                price = float(content[6])
                date_str = content[17].replace('/', '-') # 2026/02/04 -> 2026-02-04
                
                result = {
                    'symbol': symbol,
                    'price': price,
                    'open': float(content[2]),
                    'high': float(content[4]),
                    'low': float(content[5]),
                    'close': price, # Realtime close = current
                    'volume': float(content[12]), # Use Volume (Shares)
                    'change_pct': float(content[8]),
                    'date': date_str,
                    'time': f"{date_str} {content[18]}"
                }
            else:
                # CN: 1=Open, 2=PrevClose, 3=Current, 4=High, 5=Low, 8=Vol(Share), 30=Date, 31=Time
                # Note: CN Volume is in Shares (Hand? No, usually Shares)
                # Sina CN Volume (index 8) is in SHARES (股).
                current_price = float(content[3])
                prev_close = float(content[2])
                change_pct = ((current_price - prev_close) / prev_close) * 100 if prev_close > 0 else 0
                
                result = {
                    'symbol': symbol,
                    'price': current_price,
                    'open': float(content[1]),
                    'high': float(content[4]),
                    'low': float(content[5]),
                    'close': current_price,
                    'volume': float(content[8]), 
                    'change_pct': change_pct,
                    'date': content[30],
                    'time': f"{content[30]} {content[31]}"
                }
            
            # 补丁：Sina 成交量单位问题
            # A股 Sina 返回的是 股数，我们数据库存的是 股数，一致。
            # 港股 Sina 返回的是 股数，一致。
            
            return result
            
        except Exception as e:
            logger.warning(f"⚠️ [SinaSpot] {symbol} fetch failed: {e}")
            return None


class SmartFetcher(BaseFetcher):
    """智能獲取器：集成多個 Fetcher 並實現降級邏輯"""
    
    def __init__(self, fetchers: List[BaseFetcher] = None):
        # Default: History=AkShare, Realtime=Sina
        self.fetchers = fetchers or [AkShareFetcher()]
        self.realtime_fetcher = SinaSpotFetcher()
        
    def fetch_realtime(self, symbol: str) -> pd.DataFrame:
        """
        Special method to return a 1-row DataFrame containing realtime data.
        Returns empty DataFrame if failed.
        """
        data = self.realtime_fetcher.fetch_realtime(symbol)
        if data:
            # Convert dict to DataFrame matching standard schema
            df = pd.DataFrame([data])
            # Remap columns to match what prices.py expects from akshare
            # prices.py expects:
            # 日期, 开盘, 收盘, 最高, 最低, 成交量, 涨跌幅
            df = df.rename(columns={
                "date": "日期", "open": "开盘", "close": "收盘",
                "high": "最高", "low": "最低", "volume": "成交量", "change_pct": "涨跌幅"
            })
            return df
        return pd.DataFrame()

    def fetch_history(self, symbol: str, period: str = "daily", start_date: str = None) -> pd.DataFrame:
        for fetcher in self.fetchers:
            try:
                df = fetcher.fetch_history(symbol, period, start_date)
                if not df.empty:
                    return df
                logger.warning(f"⚠️ {fetcher.__class__.__name__} 返回空數據: {symbol} {period}，嘗試下一個源...")
            except Exception as e:
                logger.error(f"❌ {fetcher.__class__.__name__} 執行異常: {symbol} {period} - {e}")

        # Period endpoints from public data sources are less stable than daily.
        # If weekly/monthly failed, fall back to daily history and let prices.py normalize.
        if period in ("weekly", "monthly"):
            logger.warning(f"⚠️ {symbol} {period} 直连源失败，回退为 daily 历史派生。")
            for fetcher in self.fetchers:
                try:
                    df = fetcher.fetch_history(symbol, "daily", start_date)
                    if not df.empty:
                        logger.info(f"✅ {symbol} {period} 回退成功：使用 daily 历史派生。")
                        return df
                except Exception as e:
                    logger.warning(f"⚠️ {fetcher.__class__.__name__} daily fallback failed: {symbol} - {e}")
        
        logger.error(f"❌ 所有數據源均失效: {symbol} ({period})")
        return pd.DataFrame()



def fetch_stock_data(symbol: str, period: str = "daily", start_date: str = None, is_realtime: bool = False) -> pd.DataFrame:
    """获取历史行情数据 (支持 A/H) - Standard interface supporting multi-provider migration."""
    # Note: Transitioning to Abstract Fetcher Factory pattern
    # Use SmartFetcher with automated fallback mechanism
    fetcher = SmartFetcher()
    
    # [Opt] Realtime Route: Use lightweight Sina Spot API
    if is_realtime and period == "daily":
        logger.info(f"⚡ [Realtime] Fetching snapshot for {symbol} via Sina...")
        df = fetcher.fetch_realtime(symbol)
        if not df.empty:
            return df
        logger.warning(f"⚠️ [Realtime] Sina Spot failed for {symbol}, falling back to daily history...")
        
    return fetcher.fetch_history(symbol, period, start_date)

def _apply_curated_cn_name_en(cursor) -> None:
    """Apply trusted CN English names from bundled JSON (curated universe)."""
    data_path = Path(__file__).resolve().parent / "data" / "cn_name_en_curated.json"
    if not data_path.is_file():
        return
    try:
        raw = json.loads(data_path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"   ⚠️ 无法读取策展 CN 英文名映射: {e}")
        return
    if not isinstance(raw, dict):
        return
    n = 0
    for symbol, name_en in raw.items():
        if not symbol or not name_en:
            continue
        ne = str(name_en).strip()
        if not ne:
            continue
        sym = str(symbol).strip()
        cursor.execute(
            "UPDATE stock_meta SET name_en = ? WHERE symbol = ? AND market = 'CN'",
            (ne, sym),
        )
        n += 1
    if n:
        logger.info(f"   ✅ 已应用策展 A 股英文名配置 ({n} 条)")


def _apply_curated_hk_name_en(cursor) -> None:
    """Apply trusted HK English names from bundled JSON (curated universe, same pattern as CN)."""
    data_path = Path(__file__).resolve().parent / "data" / "hk_name_en_curated.json"
    if not data_path.is_file():
        return
    try:
        raw = json.loads(data_path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"   ⚠️ 无法读取策展港股英文名映射: {e}")
        return
    if not isinstance(raw, dict):
        return
    n = 0
    for symbol, name_en in raw.items():
        if not symbol or not name_en:
            continue
        ne = str(name_en).strip()
        if not ne:
            continue
        sym = str(symbol).strip()
        cursor.execute(
            "UPDATE stock_meta SET name_en = ? WHERE symbol = ? AND market = 'HK'",
            (ne, sym),
        )
        n += 1
    if n:
        logger.info(f"   ✅ 已应用策展港股英文名配置 ({n} 条)")


def sync_stock_meta():
    """同步股票基础信息 (名称、市场、拼音、港股英文名 + 美股元数据)"""
    import time
    start_time = time.time()  # 统计完整同步耗时
    
    logger.info("\n📦 同步股票元数据...")
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    all_records = []

    # 1. 港股列表：优先新浪行情（含英文名称），失败则回退东财 EM
    hk_loaded = False
    try:
        hk_stocks = ak.stock_hk_spot()
        if hk_stocks is not None and not hk_stocks.empty:
            symbol_col = "代码" if "代码" in hk_stocks.columns else None
            name_col = (
                "中文名称"
                if "中文名称" in hk_stocks.columns
                else ("名称" if "名称" in hk_stocks.columns else None)
            )
            en_col = "英文名称" if "英文名称" in hk_stocks.columns else None
            if symbol_col and name_col:
                for _, row in hk_stocks.iterrows():
                    symbol = str(row[symbol_col]).strip()
                    name = str(row[name_col]).strip()
                    if not symbol.isdigit():
                        continue
                    name_en = None
                    if en_col and pd.notna(row.get(en_col)):
                        en_raw = str(row[en_col]).strip()
                        if en_raw and en_raw.lower() not in ("nan", "none"):
                            name_en = sanitize_hk_name_en_candidate(name, en_raw)
                    py, abbr = get_pinyin_info(name)
                    all_records.append((symbol, name, name_en, "HK", now_str, py, abbr))
                hk_loaded = True
                logger.info(f"   已获取 {len(hk_stocks)} 条港股元数据 (Sina，含英文名)")
    except Exception as e:
        logger.warning(f"   ⚠️ 港股 Sina 列表获取失败: {e}")

    if not hk_loaded:
        try:
            hk_stocks = ak.stock_hk_spot_em()
            if not hk_stocks.empty:
                symbol_col = "代码" if "代码" in hk_stocks.columns else "symbol"
                name_col = "名称" if "名称" in hk_stocks.columns else "name"
                for _, row in hk_stocks.iterrows():
                    symbol = str(row[symbol_col]).strip()
                    name = str(row[name_col]).strip()
                    if symbol.isdigit():
                        py, abbr = get_pinyin_info(name)
                        all_records.append((symbol, name, None, "HK", now_str, py, abbr))
                logger.info(f"   已获取 {len(hk_stocks)} 条港股元数据 (EM 回退，无英文名)")
        except Exception as e:
            logger.warning(f"   ⚠️ 港股 EM 列表获取失败: {e}")
        
    def _process_ak_dataframe(df, market_code="CN", symbol_col="证券代码", name_col="证券简称", label="列表"):
        """Helper to process akshare stock list dataframe"""
        count = 0
        if df is None or df.empty: return 0
        
        try:
            for _, row in df.iterrows():
                symbol = str(row.get(symbol_col, "")).strip()
                name = str(row.get(name_col, "")).strip()
                if symbol.isdigit() and len(symbol) == 6:
                    py, abbr = get_pinyin_info(name)
                    all_records.append((symbol, name, None, market_code, now_str, py, abbr))
                    count += 1
            logger.info(f"   ✅ [AkShare] {label}: {count} 条")
            return count
        except Exception as e:
            logger.warning(f"   ⚠️ {label} 处理异常: {e}")
            return 0

    # 2. A 股列表 (分交易所独立获取，任一失败不影响其他)
    logger.info("   正在获取 A 股列表...")
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
                    all_records.append((symbol, name, None, "CN", now_str, py, abbr))
                    cn_count += 1
            logger.info(f"   ✅ [HTTP API] 沪深 A 股: {cn_count} 条")
            http_success = True
    except Exception as e_http:
        logger.warning(f"   ⚠️ HTTP API 失败: {e_http}")

    # 策略 B: 如果 HTTP 失败，使用 AkShare 分交易所获取 (每个独立容错)
    if not http_success:
        # B1: 上证主板
        try:
            df = ak.stock_info_sh_name_code(symbol="主板A股")
            cn_count += _process_ak_dataframe(df, label="上证主板")
        except Exception as e:
            logger.warning(f"   ⚠️ 上证主板获取失败: {e}")

        # B2: 上证科创板
        try:
            df = ak.stock_info_sh_name_code(symbol="科创板")
            cn_count += _process_ak_dataframe(df, label="上证科创板")
        except Exception as e:
            logger.warning(f"   ⚠️ 上证科创板获取失败: {e}")

        # B3: 深证 A 股 (含主板+创业板)
        try:
            df = ak.stock_info_sz_name_code(symbol="A股列表")
            cn_count += _process_ak_dataframe(df, symbol_col="A股代码", name_col="A股简称", label="深证A股")
        except Exception as e:
            logger.warning(f"   ⚠️ 深证A股获取失败: {e}")

    # 策略 C: 北交所 (独立获取)
    try:
        df = ak.stock_info_bj_name_code()
        cn_count += _process_ak_dataframe(df, label="北交所")
    except Exception as e:
        logger.warning(f"   ⚠️ 北交所获取失败: {e}")

    logger.info(f"   📊 A 股合计: {cn_count} 条")

    # 3. 美股列表 (Yahoo universe: S&P500 + Nasdaq100 + Dow30)
    us_count = 0
    try:
        us_name_map = {}
        # Free public universe bootstrap: S&P 500, Nasdaq-100, Dow 30.
        wiki_sources = [
            ("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies", "Symbol", "Security"),
            ("https://en.wikipedia.org/wiki/Nasdaq-100", "Ticker", "Company"),
            ("https://en.wikipedia.org/wiki/Dow_Jones_Industrial_Average", "Symbol", "Company"),
        ]
        for url, symbol_col, name_col in wiki_sources:
            try:
                dfs = pd.read_html(url)
            except Exception:
                dfs = []
            for df in dfs:
                # Flatten multi-index headers if present.
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = [str(c[-1]).strip() for c in df.columns]
                # Tolerate slight column naming drift on wiki pages.
                cols = {str(c).strip(): c for c in df.columns}
                sym_key = cols.get(symbol_col) or cols.get("Ticker symbol") or cols.get("Ticker")
                name_key = cols.get(name_col) or cols.get("Company") or cols.get("Security")
                if sym_key is None or name_key is None:
                    continue
                for _, row in df[[sym_key, name_key]].dropna().iterrows():
                    raw = row[sym_key]
                    sym = str(raw).strip().upper()
                    if not sym:
                        continue
                    # Yahoo uses '-' for class shares (e.g. BRK-B).
                    sym = sym.replace(".", "-")
                    name_en = str(row[name_key]).strip()
                    if not name_en:
                        name_en = sym
                    us_name_map[sym] = name_en
        # Hard fallback so US pipeline never degenerates to zero symbols.
        if not us_name_map:
            us_name_map = {
                "SPY": "SPDR S&P 500 ETF Trust",
                "QQQ": "Invesco QQQ Trust",
                "DIA": "SPDR Dow Jones Industrial Average ETF Trust",
                "AAPL": "Apple Inc.",
                "MSFT": "Microsoft Corporation",
                "AMZN": "Amazon.com, Inc.",
                "NVDA": "NVIDIA Corporation",
                "GOOGL": "Alphabet Inc.",
                "META": "Meta Platforms, Inc.",
                "TSLA": "Tesla, Inc.",
            }
        for sym, name_en in sorted(us_name_map.items()):
            name = name_en
            if not name:
                continue
            py, abbr = "", ""
            all_records.append((sym, name, name_en, "US", now_str, py, abbr))
            us_count += 1
        logger.info(f"   ✅ [Yahoo] 美股元数据: {us_count} 条")
    except Exception as e:
        logger.warning(f"   ⚠️ 美股 Yahoo 列表获取失败: {e}")

    # 批量写入数据库 (每 500 条一批，优化 Turso 远程写入性能)
    if all_records:
        conn = get_connection()
        cursor = conn.cursor()
        
        batch_size = 500
        total = len(all_records)
        for i in range(0, total, batch_size):
            batch = all_records[i:i+batch_size]
            flat_values = tuple(val for record in batch for val in record)
            sql = build_upsert_stock_meta_sql(len(batch))
            cursor.execute(sql, flat_values)
            if (i + batch_size) % 2000 == 0 or i + batch_size >= total:
                logger.info(f"   💾 已写入 {min(i + batch_size, total)}/{total} 条...")

        # Tushare (optional) + Yahoo Finance gap fill; curated JSON still wins below.
        run_name_en_backfill(cursor)

        _apply_curated_cn_name_en(cursor)
        _apply_curated_hk_name_en(cursor)

        conn.commit()
        conn.close()
        
        duration = time.time() - start_time
        hk_count = len([r for r in all_records if r[3] == "HK"])
        cn_count = len([r for r in all_records if r[3] == "CN"])
        us_count = len([r for r in all_records if r[3] == "US"])
        
        logger.info(f"✅ 元数据同步完成 ({total} 条, 耗时 {duration:.1f}s)")
        
        return {
            "total_records": total,
            "hk_count": hk_count,
            "cn_count": cn_count,
            "us_count": us_count,
            "duration_seconds": round(duration, 1)
        }

def sync_profiles(limit=20):
    """
    同步股票基本面概况 (Company Profile)
    策略: 优先同步有人关注的股票 (global_stock_pool)，其次补全 stock_meta 中缺失的信息
    限制: 默认每次只同步 20 个，避免接口限流
    """
    logger.info(f"📡 开始同步公司概况 (Limit: {limit})...")
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
            logger.info("✨ 所有关注股票的概况信息已是最新的。")
            conn.close()
            return

        logger.info(f"🔍 发现 {len(targets)} 只关注股票缺失概况信息，开始更新...")
        
        success_count = 0
        for symbol, name, market in targets:
            logger.info(f"   Getting profile for {symbol} ({name}) [{market}]...")
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
                elif market == "US":
                    try:
                        import yfinance as yf
                        info = yf.Ticker(symbol).info or {}
                        industry = str(info.get("industry") or "")
                        main_bus = str(info.get("longBusinessSummary") or "")
                        desc = str(info.get("longName") or "")
                    except Exception as e_us:
                        logger.warning(f"     ⚠️ 美股概况接口异常 {symbol}: {e_us}")

                # 共有逻辑：更新数据库
                if industry or main_bus or desc:
                    # 截断过长文本
                    if desc and len(str(desc)) > 500:
                        desc = str(desc)[:497] + "..."
                    
                    cursor.execute(UPDATE_STOCK_PROFILE_QUERY, (industry, main_bus, desc, symbol))
                    conn.commit()
                    success_count += 1
                else:
                    logger.warning(f"   ⚠️ 无数据: {symbol}")
                    
            except Exception as e:
                logger.error(f"   ❌ 失败 {symbol}: {e}")
                import time
                time.sleep(1) # 出错歇一秒

        logger.info(f"✅ 公司概况同步完成: 成功 {success_count}/{len(targets)}")
        
    except Exception as e:
        logger.error(f"❌ 同步公司概况失败: {e}")
    finally:
        conn.close()
