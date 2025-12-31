import os
import requests
import json
from logger import logger

def send_push_notification(title, body, url=None, related_symbol=None, broadcast=False, tag=None):
    """
    调用 Internal API 发送 Web Push 通知
    """
    # 在 GitHub Actions 中，NEXT_PUBLIC_SITE_URL 或类似变量应指向生产环境
    # 如果没有设置，默认为 localhost (开发用)
    base_url = os.getenv("NEXT_PUBLIC_SITE_URL") or "http://localhost:3000"
    api_url = f"{base_url}/api/internal/notify"
    
    secret = os.getenv("INTERNAL_API_SECRET")
    
    if not secret:
        logger.debug("⚠️ Skipping push notification: INTERNAL_API_SECRET not set")
        return

    payload = {
        "title": title,
        "body": body,
        "url": url,
        "related_symbol": related_symbol,
        "broadcast": broadcast,
        "tag": tag
    }

    try:
        response = requests.post(
            api_url,
            json=payload,
            headers={
                "Authorization": f"Bearer {secret}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        if response.status_code == 200:
            logger.info(f"✅ 推送发送成功: {title}")
        else:
            logger.warning(f"⚠️ 推送发送失败 [{response.status_code}]: {response.text}")
    except Exception as e:
        logger.error(f"❌ 推送请求异常: {e}")
