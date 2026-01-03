"""
辅助函数模块
"""
from datetime import datetime

from config import BEIJING_TZ
from database import get_connection
from trading_calendar import is_market_closed
from logger import logger


def get_last_date(symbol: str, table: str = "daily_prices") -> str:
    """获取数据库中某支股票的最后日期"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"SELECT MAX(date) FROM {table} WHERE symbol = ?", (symbol,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row and row[0] else None


def check_stock_analysis_mode(symbol: str) -> str:
    """检查股票分析模式：如果有 Pro/Premium 用户关注，则使用 AI，否则使用 Rules"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # 获取当前 UTC 时间字符串进行比较 (格式兼容 ISO)
        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")
        
        # 检查是否有有效期内的付费用户关注
        query = """
        SELECT COUNT(*) FROM users u
        JOIN user_watchlist w ON u.user_id = w.user_id
        WHERE w.symbol = ? 
        AND u.subscription_tier IN ('pro', 'premium')
        AND (u.subscription_expires_at IS NULL OR u.subscription_expires_at > ?)
        """
        cursor.execute(query, (symbol, now_str))
        row = cursor.fetchone()
        count = row[0] if row else 0
        conn.close()
        
        mode = 'ai' if count > 0 else 'rule'
        if mode == 'ai':
            logger.info(f"   💎 检测到 Pro 用户关注，启用 AI 深度分析")
        else:
            logger.info(f"   ⚪ 仅普通用户关注，使用规则引擎")
            
        return "ai"
    except Exception as e:
        logger.warning(f"   ⚠️ 权限检查失败 ({e})，默认使用 AI")
        return 'ai'


def check_trading_day_skip(market: str = None) -> bool:
    """检查今天是否为所属市场的交易日，如果不是则建议跳过分析"""
    # 获取北京时间日期
    today_str = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")
    
    # 如果指定了具体市场 (CN/HK)
    if market:
        if is_market_closed(datetime.now(BEIJING_TZ), market):
            logger.info(f"📅 今日 ({today_str}) 为 {market} 市场休市日，跳过例行同步。")
            return True
    else:
        # 如果没指定市场，检查 A 股和港股是否都休市
        if is_market_closed(datetime.now(BEIJING_TZ), "CN") and is_market_closed(datetime.now(BEIJING_TZ), "HK"):
            logger.info(f"📅 今日 ({today_str}) 为 A股/港股 全面休市日，跳过所有例行同步。")
            return True
            
    return False
