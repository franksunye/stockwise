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

def retry_request(max_retries=5, delay=2.0, backoff=2.0):
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

@retry_request(max_retries=3, delay=1.0)
def send_wecom_notification(content: str, mentioned_mobile_list: list = None):
    """
    发送企业微信机器人通知
    :param content: 消息内容 (Markdown)
    :param mentioned_mobile_list: 需要 @ 的手机号列表 (["138...", "@all"])
    """
    if not WECOM_ROBOT_KEY:
        logger.warning("⚠️ WECOM_ROBOT_KEY not found in environment. Notification skipped.")
        return
    
    if WECOM_ROBOT_KEY.startswith("http"):
        url = WECOM_ROBOT_KEY
    else:
        url = f"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={WECOM_ROBOT_KEY}"
    
    payload = {
        "msgtype": "markdown",
        "markdown": { "content": content }
    }
    
    # 企业微信 Webhook Markdown 类型不支持直接字段 @，
    # 必须在 content 文本中包含 <@userid> 或 手机号。
    # 但 text 类型支持 mentioned_mobile_list。
    # 这里我们采用一种折中方案：如果 content 是 markdown，我们在末尾追加 visible text。
    
    if mentioned_mobile_list:
        # Markdown 模式下，直接在文本中拼接 @
        mentions = []
        for mobile in mentioned_mobile_list:
            if mobile == "@all":
                 mentions.append("@all") # 企微 Markdown 支持 <@all> 吗？文档不明确，但通常文本 @all 有效
            else:
                 mentions.append(f"<@{mobile}>") # Markdown 需要 userid，手机号可能不支持直接渲染为 @的高亮
                 # 备选：如果是 msgtype=text，则支持 mentioned_mobile_list 参数。
                 # 为了稳妥，混合双打：如果是重要报警，追加一行文本消息 @人
        
        # 简化策略：Markdown 不支持手机号 @，只能 @userid。
        # 我们改用：Markdown 正文 + 只有在有 @需求时，如果 content 不包含 @，
        # 则把 mentioned_mobile_list 拼接到 content 底部 (虽然高亮支持有限)。
        # 但企微机器人文档指出：markdown类型不支持 @人。
        # 只有 text 类型支持 @all 和 @mobile。
        # 因此，为了通知到位，如果需要 @人，我们额外发一条 text 消息，或者 switch to text mode?
        # 不，保留 Markdown 的美观，额外发一条 text 的"提醒" 可能是最佳实践。
        pass

    try:
        # 1. 发送 Markdown
        response = requests.post(url, json=payload, timeout=10)
        
        # 2. 如果需要 @人，额外发一条 Text 消息 (因为 Markdown 无法通过 API 参数 @手机号)
        if mentioned_mobile_list and response.status_code == 200:
             text_payload = {
                "msgtype": "text",
                "text": {
                    "content": "⚠️ 运维提醒: 请关注上述报警",
                    "mentioned_mobile_list": mentioned_mobile_list
                }
             }
             requests.post(url, json=text_payload, timeout=5)

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



