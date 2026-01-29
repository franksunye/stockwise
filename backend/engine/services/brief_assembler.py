import asyncio
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

try:
    from backend.database import get_connection
    from backend.logger import logger
    from backend.notifications import send_push_notification
except ImportError:
    from database import get_connection
    from logger import logger
    try:
        from notifications import send_push_notification
    except ImportError:
        # Fallback for notification if not found
        def send_push_notification(**kwargs):
            logger.warning("send_push_notification not found, notification skipped")

async def assemble_user_brief(user_id: str, date_str: str) -> Optional[str]:
    """
    Phase 2: Assemble personalized brief from `stock_briefs`.
    Zero LLM cost.
    Fetches briefs matching user's subscription tier.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # 0. Get user subscription tier
        cursor.execute("SELECT subscription_tier FROM users WHERE user_id = ?", (user_id,))
        tier_row = cursor.fetchone()
        user_tier = tier_row[0] if tier_row and tier_row[0] else 'free'
        logger.info(f"👤 User {user_id} tier: {user_tier}")
        
        # 1. Get user watchlist
        cursor.execute("SELECT symbol FROM user_watchlist WHERE user_id = ?", (user_id,))
        watchlist = [r[0] for r in cursor.fetchall()]
        
        if not watchlist:
            return None

        # 2. Fetch cached briefs (matching user's tier, with fallback to 'free')
        placeholders = ','.join(['?' for _ in watchlist])
        cursor.execute(f"""
            SELECT symbol, stock_name, analysis_markdown, signal
            FROM stock_briefs
            WHERE symbol IN ({placeholders}) AND date = ? AND tier = ?
        """, (*watchlist, date_str, user_tier))
        
        stock_reports = cursor.fetchall()
        
        # Fallback: If PRO user has no pro briefs, try free tier as backup
        if not stock_reports and user_tier == 'pro':
            logger.warning(f"⚠️ No PRO briefs for user {user_id}, falling back to FREE tier...")
            cursor.execute(f"""
                SELECT symbol, stock_name, analysis_markdown, signal
                FROM stock_briefs
                WHERE symbol IN ({placeholders}) AND date = ? AND tier = 'free'
            """, (*watchlist, date_str))
            stock_reports = cursor.fetchall()
        
        if not stock_reports:
            logger.warning(f"⚠️ User {user_id} (tier={user_tier}) has watchlist but no stock briefs found for {date_str}. Did Phase 1 run?")
            return None

        # 3. Assemble Markdown
        brief_sections = []
        brief_sections.append(f"# 📊 每日简报 - {date_str}\n")
        brief_sections.append(f"个人定制，基于您关注的 {len(watchlist)} 只股票。\n\n---\n")
        
        for symbol, name, analysis, signal in stock_reports:
            stock_name = name or symbol
            brief_sections.append(f"### {stock_name} ({symbol})")
            brief_sections.append(f"{analysis}\n\n")

        timestamp = datetime.now().strftime("%H:%M")
        brief_sections.append("---\n")
        brief_sections.append(f"*StockWise AI 生成于 {timestamp}*")
        
        full_brief = "\n".join(brief_sections)
        
        # Intelligent Hook Generation
        bullish_stocks = []
        bearish_stocks = []
        
        for symbol, name, _, signal in stock_reports:
             s_name = name or symbol
             if signal and ('Long' in signal or 'Bullish' in signal):
                 bullish_stocks.append(s_name)
             elif signal and ('Short' in signal or 'Bearish' in signal):
                 bearish_stocks.append(s_name)
        
        if bullish_stocks:
            top_stocks = "、".join(bullish_stocks[:2])
            etc = "等" if len(bullish_stocks) > 2 else ""
            push_hook = f"📈 {top_stocks}{etc}出现看涨信号，点击查看今日 AI 复盘。"
        elif bearish_stocks:
            top_stocks = "、".join(bearish_stocks[:2])
            etc = "等" if len(bearish_stocks) > 2 else ""
            push_hook = f"⚠️ {top_stocks}{etc}面临调整压力，点击查看风险提示。"
        else:
            push_hook = f"今日复盘：{len(watchlist)} 只股票走势平稳，点击查看详情。"

        # 4. Save User Brief
        cursor.execute("""
            INSERT OR REPLACE INTO daily_briefs (user_id, date, content, push_hook)
            VALUES (?, ?, ?, ?)
        """, (user_id, date_str, full_brief, push_hook))
        conn.commit()
        
        return full_brief

    except Exception as e:
        logger.error(f"❌ [Phase 2] Error assembling brief for {user_id}: {e}")
        return None
    finally:
        conn.close()

async def notify_user_brief_ready(user_id: str, date_str: str):
    """
    Send push notification to user immediately after their brief is ready.
    Includes idempotency protection and comprehensive error handling.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # 1. Idempotency Check
        cursor.execute(
            "SELECT notified_at FROM daily_briefs WHERE user_id = ? AND date = ?",
            (user_id, date_str)
        )
        row = cursor.fetchone()
        
        if not row:
            logger.warning(f"⚠️ [Notify] User {user_id} has no brief for {date_str}, skipping notification")
            return
        
        if row[0]:  # notified_at is not NULL
            logger.debug(f"ℹ️ [Notify] User {user_id} already notified at {row[0]}, skipping")
            return
        
        # 2. Subscription Check
        cursor.execute(
            "SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1",
            (user_id,)
        )
        if not cursor.fetchone():
            logger.info(f"ℹ️ [Notify] User {user_id} has no push subscription, skipping notification")
            return
        
        # 3. Get user tier
        cursor.execute(
            "SELECT subscription_tier FROM users WHERE user_id = ?",
            (user_id,)
        )
        tier_row = cursor.fetchone()
        user_tier = tier_row[0] if tier_row and tier_row[0] else 'free'
        
        # 4. Get push_hook
        cursor.execute(
            "SELECT push_hook FROM daily_briefs WHERE user_id = ? AND date = ?",
            (user_id, date_str)
        )
        row = cursor.fetchone()
        push_hook = row[0] if row and row[0] else "点击查看今日 AI 复盘"
        
        # 5. Render & Send notification using unified template engine
        try:
            from notification_templates import NotificationTemplates
        except ImportError:
            try:
                from backend.notification_templates import NotificationTemplates
            except ImportError:
                # Basic mock for absolute safety during refactor
                class NotificationTemplates:
                    @staticmethod
                    def render(ntype, tier, **kwargs):
                        if tier == 'pro': 
                            return "⭐ Pro 深度复盘已就绪", f"{kwargs.get('push_hook')} | 首席主笔深度解读"
                        return "📊 今日简报已生成", kwargs.get('push_hook')

        notify_title, notify_body = NotificationTemplates.render(
            "daily_brief", 
            tier=user_tier, 
            push_hook=push_hook
        )
        
        send_push_notification(
            title=notify_title,
            body=notify_body,
            url="/dashboard?brief=true",
            target_user_id=user_id,
            tag="daily_brief"
        )
        
        # 6. Mark as notified (UTC+8 workaround)
        cursor.execute(
            "UPDATE daily_briefs SET notified_at = datetime('now', '+8 hours') WHERE user_id = ? AND date = ?",
            (user_id, date_str)
        )
        conn.commit()
        
        logger.info(f"✅ [Notify] User {user_id} notified for brief {date_str}")
        
    except Exception as e:
        logger.error(f"❌ [Notify] Failed to notify user {user_id}: {e}")
    finally:
        conn.close()
