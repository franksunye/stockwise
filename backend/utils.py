import os
import requests
from datetime import datetime
from pypinyin import pinyin, Style
from config import BEIJING_TZ, WECOM_ROBOT_KEY
from database import get_connection

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
