import os
import time
import random
import requests
from functools import wraps
from datetime import datetime
from pypinyin import pinyin, Style
from config import BEIJING_TZ, WECOM_ROBOT_KEY
from database import get_connection
from logger import logger

def retry_request(max_retries=3, delay=1.0, backoff=2.0):
    """
    网络请求重试装饰器 (指数退避 + 随机抖动)
    :param max_retries: 最大重试次数
    :param delay: 初始等待秒数
    :param backoff: 退避倍数
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            tries = 0
            current_delay = delay
            while tries <= max_retries:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    tries += 1
                    if tries > max_retries:
                        # 超过重试次数，抛出异常
                        logger.error(f"❌ 重试耗尽 ({max_retries}次): {func.__name__} - {e}")
                        raise e
                    
                    # 随机抖动 (0 ~ 0.5s) 避免惊群效应
                    jitter = random.uniform(0, 0.5)
                    wait_time = current_delay + jitter
                    
                    logger.warning(f"⚠️ 网络波动，{wait_time:.1f}秒后第 {tries} 次重试... (Error: {str(e)[:50]}...)")
                    time.sleep(wait_time)
                    current_delay *= backoff
        return wrapper
    return decorator

def get_market(symbol: str) -> str:
    """获取股票所属市场 (CN/HK)"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT market FROM stock_meta WHERE symbol = ?", (symbol,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return row[0]
    except:
        pass
    
    if len(symbol) == 5:
        return "HK"
    return "CN"

def get_pinyin_info(name: str):
    """生成全拼和首字母简写"""
    try:
        full_pinyin = "".join([i[0] for i in pinyin(name, style=Style.NORMAL)])
        abbr_pinyin = "".join([i[0][0] for i in pinyin(name, style=Style.FIRST_LETTER)])
        return full_pinyin.lower(), abbr_pinyin.lower()
    except:
        return "", ""

def send_wecom_notification(content: str):
    """发送企业微信机器人通知"""
    if not WECOM_ROBOT_KEY:
        return
    
    url = f"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={WECOM_ROBOT_KEY}"
    data = {
        "msgtype": "markdown",
        "markdown": { "content": content }
    }
    try:
        response = requests.post(url, json=data, timeout=10)
        if response.status_code == 200:
            print("   📲 企微报告已推送")
        else:
            print(f"   ⚠️ 企微推送失败: {response.text}")
    except Exception as e:
        print(f"   ⚠️ 企微网络异常: {e}")

def format_date(dt_str: str, format_in="%Y%m%d", format_out="%Y-%m-%d") -> str:
    """日期格式转换"""
    try:
        return datetime.strptime(dt_str, format_in).strftime(format_out)
    except:
        return dt_str

def format_volume(volume):
    """
    格式化成交量/成交额，使其更易读 (万/亿)
    """
    try:
        val = float(volume)
        if val >= 100000000:
            return f"{val / 100000000:.2f}亿"
        if val >= 10000:
            return f"{val / 10000:.1f}万"
        return str(int(val))
    except:
        return str(volume)
