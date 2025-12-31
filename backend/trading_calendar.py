"""
交易日历工具
支持港股 (HK) 和 A股 (CN) 两个市场
用于计算下一个交易日、判断是否休市等
"""

from datetime import datetime, timedelta

# ============ 港股 (HK) 交易日历 ============
HK_HOLIDAYS_2025 = {
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
}

HK_HOLIDAYS_2026 = {
    '2026-01-01',  # 元旦
    '2026-02-17',  # 农历新年 (预估)
    '2026-02-18',
    '2026-02-19',
    '2026-04-03',  # 清明节 (预估)
    '2026-04-06',  # 复活节星期一
    '2026-05-01',  # 劳动节
    '2026-05-24',  # 佛诞 (预估)
    '2026-07-01',  # 香港特区成立纪念日
    '2026-10-01',  # 国庆日
    '2026-10-25',  # 重阳节 (预估)
    '2026-12-25',  # 圣诞节
}

HK_HOLIDAYS = HK_HOLIDAYS_2025 | HK_HOLIDAYS_2026

# ============ A股 (CN) 交易日历 ============
# 数据来源: 中国证监会官方公告
CN_HOLIDAYS_2025 = {
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
}

CN_HOLIDAYS_2026 = {
    '2026-01-01',  # 元旦 (预估)
    '2026-01-02',
    '2026-02-17',  # 春节 (预估)
    '2026-02-18',
    '2026-02-19',
    '2026-02-20',
    '2026-02-21',
    '2026-02-22',
    '2026-02-23',
    '2026-04-05',  # 清明节 (预估)
    '2026-04-06',
    '2026-05-01',  # 劳动节 (预估)
    '2026-05-02',
    '2026-05-03',
    '2026-06-19',  # 端午节 (预估)
    '2026-06-20',
    '2026-06-21',
    '2026-10-01',  # 国庆节 (预估)
    '2026-10-02',
    '2026-10-03',
    '2026-10-04',
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
}

CN_HOLIDAYS = CN_HOLIDAYS_2025 | CN_HOLIDAYS_2026


def get_market_from_symbol(symbol: str) -> str:
    """根据股票代码判断市场"""
    if len(symbol) == 5:
        return "HK"  # 港股通常是5位
    return "CN"  # A股通常是6位


def get_holidays(market: str) -> set:
    """获取指定市场的假期列表"""
    if market == "HK":
        return HK_HOLIDAYS
    return CN_HOLIDAYS


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
    
    Args:
        date_str: 日期字符串，格式 "YYYY-MM-DD"
        symbol: 股票代码（可选，用于自动推断市场）
        market: 市场代码（可选，如果提供则优先使用）
    
    Returns:
        bool: 是否为交易日
    """
    try:
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
    
    Args:
        from_date: 从哪一天开始计算
        market: 市场代码 ("HK" 或 "CN")
    
    Returns:
        下一个交易日的 datetime 对象
    """
    next_day = from_date + timedelta(days=1)
    
    while is_market_closed(next_day, market):
        next_day = next_day + timedelta(days=1)
    
    return next_day


def get_next_trading_day_str(from_date_str: str, symbol: str = None, market: str = None) -> str:
    """
    获取下一个交易日（字符串版本）
    
    Args:
        from_date_str: 日期字符串，格式 "YYYY-MM-DD"
        symbol: 股票代码（可选，用于自动推断市场）
        market: 市场代码（可选，如果提供则优先使用）
    
    Returns:
        下一个交易日的字符串，格式 "YYYY-MM-DD"
    """
    from_date = datetime.strptime(from_date_str, '%Y-%m-%d')
    
    # 确定市场
    if market is None:
        market = get_market_from_symbol(symbol) if symbol else "HK"
    
    next_day = get_next_trading_day(from_date, market)
    return next_day.strftime('%Y-%m-%d')
