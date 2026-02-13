"""
交易日历工具
支持港股 (HK) 和 A股 (CN) 两个市场
用于计算下一个交易日、判断是否休市等
"""

from datetime import datetime, timedelta
import logging

try:
    from backend.database import get_connection
except ImportError:
    # Fallback for standalone scripts or different import paths
    try:
        from database import get_connection
    except:
        get_connection = None

logger = logging.getLogger(__name__)

# ============ 港股 (HK) 交易日历 (Fallback) ============
HK_HOLIDAYS_DEFAULT = {
    '2025-01-01',  # 元旦
    '2025-01-29',  # 农历新年
    '2025-01-30',  # 农历年初二
    '2025-01-31',  # 农历年初三
    '2025-04-04',  # 清明节
    '2025-04-18',  # 耶稣受难日
    '2025-04-21',  # 复活节星期一
    '2025-05-01',  # 劳动节
    '2025-05-05',  # 佛诞
    '2025-07-01',  # 香港特区成立纪念日
    '2025-10-01',  # 国庆日
    '2025-10-07',  # 重阳节
    '2025-12-25',  # 圣诞节
    '2025-12-26',  # 圣诞节翌日
    # 2026
    '2026-01-01',  # New Year
    '2026-02-17',  # Lunar New Year
    '2026-02-18',
    '2026-02-19',
    '2026-04-03',  # Good Friday
    '2026-04-06',  # Ching Ming (Observed)
    '2026-04-07',  # Easter Monday (Substitute)
    '2026-05-01',  # Labour Day
    '2026-05-25',  # Buddha Birthday (Observed)
    '2026-06-19',  # Tuen Ng Festival
    '2026-07-01',  # SAR Day
    '2026-10-01',  # National Day
    '2026-10-19',  # Chung Yeung (Observed)
    '2026-12-25',  # Christmas
}

# ============ A股 (CN) 交易日历 (Fallback) ============
CN_HOLIDAYS_DEFAULT = {
    '2025-01-01',  # 元旦
    '2025-01-28',  # 春节 (1/28 - 2/4)
    '2025-01-29',
    '2025-01-30',
    '2025-01-31',
    '2025-02-01',
    '2025-02-02',
    '2025-02-03',
    '2025-02-04',
    '2025-04-04',  # 清明节 (4/4 - 4/6)
    '2025-04-05',
    '2025-04-06',
    '2025-05-01',  # 劳动节 (5/1 - 5/5)
    '2025-05-02',
    '2025-05-03',
    '2025-05-04',
    '2025-05-05',
    '2025-05-31',  # 端午节 (5/31 - 6/2)
    '2025-06-01',
    '2025-06-02',
    '2025-10-01',  # 国庆+中秋 (10/1 - 10/8)
    '2025-10-02',
    '2025-10-03',
    '2025-10-04',
    '2025-10-05',
    '2025-10-06',
    '2025-10-07',
    '2025-10-08',
    # 2026
    '2026-01-01',  # 元旦
    '2026-01-02',
    '2026-02-15',  # 春节 (2/15 - 2/23)
    '2026-02-16',
    '2026-02-17',
    '2026-02-18',
    '2026-02-19',
    '2026-02-20',
    '2026-02-21',
    '2026-02-22',
    '2026-02-23',
    '2026-04-05',  # 清明节 (4/5 - 4/6)
    '2026-04-06',
    '2026-05-01',  # 劳动节 (5/1 - 5/5)
    '2026-05-02',
    '2026-05-03',
    '2026-05-04',
    '2026-05-05',
    '2026-06-19',  # 端午节
    '2026-09-25',  # 中秋节 (9/25 - 9/27)
    '2026-09-26',
    '2026-09-27',
    '2026-10-01',  # 国庆节 (10/1 - 10/7)
    '2026-10-02',
    '2026-10-03',
    '2026-10-04',
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
}

# --- Cache State ---
_HOLIDAYS_CACHE = {
    "HK": None,
    "CN": None
}
_LAST_CACHE_TIME = 0
CACHE_TTL = 3600 * 24  # Cache for 24 hours

def refresh_holidays_from_db():
    """
    Attempt to load holidays from database.
    Updates global cache on success.
    """
    global _HOLIDAYS_CACHE, _LAST_CACHE_TIME
    
    if not get_connection:
        return
        
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Check if table exists (SQLite/LibSQL specific check)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='market_holidays'")
        if not cursor.fetchone():
            return
            
        cursor.execute("SELECT date, market FROM market_holidays")
        rows = cursor.fetchall()
        
        hk_set = set()
        cn_set = set()
        
        for date_str, market in rows:
            if market == 'HK':
                hk_set.add(date_str)
            elif market == 'CN':
                cn_set.add(date_str)
        
        # Only update if we got data
        if hk_set:
            _HOLIDAYS_CACHE["HK"] = hk_set
        if cn_set:
            _HOLIDAYS_CACHE["CN"] = cn_set
            
        _LAST_CACHE_TIME = datetime.now().timestamp()
        
        # Important: Close the connection
        if hasattr(conn, 'close'):
            conn.close()
        
    except Exception as e:
        logger.warning(f"Failed to load holidays from DB: {e}")

def get_market_from_symbol(symbol: str) -> str:
    """根据股票代码判断市场"""
    if symbol and len(symbol) == 5:
        return "HK"
    return "CN"


def get_holidays(market: str) -> set:
    """获取指定市场的假期列表 (Priority: DB Cache > Hardcoded Default)"""
    global _HOLIDAYS_CACHE
    
    # Init or Refresh Cache
    if _HOLIDAYS_CACHE.get(market) is None:
        refresh_holidays_from_db()
        
    cached = _HOLIDAYS_CACHE.get(market)
    if cached:
        return cached
        
    # Fallback to default
    if market == "HK":
        return HK_HOLIDAYS_DEFAULT
    return CN_HOLIDAYS_DEFAULT


def is_market_closed(date: datetime, market: str = "HK") -> bool:
    """判断指定日期是否为休市日 (周末或假期)"""
    # 周六(5)或周日(6)
    if date.weekday() >= 5:
        return True
    # 检查假期列表
    date_str = date.strftime('%Y-%m-%d')
    return date_str in get_holidays(market)


def is_trading_day(date_str: str, symbol: str = None, market: str = None) -> bool:
    """
    判断指定日期是否为交易日
    """
    try:
        if isinstance(date_str, datetime):
            date = date_str
        else:
            date = datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        return False
    
    # 确定市场
    if market is None:
        market = get_market_from_symbol(symbol) if symbol else "CN"
    
    return not is_market_closed(date, market)


def get_next_trading_day(from_date: datetime, market: str = "HK") -> datetime:
    """
    获取下一个交易日
    """
    next_day = from_date + timedelta(days=1)
    
    while is_market_closed(next_day, market):
        next_day = next_day + timedelta(days=1)
    
    return next_day


def get_next_trading_day_str(from_date_str: str, symbol: str = None, market: str = None) -> str:
    """
    获取下一个交易日（字符串版本）
    """
    from_date = datetime.strptime(from_date_str, '%Y-%m-%d')
    
    # 确定市场
    if market is None:
        market = get_market_from_symbol(symbol) if symbol else "HK"
    
    next_day = get_next_trading_day(from_date, market)
    return next_day.strftime('%Y-%m-%d')
