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

def send_personalized_daily_report(targets, date_str):
    """
    为关注了这些股票的用户发送个性化通知
    """
    from database import get_connection
    
    if not targets:
        return
        
    conn = get_connection()
    cursor = conn.cursor()
    
    logger.info(f"发送个性化推送给关注了 {len(targets)} 只股票的用户...")
    
    # 查找所有关注了这些股票的用户及其关注的股票详情
    # 使用符号列表构造查询
    placeholders = ','.join(['?'] * len(targets))
    query = f"""
    SELECT u.user_id, w.symbol, sm.name, ap.signal
    FROM users u
    JOIN user_watchlist w ON u.user_id = w.user_id
    JOIN stock_meta sm ON w.symbol = sm.symbol
    JOIN ai_predictions ap ON w.symbol = ap.symbol AND ap.date = ?
    WHERE w.symbol IN ({placeholders})
    """
    params = [date_str] + targets
    
    try:
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        logger.error(f"❌ 查询个性化推送数据失败: {e}")
        if conn: conn.close()
        return
    
    if not rows:
        logger.info("ℹ️ 没有发现需要个性化推送的活跃关注用户")
        return

    # 按用户分组
    user_data = {}
    for row in rows:
        # 兼容 tuple 和 Row 对象
        if isinstance(row, tuple):
            uid, symbol, name, signal = row[0], row[1], row[2], row[3]
        else:
            uid, symbol, name, signal = row.user_id, row.symbol, row.name, row.signal
            
        if uid not in user_data:
            user_data[uid] = []
        user_data[uid].append({'symbol': symbol, 'name': name, 'signal': signal})
        
    logger.info(f"准备向 {len(user_data)} 位用户发送个性化日报...")
    
    for uid, stocks in user_data.items():
        count = len(stocks)
        if count == 0: continue
        
        # 挑选一个表现最突出的（看多 > 观望 > 看空）
        bullish = [s for s in stocks if s['signal'] == 'Bullish']
        neutral = [s for s in stocks if s['signal'] == 'Neutral']
        
        if bullish:
            top_stock = bullish[0]['name']
            emoji = "🚀"
            body = f"您关注的 {count} 只股票已更新。AI看多 {top_stock}，点击查看实战建议。"
        elif neutral:
            top_stock = neutral[0]['name']
            emoji = "⚖️"
            body = f"您关注的 {count} 只股票已更新。{top_stock} 建议观望，点击查看逻辑。"
        else:
            top_stock = stocks[0]['name']
            emoji = "📉"
            body = f"您关注的 {count} 只股票已更新。{top_stock} 建议减仓风险，点击查看详情。"
            
        # 发送推送 (这里可以稍微加点延时避免并发瞬间冲垮 API)
        send_push_notification(
            title=f"{emoji} AI 个性化日报已生成",
            body=body,
            url="/dashboard",
            target_user_id=uid,
            tag="daily_report"
        )
        # 频率限制：每秒最多发几个? 系统规模小暂不强制限制，但稍微休眠下
        # time.sleep(0.1) 
