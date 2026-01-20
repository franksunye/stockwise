import os
import requests
import json
import time
from logger import logger

def send_push_notification(title, body, url=None, related_symbol=None, broadcast=False, tag=None, target_user_id=None):
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
        "tag": tag,
        "target_user_id": target_user_id
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
            logger.info(f"✅ 推送发送成功: {title} (Target: {target_user_id or 'Broadcast'})")
        else:
            logger.warning(f"⚠️ 推送发送失败 [{response.status_code}]: {response.text}")
    except Exception as e:
        logger.error(f"❌ 推送请求异常: {e}")

def send_personalized_daily_report(date_str):
    """
    Broadcast push notifications to users who have a generated brief for the given date.
    Purely consumes 'daily_briefs' table. Does NOT trigger generation.
    
    DEPRECATED: This function is for batch notification and is no longer used in the main pipeline.
    The new approach sends notifications immediately after each user's brief is generated
    (see brief_generator.py::notify_user_brief_ready).
    
    This function is retained for manual re-notification or compatibility with legacy workflows.
    """
    try:
        from backend.database import get_connection
    except ImportError:
        from database import get_connection
    
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # Join daily_briefs with push_subscriptions to find valid targets
        cursor.execute("""
            SELECT DISTINCT db.user_id, db.push_hook
            FROM daily_briefs db
            JOIN push_subscriptions ps ON db.user_id = ps.user_id
            WHERE db.date = ?
        """, (date_str,))
        
        targets = cursor.fetchall()
        
        if not targets:
            logger.info(f"ℹ️ No briefs found for {date_str} (or no subscribed users). Pipeline sequence error?")
            return

        logger.info(f"📤 Sending push notifications to {len(targets)} users...")
        
        success_count = 0
        for user_id, push_hook in targets:
            try:
                # Send push notification
                send_push_notification(
                    title="📊 每日简报已生成",
                    body=push_hook or "点击查看今日 AI 复盘",
                    url="/dashboard/brief",
                    target_user_id=user_id,
                    tag="daily_brief"
                )
                success_count += 1
                time.sleep(0.2) # Rate limit protection
                
            except Exception as e:
                logger.error(f"❌ Failed to push to {user_id}: {e}")
                
        logger.info(f"✅ Batch push completed. Sent: {success_count}/{len(targets)}")
        
    except Exception as e:
        logger.error(f"❌ Broadcast error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    import argparse
    from datetime import datetime
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", choices=["push_daily"], required=True)
    parser.add_argument("--date", help="Date YYYY-MM-DD")
    args = parser.parse_args()
    
    if args.action == "push_daily":
        target_date = args.date or datetime.now().strftime("%Y-%m-%d")
        send_personalized_daily_report(target_date) 
