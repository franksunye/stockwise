"""
港股交易日历工具
用于计算下一个交易日、判断是否休市等
"""

from datetime import datetime, timedelta

# 港股 2025 年休市日 (不含周末)
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

# 港股 2026 年休市日 (预估)
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

ALL_HOLIDAYS = HK_HOLIDAYS_2025 | HK_HOLIDAYS_2026


def is_market_closed(date: datetime) -> bool:
    """判断指定日期是否为港股休市日 (周末或假期)"""
    # 周六(5)或周日(6) - Python weekday() 中 0=周一
    if date.weekday() >= 5:
        return True
    # 检查假期列表
    date_str = date.strftime('%Y-%m-%d')
    return date_str in ALL_HOLIDAYS


def get_next_trading_day(from_date: datetime) -> datetime:
    """
    获取下一个交易日
    
    Args:
        from_date: 从哪一天开始计算 (通常是今日行情的日期)
    
    Returns:
        下一个交易日的 datetime 对象
    """
    next_day = from_date + timedelta(days=1)
    
    # 循环跳过所有休市日
    while is_market_closed(next_day):
        next_day = next_day + timedelta(days=1)
    
    return next_day


def get_next_trading_day_str(from_date_str: str) -> str:
    """
    获取下一个交易日（字符串版本）
    
    Args:
        from_date_str: 日期字符串，格式 "YYYY-MM-DD"
    
    Returns:
        下一个交易日的字符串，格式 "YYYY-MM-DD"
    """
    from_date = datetime.strptime(from_date_str, '%Y-%m-%d')
    next_day = get_next_trading_day(from_date)
    return next_day.strftime('%Y-%m-%d')
